const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const User    = require('../models/User');
const Payment = require('../models/Payment');
const { Message, Conversation } = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');
const { geocode, nearSphereQuery } = require('../config/geocoding');
const { escapeRegex } = require('../utils/sanitize');
const stripeService = require('../services/stripeService');
const emailWorkflowService = require('../services/emailWorkflowService');
const emailService  = require('../services/emailService');

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filters = {
      isActive: true,
      status: 'active'
    };
    
    if (req.query.category && req.query.category !== 'all') {
      filters.category = req.query.category;
    }
    
    if (req.query.skills) {
      const skills = req.query.skills.split(',').map(skill => skill.trim());
      filters.skills = { $in: skills };
    }
    
    if (req.query.minPrice || req.query.maxPrice) {
      filters['pricing.basic.price'] = {};
      if (req.query.minPrice) {
        filters['pricing.basic.price'].$gte = parseFloat(req.query.minPrice);
      }
      if (req.query.maxPrice) {
        filters['pricing.basic.price'].$lte = parseFloat(req.query.maxPrice);
      }
    }

    // Location type filter: remote / local / all
    if (req.query.locationType && req.query.locationType !== 'all') {
      filters['location.locationType'] = req.query.locationType;
    }

    // Distance-based search: ?near=94520&radius=25
    if (req.query.near && req.query.near.trim() !== '') {
      const radius = parseInt(req.query.radius) || 25;
      const coords = await geocode(req.query.near.trim());
      if (coords) {
        filters['location.coordinates'] = nearSphereQuery(coords, radius);
        if (!filters['location.locationType']) {
          filters['location.locationType'] = { $in: ['local', 'hybrid'] };
        }
      }
    }
    
    if (req.query.search) {
      const safeSearch = escapeRegex(req.query.search);
      filters.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { skills: { $in: [new RegExp(safeSearch, 'i')] } }
      ];
    }
    
    const services = await Service.find(filters)
      .populate('freelancer', 'firstName lastName profilePicture rating totalJobs')
      .sort({ createdAt: -1, rating: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Service.countDocuments(filters);
    
    res.json({
      services,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('freelancer', 'firstName lastName profilePicture rating totalJobs memberSince');
    
    if (!service || !service.isActive) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    await service.incrementViews();
    
    res.json({ service });
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      subcategory,
      skills,
      pricing,
      gallery,
      faqs,
      requirements,
      location
    } = req.body;
    
    if (!title || !description || !category || !pricing?.basic) {
      return res.status(400).json({ 
        error: 'Title, description, category, and basic pricing are required' 
      });
    }
    
    const service = new Service({
      title,
      description,
      category,
      subcategory,
      skills: skills || [],
      pricing,
      gallery: gallery || [],
      faqs: faqs || [],
      requirements,
      location: location || { locationType: 'remote' },
      freelancer: req.user._id,
      status: 'active'
    });
    
    await service.save();
    
    const populatedService = await Service.findById(service._id)
      .populate('freelancer', 'firstName lastName profilePicture rating totalJobs');
    
    res.status(201).json({
      message: 'Service created successfully',
      service: populatedService
    });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// ── POST /api/services/:id/order ───────────────────────────────
// Step 1: create order + PaymentIntent. Frontend confirms card.
// Webhook payment_intent.succeeded → Step 2 (order activated).
router.post('/:id/order', authenticateToken, async (req, res) => {
  try {
    const { package: pkg, requirements } = req.body;
    if (!pkg || !['basic', 'standard', 'premium'].includes(pkg)) {
      return res.status(400).json({ error: 'Valid package selection is required' });
    }

    const service = await Service.findById(req.params.id).populate('freelancer', 'firstName lastName email stripeAccountId');
    if (!service || !service.isActive || service.status !== 'active') {
      return res.status(404).json({ error: 'Service not found or not available' });
    }
    if (String(service.freelancer._id) === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot order your own service' });
    }

    const selectedPackage = service.pricing[pkg];
    if (!selectedPackage) {
      return res.status(400).json({ error: 'Selected package not available' });
    }

    const price = selectedPackage.price;
    const platformFee = Math.round(price * 0.10 * 100) / 100;

    // Create PaymentIntent — client confirms on frontend
    const paymentIntent = await stripeService.chargeForJob(price, 'usd', {
      type:       'service_order',
      serviceId:  String(service._id),
      clientId:   String(req.user._id),
      freelancerId: String(service.freelancer._id),
    });

    // Add order with 'pending' status (activated on payment confirmation)
    const order = {
      client:                req.user._id,
      package:               pkg,
      status:                'pending',
      price,
      requirements:          requirements?.trim() || '',
      stripePaymentIntentId: paymentIntent.id,
      escrowAmount:          price,
    };
    await service.addOrder(order);
    const newOrder = service.orders[service.orders.length - 1];

    res.status(201).json({
      message:         'Order created — complete payment to confirm',
      orderId:         newOrder._id,
      clientSecret:    paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount:          price,
      serviceName:     service.title,
      packageName:     selectedPackage.title,
      deliveryDays:    selectedPackage.deliveryTime,
    });
  } catch (error) {
    console.error('Error creating service order:', error);
    res.status(500).json({ error: 'Failed to create service order' });
  }
});

// ── POST /api/services/:id/orders/:orderId/confirm ──────────────
// Called after frontend confirms payment — activates order + sends message
router.post('/:id/orders/:orderId/confirm', authenticateToken, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('freelancer', 'firstName lastName email');
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const order = service.orders.id(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (String(order.client) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (order.status !== 'pending') {
      return res.json({ message: 'Order already confirmed', order });
    }

    // Activate order
    order.status = 'in_progress';
    await service.save();

    // Create Payment record
    await Payment.create({
      job:         null,
      client:      req.user._id,
      freelancer:  service.freelancer._id,
      amount:      order.price,
      type:        'escrow',
      status:      'processing',
      paymentMethod: 'stripe',
      stripePaymentIntentId: order.stripePaymentIntentId,
      transactionId: order.stripePaymentIntentId,
      platformFee: Math.round(order.price * 0.10 * 100) / 100,
    });

    // Create/find conversation + send system message
    let conversation = await Conversation.findByParticipants(service.freelancer._id, req.user._id);
    if (!conversation) {
      conversation = new Conversation({
        participants: [service.freelancer._id, req.user._id],
        service:        service._id,
        serviceOrderId: order._id,
      });
      await conversation.save();
    } else if (!conversation.service) {
      conversation.service        = service._id;
      conversation.serviceOrderId = order._id;
      await conversation.save();
    }

    const pkg = service.pricing[order.package] || {};
    const systemMessage = new Message({
      conversation: conversation._id,
      sender:       req.user._id,
      recipient:    service.freelancer._id,
      content:      `✅ Service Order Confirmed & Paid!\n\nService: "${service.title}"\nPackage: ${pkg.title || order.package}\nPrice: $${order.price}\nDelivery: ${pkg.deliveryTime || '?'} days\nOrdered: ${new Date().toLocaleString()}${order.requirements ? `\n\nRequirements:\n${order.requirements}` : ''}`,
      messageType:  'system',
      metadata: {
        type:         'service_order',
        serviceId:    service._id,
        serviceTitle: service.title,
        orderId:      order._id,
        package:      pkg.title || order.package,
        price:        order.price,
        deliveryDays: pkg.deliveryTime,
      }
    });
    await systemMessage.save();
    conversation.lastMessage = systemMessage._id;
    await conversation.updateLastActivity();

    res.json({ message: 'Order confirmed', order });
  } catch (error) {
    console.error('Error confirming order:', error);
    res.status(500).json({ error: 'Failed to confirm order' });
  }
});

// ── PUT /api/services/:id/orders/:orderId/deliver ───────────────
// Freelancer marks order as delivered
router.put('/:id/orders/:orderId/deliver', authenticateToken, async (req, res) => {
  try {
    const { deliveryNote } = req.body;
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    if (String(service.freelancer) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the freelancer can mark as delivered' });
    }

    const order = service.orders.id(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!['in_progress', 'revision_requested'].includes(order.status)) {
      return res.status(400).json({ error: 'Order is not in progress' });
    }

    order.status       = 'delivered';
    order.deliveryDate = new Date();
    if (deliveryNote) order.deliveryNote = deliveryNote;
    await service.save();

    // Notify client via message
    const conversation = await Conversation.findOne({ service: service._id, serviceOrderId: order._id });
    if (conversation) {
      const msg = new Message({
        conversation: conversation._id,
        sender:       req.user._id,
        recipient:    order.client,
        content:      `📦 Delivery submitted!\n\n${deliveryNote || 'Your order has been delivered. Please review and mark complete when satisfied.'}\n\nIf you're happy with the work, click "Mark Complete" to release payment. If you need changes, click "Request Revision".`,
        messageType:  'system',
        metadata: { type: 'delivery_submitted', serviceId: service._id, orderId: order._id }
      });
      await msg.save();
      conversation.lastMessage = msg._id;
      await conversation.updateLastActivity();
    }

    res.json({ message: 'Order marked as delivered', order });
  } catch (error) {
    console.error('Error delivering order:', error);
    res.status(500).json({ error: 'Failed to mark as delivered' });
  }
});

// ── PUT /api/services/:id/orders/:orderId/complete ──────────────
// Client approves delivery → releases payment to freelancer
router.put('/:id/orders/:orderId/complete', authenticateToken, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('freelancer', 'firstName lastName stripeAccountId email');
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const order = service.orders.id(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (String(order.client) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the client can mark as complete' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Order must be delivered before completing' });
    }
    if (!service.freelancer.stripeAccountId) {
      return res.status(400).json({
        error: 'Freelancer has not connected their bank account yet. Ask them to set up payments in their profile.'
      });
    }

    const platformFee = Math.round(order.price * 0.10 * 100) / 100;
    const payoutAmt   = order.price - platformFee;

    // Release payment to freelancer
    const transfer = await stripeService.releasePayment(
      payoutAmt,
      service.freelancer.stripeAccountId,
      order.stripePaymentIntentId
    );

    // Update order
    order.status        = 'completed';
    order.completedDate = new Date();
    order.escrowAmount  = 0;
    await service.save();

    // Update payment record
    await Payment.findOneAndUpdate(
      { stripePaymentIntentId: order.stripePaymentIntentId },
      { status: 'completed' }
    );

    // Create release payment record
    await Payment.create({
      client:      req.user._id,
      freelancer:  service.freelancer._id,
      amount:      payoutAmt,
      type:        'release',
      status:      'completed',
      paymentMethod: 'stripe',
      transactionId: transfer.id,
      platformFee,
    });

    // Notify via message
    const conversation = await Conversation.findOne({ service: service._id, serviceOrderId: order._id });
    if (conversation) {
      const msg = new Message({
        conversation: conversation._id,
        sender:       req.user._id,
        recipient:    service.freelancer._id,
        content:      `🎉 Order Complete! Payment of $${payoutAmt.toFixed(2)} has been released to you. Thank you for the great work!`,
        messageType:  'system',
        metadata: { type: 'order_completed', serviceId: service._id, orderId: order._id }
      });
      await msg.save();
      conversation.lastMessage = msg._id;
      await conversation.updateLastActivity();
    }

    res.json({ message: 'Order completed and payment released', payoutAmt, transfer: transfer.id });
  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({ error: 'Failed to complete order' });
  }
});

// ── PUT /api/services/:id/orders/:orderId/revision ──────────────
// Client requests a revision
router.put('/:id/orders/:orderId/revision', authenticateToken, async (req, res) => {
  try {
    const { note } = req.body;
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const order = service.orders.id(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (String(order.client) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the client can request a revision' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Can only request revision on delivered orders' });
    }

    order.status        = 'revision_requested';
    order.revisionCount = (order.revisionCount || 0) + 1;
    await service.save();

    const conversation = await Conversation.findOne({ service: service._id, serviceOrderId: order._id });
    if (conversation) {
      const msg = new Message({
        conversation: conversation._id,
        sender:       req.user._id,
        recipient:    service.freelancer,
        content:      `🔄 Revision Requested (revision #${order.revisionCount})\n\n${note || 'Please review the requirements and resubmit.'}`,
        messageType:  'system',
        metadata: { type: 'revision_requested', serviceId: service._id, orderId: order._id }
      });
      await msg.save();
      conversation.lastMessage = msg._id;
      await conversation.updateLastActivity();
    }

    res.json({ message: 'Revision requested', revisionCount: order.revisionCount });
  } catch (error) {
    console.error('Error requesting revision:', error);
    res.status(500).json({ error: 'Failed to request revision' });
  }
});

// ── PUT /api/services/:id/orders/:orderId/cancel ───────────────
router.put('/:id/orders/:orderId/cancel', authenticateToken, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('freelancer', 'firstName lastName email');
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const order = service.orders.id(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const isClient     = String(order.client) === String(req.user._id);
    const isFreelancer = String(service.freelancer._id) === String(req.user._id);
    if (!isClient && !isFreelancer) return res.status(403).json({ error: 'Unauthorized' });

    if (['completed', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ error: `Order is already ${order.status}` });
    }

    // Refund if payment was collected
    let refunded = false;
    if (order.stripePaymentIntentId && order.escrowAmount > 0 && order.status !== 'pending') {
      try {
        await stripeService.refundPayment(order.stripePaymentIntentId);
        refunded = true;
      } catch (refundErr) {
        console.error('Refund failed:', refundErr.message);
        return res.status(500).json({ error: 'Refund failed: ' + refundErr.message });
      }
    }

    order.status       = 'cancelled';
    order.escrowAmount = 0;
    await service.save();

    // Update payment record
    if (order.stripePaymentIntentId) {
      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: order.stripePaymentIntentId },
        { status: 'refunded' }
      );
    }

    // Post cancellation message
    const conv = await Conversation.findOne({ service: service._id, serviceOrderId: order._id });
    if (conv) {
      const msg = new Message({
        conversation: conv._id,
        sender:       req.user._id,
        recipient:    isClient ? service.freelancer._id : order.client,
        content:      `❌ Order cancelled by ${isClient ? 'the client' : 'the freelancer'}.${refunded ? ' A full refund has been issued.' : ''}`,
        messageType:  'system',
        metadata: { type: 'order_cancelled', serviceId: service._id, orderId: order._id }
      });
      await msg.save();
      conv.lastMessage = msg._id;
      await conv.updateLastActivity();
    }

    res.json({ message: 'Order cancelled', refunded });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// ── GET /api/services/:id/orders/:orderId ──────────────────────
router.get('/:id/orders/:orderId', authenticateToken, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('freelancer', 'firstName lastName profilePicture stripeAccountId');
    if (!service) return res.status(404).json({ error: 'Service not found' });
    const order = service.orders.id(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const isParty = String(order.client) === String(req.user._id) ||
                    String(service.freelancer._id) === String(req.user._id);
    if (!isParty) return res.status(403).json({ error: 'Unauthorized' });
    res.json({ order, service: { _id: service._id, title: service.title, freelancer: service.freelancer } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ── GET /api/services/orders/my ────────────────────────────────
// Get current user's service orders (as client or freelancer)
router.get('/orders/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { role = 'client' } = req.query;

    let orders = [];
    if (role === 'client') {
      const services = await Service.find({ 'orders.client': userId })
        .populate('freelancer', 'firstName lastName profilePicture');
      services.forEach(s => {
        s.orders.filter(o => String(o.client) === String(userId)).forEach(o => {
          orders.push({ service: { _id: s._id, title: s.title, freelancer: s.freelancer }, order: o });
        });
      });
    } else {
      const services = await Service.find({ freelancer: userId, 'orders.0': { $exists: true } })
        .populate('orders.client', 'firstName lastName profilePicture');
      services.forEach(s => {
        s.orders.forEach(o => {
          orders.push({ service: { _id: s._id, title: s.title }, order: o });
        });
      });
    }

    orders.sort((a, b) => new Date(b.order.orderDate) - new Date(a.order.orderDate));
    res.json({ orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

module.exports = router;
