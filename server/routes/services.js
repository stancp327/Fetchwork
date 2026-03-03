const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const User    = require('../models/User');
const Payment = require('../models/Payment');
const ServiceSubscription = require('../models/ServiceSubscription');
const { notifyServiceEvent } = require('./services.notification.helpers');
const { Message, Conversation } = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');
const { parsePagination, buildServiceFilters } = require('./services.helpers');
const stripeService = require('../services/stripeService');
const emailWorkflowService = require('../services/emailWorkflowService');
const emailService  = require('../services/emailService');
const { checkServiceLimit } = require('../middleware/entitlements');
const { getFee, getFeeIncluded, getFeeDisplay } = require('../services/feeEngine');
const { hasFeature, FEATURES } = require('../services/entitlementEngine');
const { postServiceSystemMessage } = require('./services.messaging.helpers');
const { loadServiceOrderContext } = require('./services.order.helpers');
const { ensureOrderStatus, ensureRole } = require('./services.state.helpers');
const { markPaymentCompletedByIntent, markPaymentRefundedByIntent } = require('./services.payment.helpers');
const { findServiceConversation } = require('./services.conversation.helpers');
const { markOrderDelivered, markOrderCompleted, markOrderRevisionRequested, markOrderCancelled } = require('./services.transitions.helpers');
const { loadActiveService, ensureNotSelfService } = require('./services.lookup.helpers');

// GET /api/services/me — List current user's own services
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const services = await Service.find({ freelancer: req.user.userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ services });
  } catch (err) {
    console.error('My services error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filters = await buildServiceFilters(req.query);

    const services = await Service.find(filters)
      .populate('freelancer', 'firstName lastName profilePicture rating totalJobs')
      .sort({ isBoosted: -1, createdAt: -1, rating: -1 })
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

router.post('/', authenticateToken, checkServiceLimit, async (req, res) => {
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
      location,
      serviceType,
      recurring,
    } = req.body;
    
    if (!title || !description || !category || !pricing?.basic) {
      return res.status(400).json({ 
        error: 'Title, description, category, and basic pricing are required' 
      });
    }

    const userId = req.user.userId || req.user.id;

    // ── Feature gating ─────────────────────────────────────────────
    if (serviceType === 'recurring') {
      const canRecurring = await hasFeature(userId, FEATURES.RECURRING_SERVICES);
      if (!canRecurring) {
        return res.status(403).json({
          error:      'Recurring services require a Plus or Pro plan.',
          reason:     'feature_gated',
          feature:    FEATURES.RECURRING_SERVICES,
          upgradeUrl: '/pricing',
        });
      }
    }
    // ── Deposit gate (Pro only) ──────────────────────────────────
    const { deposit, travelFee } = req.body;
    if (deposit?.enabled) {
      const canDeposits = await hasFeature(userId, FEATURES.DEPOSITS);
      if (!canDeposits) {
        return res.status(403).json({
          error: 'Deposits require a Pro plan.', reason: 'feature_gated',
          feature: FEATURES.DEPOSITS, upgradeUrl: '/pricing',
        });
      }
    }

    // ── Travel fee gate (Pro only) ────────────────────────────────
    if (travelFee?.enabled) {
      const canTravel = await hasFeature(userId, FEATURES.TRAVEL_FEES);
      if (!canTravel) {
        return res.status(403).json({
          error: 'Travel fees require a Pro plan.', reason: 'feature_gated',
          feature: FEATURES.TRAVEL_FEES, upgradeUrl: '/pricing',
        });
      }
    }

    // ── Capacity controls gate (Plus+ only) ─────────────────────
    const { capacity } = req.body;
    if (capacity?.enabled) {
      const canCapacity = await hasFeature(userId, FEATURES.CAPACITY_CONTROLS);
      if (!canCapacity) {
        return res.status(403).json({
          error: 'Capacity controls require a Plus or Pro plan.', reason: 'feature_gated',
          feature: FEATURES.CAPACITY_CONTROLS, upgradeUrl: '/pricing',
        });
      }
    }

    // ── Intake form gate ────────────────────────────────────────
    const { intakeForm } = req.body;
    if (intakeForm?.enabled && intakeForm?.fields?.length > 0) {
      const canIntake = await hasFeature(userId, FEATURES.INTAKE_FORMS);
      if (!canIntake) {
        return res.status(403).json({
          error:      'Intake forms require a Plus or Pro plan.',
          reason:     'feature_gated',
          feature:    FEATURES.INTAKE_FORMS,
          upgradeUrl: '/pricing',
        });
      }
    }

    const { bundles, feesIncluded } = req.body;
    if (bundles?.length > 0) {
      const canBundles = await hasFeature(userId, FEATURES.BUNDLE_CREATION);
      if (!canBundles) {
        return res.status(403).json({
          error:      'Session bundles require a Plus or Pro plan.',
          reason:     'feature_gated',
          feature:    FEATURES.BUNDLE_CREATION,
          upgradeUrl: '/pricing',
        });
      }
      // Check if any bundle has expiration (Pro only)
      const hasExpiry = bundles.some((b) => b.expiresInDays);
      if (hasExpiry) {
        const canExpiry = await hasFeature(userId, FEATURES.BUNDLE_EXPIRATION);
        if (!canExpiry) {
          return res.status(403).json({
            error:      'Bundle expiration rules require a Pro plan.',
            reason:     'feature_gated',
            feature:    FEATURES.BUNDLE_EXPIRATION,
            upgradeUrl: '/pricing',
          });
        }
      }
    }
    // ──────────────────────────────────────────────────────────────

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
      status: 'active',
      serviceType:  serviceType || 'one_time',
      feesIncluded: feesIncluded === true,
      ...(serviceType === 'recurring' && recurring ? { recurring } : {}),
      ...(bundles?.length > 0 ? { bundles } : {}),
      ...(intakeForm?.enabled ? { intakeForm } : {}),
      ...(deposit?.enabled ? { deposit } : {}),
      ...(travelFee?.enabled ? { travelFee } : {}),
      ...(capacity?.enabled ? { capacity } : {}),
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

    const lookup = await loadActiveService({
      Service,
      serviceId: req.params.id,
      populate: { path: 'freelancer', select: 'firstName lastName email stripeAccountId' },
    });
    if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });
    const { service } = lookup;

    const selfCheck = ensureNotSelfService(service.freelancer._id, req.user._id);
    if (!selfCheck.ok) return res.status(400).json({ error: selfCheck.error });

    const selectedPackage = service.pricing[pkg];
    if (!selectedPackage) {
      return res.status(400).json({ error: 'Selected package not available' });
    }

    const listedPrice = selectedPackage.price;
    const feesIncluded = service.feesIncluded === true;

    let chargeAmount, platformFee, freelancerPayout;
    if (feesIncluded) {
      const feeResult = await getFeeIncluded({ userId: String(req.user.userId), role: 'client', jobType: 'remote', listedPrice });
      chargeAmount    = feeResult.clientCharges;
      platformFee     = feeResult.totalPlatformFee;
      freelancerPayout = feeResult.freelancerPayout;
    } else {
      const clientFeeResult     = await getFee({ userId: String(req.user.userId),           role: 'client',     jobType: 'remote', amount: listedPrice });
      const freelancerFeeResult = await getFee({ userId: String(service.freelancer._id),    role: 'freelancer', jobType: 'remote', amount: listedPrice });
      chargeAmount    = parseFloat((listedPrice + clientFeeResult.fee).toFixed(2));
      platformFee     = parseFloat((clientFeeResult.fee + freelancerFeeResult.fee).toFixed(2));
      freelancerPayout = parseFloat((listedPrice - freelancerFeeResult.fee).toFixed(2));
    }

    // Create PaymentIntent — client confirms on frontend
    const paymentIntent = await stripeService.chargeForJob(chargeAmount, 'usd', {
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
      price:                 chargeAmount,
      requirements:          requirements?.trim() || '',
      stripePaymentIntentId: paymentIntent.id,
      escrowAmount:          freelancerPayout,
      platformFee,
    };
    await service.addOrder(order);
    const newOrder = service.orders[service.orders.length - 1];

    res.status(201).json({
      message:         'Order created — complete payment to confirm',
      orderId:         newOrder._id,
      clientSecret:    paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount:          chargeAmount,
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

    markOrderDelivered(order, deliveryNote);
    await service.save();

    // Notify client via message
    const conversation = await findServiceConversation({ serviceId: service._id, orderId: order._id });
    if (conversation) {
      await postServiceSystemMessage({
        conversation,
        sender: req.user._id,
        recipient: order.client,
        content: `📦 Delivery submitted!\n\n${deliveryNote || 'Your order has been delivered. Please review and mark complete when satisfied.'}\n\nIf you're happy with the work, click "Mark Complete" to release payment. If you need changes, click "Request Revision".`,
        type: 'delivery_submitted',
        serviceId: service._id,
        orderId: order._id,
      });
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
    markOrderCompleted(order);
    await service.save();

    // Update payment record
    await markPaymentCompletedByIntent(order.stripePaymentIntentId);

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
    const conversation = await findServiceConversation({ serviceId: service._id, orderId: order._id });
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

    const roleCheck = ensureRole({
      isClient: String(order.client) === String(req.user._id),
      isFreelancer: String(service.freelancer) === String(req.user._id),
    }, 'client');
    if (!roleCheck.ok) return res.status(403).json({ error: roleCheck.error });

    const statusCheck = ensureOrderStatus(order, ['delivered'], 'Can only request revision on delivered orders');
    if (!statusCheck.ok) return res.status(400).json({ error: statusCheck.error });

    markOrderRevisionRequested(order);
    await service.save();

    const conversation = await findServiceConversation({ serviceId: service._id, orderId: order._id });
    if (conversation) {
      await postServiceSystemMessage({
        conversation,
        sender: req.user._id,
        recipient: service.freelancer,
        content: `🔄 Revision Requested (revision #${order.revisionCount})\n\n${note || 'Please review the requirements and resubmit.'}`,
        type: 'revision_requested',
        serviceId: service._id,
        orderId: order._id,
      });
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
    const ctx = await loadServiceOrderContext({
      Service,
      serviceId: req.params.id,
      orderId: req.params.orderId,
      userId: req.user._id,
      populate: { path: 'freelancer', select: 'firstName lastName email' },
    });

    if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

    const { service, order, isClient, isFreelancer } = ctx;
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

    markOrderCancelled(order);
    await service.save();

    // Update payment record
    await markPaymentRefundedByIntent(order.stripePaymentIntentId);

    // Post cancellation message
    const conv = await findServiceConversation({ serviceId: service._id, orderId: order._id });
    if (conv) {
      await postServiceSystemMessage({
        conversation: conv,
        sender: req.user._id,
        recipient: isClient ? service.freelancer._id : order.client,
        content: `❌ Order cancelled by ${isClient ? 'the client' : 'the freelancer'}.${refunded ? ' A full refund has been issued.' : ''}`,
        type: 'order_cancelled',
        serviceId: service._id,
        orderId: order._id,
      });
    }

    res.json({ message: 'Order cancelled', refunded });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// ── PUT /api/services/:id/orders/:orderId/remind ───────────────
// Freelancer sends a payment reminder to the client
router.put('/:id/orders/:orderId/remind', authenticateToken, async (req, res) => {
  try {
    const ctx = await loadServiceOrderContext({
      Service,
      serviceId: req.params.id,
      orderId: req.params.orderId,
      userId: req.user._id,
    });

    if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

    const { service, order, isFreelancer } = ctx;

    const roleCheck = ensureRole({ isClient: false, isFreelancer }, 'freelancer');
    if (!roleCheck.ok) return res.status(403).json({ error: roleCheck.error });

    const statusCheck = ensureOrderStatus(order, ['pending'], 'Order is not awaiting payment');
    if (!statusCheck.ok) return res.status(400).json({ error: statusCheck.error });

    const conv = await findServiceConversation({
      serviceId: service._id,
      participants: [service.freelancer, order.client],
    });
    if (conv) {
      const note = req.body.message?.trim();
      await postServiceSystemMessage({
        conversation: conv,
        sender: req.user._id,
        recipient: order.client,
        content: `🔔 Payment Reminder\n\nHi! Just a friendly reminder that your order for "${service.title}" is awaiting payment to get started.${note ? `\n\n${note}` : ''}`,
        type: 'payment_reminder',
        serviceId: service._id,
        orderId: order._id,
      });
    }

    await notifyServiceEvent({
      recipient: order.client,
      title: 'Payment reminder',
      message: `Your order for "${service.title}" is awaiting payment.`,
      serviceId: service._id,
    });

    res.json({ message: 'Reminder sent' });
  } catch (err) {
    console.error('Error sending reminder:', err);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

// ── GET /api/services/:id/orders/:orderId ──────────────────────
router.get('/:id/orders/:orderId', authenticateToken, async (req, res) => {
  try {
    const ctx = await loadServiceOrderContext({
      Service,
      serviceId: req.params.id,
      orderId: req.params.orderId,
      userId: req.user._id,
      populate: { path: 'freelancer', select: 'firstName lastName profilePicture stripeAccountId' },
    });

    if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

    const { service, order, isClient, isFreelancer } = ctx;
    if (!isClient && !isFreelancer) return res.status(403).json({ error: 'Unauthorized' });
    // Convert subdocument to plain object so _id serialises as a string
    const orderPlain = { ...order.toObject(), _id: String(order._id) };
    res.json({ order: orderPlain, service: { _id: String(service._id), title: service.title, freelancer: service.freelancer } });
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

    // Helper: flatten subdocument to plain object with _id as string
    const flatOrder = (o) => ({
      ...o.toObject(),
      _id:    String(o._id),
      client: String(o.client),
    });

    let orders = [];
    if (role === 'client') {
      const services = await Service.find({ 'orders.client': userId })
        .populate('freelancer', 'firstName lastName profilePicture');
      services.forEach(s => {
        s.orders.filter(o => String(o.client) === String(userId)).forEach(o => {
          orders.push({
            service: { _id: String(s._id), title: s.title, freelancer: s.freelancer },
            order:   flatOrder(o),
          });
        });
      });
    } else {
      const services = await Service.find({ freelancer: userId, 'orders.0': { $exists: true } })
        .populate('orders.client', 'firstName lastName profilePicture');
      services.forEach(s => {
        s.orders.forEach(o => {
          orders.push({
            service: { _id: String(s._id), title: s.title },
            order:   flatOrder(o),
          });
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

// ─────────────────────────────────────────────────────────────────────────────
// PREPAID BUNDLE PURCHASES
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /api/services/:id/bundle/purchase ────────────────────────────────────
// Client buys a prepaid session bundle. Returns clientSecret to confirm payment.
router.post('/:id/bundle/purchase', authenticateToken, async (req, res) => {
  try {
    const { bundleId } = req.body;
    if (!bundleId) return res.status(400).json({ error: 'bundleId is required' });

    const lookup = await loadActiveService({
      Service,
      serviceId: req.params.id,
      populate: { path: 'freelancer', select: 'firstName lastName email stripeAccountId' },
    });
    if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });
    const { service } = lookup;

    const selfCheck = ensureNotSelfService(service.freelancer._id, req.user.userId);
    if (!selfCheck.ok) {
      return res.status(400).json({ error: 'Cannot purchase your own bundle' });
    }

    const bundle = service.bundles?.id(bundleId);
    if (!bundle || !bundle.active) {
      return res.status(404).json({ error: 'Bundle not found or unavailable' });
    }

    const listedPrice  = bundle.price;
    // Bundle-level feesIncluded overrides service-level if explicitly set
    const feesIncluded = bundle.feesIncluded !== null && bundle.feesIncluded !== undefined
      ? bundle.feesIncluded
      : service.feesIncluded === true;

    let clientCharges, totalPlatformFee, freelancerTotal, clientFeeAmt, freelancerFeeAmt;
    if (feesIncluded) {
      const feeResult  = await getFeeIncluded({ userId: String(req.user.userId), role: 'client', jobType: 'remote', listedPrice });
      clientCharges    = feeResult.clientCharges;
      totalPlatformFee = feeResult.totalPlatformFee;
      freelancerTotal  = feeResult.freelancerPayout;
      clientFeeAmt     = feeResult.clientFee;
      freelancerFeeAmt = feeResult.freelancerFee;
    } else {
      const clientFeeResult     = await getFee({ userId: String(req.user.userId),           role: 'client',     jobType: 'remote', amount: listedPrice });
      const freelancerFeeResult = await getFee({ userId: String(service.freelancer._id),    role: 'freelancer', jobType: 'remote', amount: listedPrice });
      clientFeeAmt     = clientFeeResult.fee;
      freelancerFeeAmt = freelancerFeeResult.fee;
      clientCharges    = parseFloat((listedPrice + clientFeeAmt).toFixed(2));
      freelancerTotal  = parseFloat((listedPrice - freelancerFeeAmt).toFixed(2));
      totalPlatformFee = parseFloat((clientFeeAmt + freelancerFeeAmt).toFixed(2));
    }
    const perSessionPayout = parseFloat((freelancerTotal / bundle.sessions).toFixed(2));

    // Create PaymentIntent — funds captured immediately, held in platform balance
    const paymentIntent = await stripeService.chargeForJob(clientCharges, 'usd', {
      type:          'bundle_purchase',
      serviceId:     String(service._id),
      clientId:      String(req.user.userId),
      freelancerId:  String(service.freelancer._id),
      bundleId:      String(bundle._id),
      sessionsTotal: String(bundle.sessions),
    });

    // Compute optional expiry
    const expiresAt = bundle.expiresInDays
      ? new Date(Date.now() + bundle.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Pre-create session slots
    const BundlePurchase = require('../models/BundlePurchase');
    const sessionSlots = Array.from({ length: bundle.sessions }, () => ({ status: 'pending' }));

    const purchase = await BundlePurchase.create({
      service:               service._id,
      client:                req.user.userId,
      freelancer:            service.freelancer._id,
      bundleName:            bundle.name,
      sessionsTotal:         bundle.sessions,
      baseAmount:            listedPrice,
      clientFee:             clientFeeAmt,
      freelancerFee:         freelancerFeeAmt,
      totalPlatformFee,
      clientCharges,
      freelancerTotal,
      perSessionPayout,
      stripePaymentIntentId: paymentIntent.id,
      status:                'pending',
      sessions:              sessionSlots,
      sessionsRemaining:     bundle.sessions,
      expiresAt,
    });

    // Notify freelancer
    const clientUser = await User.findById(req.user.userId).select('firstName lastName');
    await notifyServiceEvent({
      recipient: service.freelancer._id,
      title: 'Bundle purchased',
      message: `${clientUser?.firstName} ${clientUser?.lastName} purchased your "${bundle.name}" bundle for "${service.title}"`,
      serviceId: service._id,
    });

    res.status(201).json({
      message:         'Bundle purchase initiated — complete payment to activate',
      purchaseId:      purchase._id,
      clientSecret:    paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      bundleName:      bundle.name,
      sessions:        bundle.sessions,
      amountCharged:   clientCharges,
      platformFee:     totalPlatformFee,
      perSessionPayout,
      expiresAt,
    });
  } catch (err) {
    console.error('Error purchasing bundle:', err);
    res.status(500).json({ error: 'Failed to purchase bundle' });
  }
});

// ── POST /api/services/bundles/:purchaseId/sessions/:sessionIndex/complete ───
// Freelancer marks a session as complete → triggers partial payout transfer.
router.post('/bundles/:purchaseId/sessions/:sessionIndex/complete', authenticateToken, async (req, res) => {
  try {
    const { notes } = req.body;
    const BundlePurchase = require('../models/BundlePurchase');
    const purchase = await BundlePurchase.findById(req.params.purchaseId);
    if (!purchase) return res.status(404).json({ error: 'Bundle purchase not found' });

    if (String(purchase.freelancer) !== String(req.user.userId)) {
      return res.status(403).json({ error: 'Only the freelancer can mark sessions complete' });
    }
    if (purchase.status !== 'active') {
      return res.status(400).json({ error: 'Bundle is not active' });
    }

    // Check expiry
    if (purchase.expiresAt && new Date() > purchase.expiresAt) {
      purchase.status = 'expired';
      await purchase.save();
      return res.status(400).json({ error: 'Bundle has expired' });
    }

    const idx = parseInt(req.params.sessionIndex, 10);
    const session = purchase.sessions[idx];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'pending') {
      return res.status(400).json({ error: 'Session is already completed or cancelled' });
    }

    // Mark session complete
    session.status      = 'completed';
    session.completedAt = new Date();
    session.notes       = notes?.trim() || '';
    session.freelancerPaid = purchase.perSessionPayout;

    // Transfer this session's payout to freelancer
    const freelancer = await User.findById(purchase.freelancer).select('stripeAccountId');
    if (freelancer?.stripeAccountId && purchase.perSessionPayout > 0) {
      const transfer = await stripeService.releasePayment(
        purchase.perSessionPayout,
        freelancer.stripeAccountId,
        purchase.stripePaymentIntentId
      );
      session.stripeTransferId = transfer.id;
    }

    await purchase.save();

    // Notify client
    await notifyServiceEvent({
      recipient: purchase.client,
      title: 'Session completed',
      message: `Your session ${idx + 1} of ${purchase.sessionsTotal} has been marked complete`,
      link: `/services/bundles/${purchase._id}`,
    });

    res.json({
      message:           'Session marked complete',
      sessionIndex:      idx,
      sessionsCompleted: purchase.sessionsCompleted,
      sessionsRemaining: purchase.sessionsRemaining,
      paidOut:           purchase.perSessionPayout,
      bundleStatus:      purchase.status,
    });
  } catch (err) {
    console.error('Error completing session:', err);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// ── GET /api/services/bundles/me ─────────────────────────────────────────────
// List bundle purchases for current user (client or freelancer view).
router.get('/bundles/me', authenticateToken, async (req, res) => {
  try {
    const { role = 'client' } = req.query;
    const BundlePurchase = require('../models/BundlePurchase');
    const filter = role === 'freelancer'
      ? { freelancer: req.user.userId }
      : { client: req.user.userId };

    const purchases = await BundlePurchase.find(filter)
      .populate('service',    'title category')
      .populate('client',     'firstName lastName avatar')
      .populate('freelancer', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ bundles: purchases });
  } catch (err) {
    console.error('Error fetching bundles:', err);
    res.status(500).json({ error: 'Failed to fetch bundles' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RECURRING SERVICE SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /api/services/:id/subscribe ─────────────────────────────────────────
// Client subscribes to a recurring service.
// Returns clientSecret for frontend to confirm payment method.
router.post('/:id/subscribe', authenticateToken, async (req, res) => {
  try {
    const { tier = 'basic' } = req.body;

    const lookup = await loadActiveService({
      Service,
      serviceId: req.params.id,
      populate: { path: 'freelancer', select: 'firstName lastName email stripeAccountId' },
    });
    if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });
    const { service } = lookup;

    if (service.serviceType !== 'recurring') {
      return res.status(400).json({ error: 'This service is not a recurring service. Use /order instead.' });
    }

    const selfCheck = ensureNotSelfService(service.freelancer._id, req.user.userId);
    if (!selfCheck.ok) {
      return res.status(400).json({ error: 'Cannot subscribe to your own service' });
    }

    // Check for existing active subscription
    const existing = await ServiceSubscription.findOne({
      service: service._id,
      client:  req.user.userId,
      status:  { $in: ['pending', 'active'] },
    });
    if (existing) {
      return res.status(409).json({ error: 'You already have an active subscription to this service' });
    }

    const selectedPackage = service.pricing[tier];
    if (!selectedPackage) return res.status(400).json({ error: 'Invalid tier selected' });

    const billingCycle = service.recurring?.billingCycle || 'monthly';
    const listedPrice  = selectedPackage.price;
    const feesIncluded = service.feesIncluded === true;

    let clientCharges, freelancerPayout, totalPlatformFee, platformFeeRate;
    if (feesIncluded) {
      const feeResult  = await getFeeIncluded({ userId: String(req.user.userId), role: 'client', jobType: 'remote', listedPrice });
      clientCharges    = feeResult.clientCharges;
      freelancerPayout = feeResult.freelancerPayout;
      totalPlatformFee = feeResult.totalPlatformFee;
      platformFeeRate  = feeResult.freelancerFee / feeResult.base;
    } else {
      const clientFeeResult     = await getFee({ userId: String(req.user.userId),           role: 'client',     jobType: 'remote', amount: listedPrice });
      const freelancerFeeResult = await getFee({ userId: String(service.freelancer._id),    role: 'freelancer', jobType: 'remote', amount: listedPrice });
      clientCharges    = parseFloat((listedPrice + clientFeeResult.fee).toFixed(2));
      freelancerPayout = parseFloat((listedPrice - freelancerFeeResult.fee).toFixed(2));
      totalPlatformFee = parseFloat((clientFeeResult.fee + freelancerFeeResult.fee).toFixed(2));
      platformFeeRate  = freelancerFeeResult.feeRate;
    }

    // Ensure client has a Stripe Customer ID
    const clientUser = await User.findById(req.user.userId);
    const stripeCustomerId = await stripeService.ensureCustomer(clientUser);
    if (!clientUser.stripeCustomerId) {
      clientUser.stripeCustomerId = stripeCustomerId;
      await clientUser.save();
    }

    // Create Stripe Product + Price (or reuse existing from service)
    let stripeProductId = service.stripeProductId;
    let stripePriceId;

    if (!stripeProductId) {
      const product = await stripeService.createServiceProduct(service);
      stripeProductId = product.id;
      service.stripeProductId = stripeProductId;
      await service.save();
    }

    const price = await stripeService.createServiceRecurringPrice({
      productId:    stripeProductId,
      amount:       clientCharges,
      billingCycle,
    });
    stripePriceId = price.id;

    // Create Stripe Subscription
    const stripeSub = await stripeService.createServiceSubscription({
      customerId: stripeCustomerId,
      priceId:    stripePriceId,
      metadata: {
        serviceId:       String(service._id),
        clientId:        String(req.user.userId),
        freelancerId:    String(service.freelancer._id),
        tier,
        billingCycle,
        platformFeeRate: String(platformFeeRate),
      },
    });

    // Save ServiceSubscription to DB
    const serviceSub = await ServiceSubscription.create({
      service:              service._id,
      client:               req.user.userId,
      freelancer:           service.freelancer._id,
      tier,
      amountPerCycle:       clientCharges,   // what client pays each cycle
      billingCycle,
      stripeSubscriptionId: stripeSub.id,
      stripeProductId,
      stripePriceId,
      stripeCustomerId,
      status:               'pending',
      platformFeeRate:      platformFeeRate,
      platformFeeAmount:    totalPlatformFee,
      freelancerPayout,
    });

    // Notify freelancer
    await notifyServiceEvent({
      recipient: service.freelancer._id,
      title: 'New recurring subscription',
      message: `${clientUser.firstName} ${clientUser.lastName} subscribed to your "${service.title}" service`,
      serviceId: service._id,
    });

    res.status(201).json({
      message:              'Subscription created — confirm payment method to activate',
      subscriptionId:       serviceSub._id,
      stripeSubscriptionId: stripeSub.id,
      clientSecret:         stripeSub.latest_invoice?.payment_intent?.client_secret,
      amountPerCycle:       clientCharges,
      billingCycle,
      platformFee:          totalPlatformFee,
      feeDisplay:           getFeeDisplay({ fee: clientFeeResult.fee, feeRate: clientFeeResult.feeRate, jobType: 'remote', role: 'client' }),
    });
  } catch (err) {
    console.error('Error creating service subscription:', err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// ── GET /api/services/subscriptions/me ───────────────────────────────────────
// List all recurring subscriptions for the current user (as client or freelancer).
router.get('/subscriptions/me', authenticateToken, async (req, res) => {
  try {
    const { role = 'client' } = req.query;
    const filter = role === 'freelancer'
      ? { freelancer: req.user.userId }
      : { client: req.user.userId };

    const subs = await ServiceSubscription.find(filter)
      .populate('service', 'title category pricing serviceType')
      .populate('client',     'firstName lastName avatar')
      .populate('freelancer', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ subscriptions: subs });
  } catch (err) {
    console.error('Error fetching subscriptions:', err);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// ── DELETE /api/services/subscriptions/:subId ─────────────────────────────────
// Cancel a recurring service subscription.
router.delete('/subscriptions/:subId', authenticateToken, async (req, res) => {
  try {
    const sub = await ServiceSubscription.findById(req.params.subId);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    // Only client or freelancer can cancel
    const isClient     = String(sub.client)     === String(req.user.userId);
    const isFreelancer = String(sub.freelancer)  === String(req.user.userId);
    if (!isClient && !isFreelancer) return res.status(403).json({ error: 'Forbidden' });

    if (['cancelled', 'completed'].includes(sub.status)) {
      return res.status(400).json({ error: 'Subscription is already cancelled' });
    }

    // Cancel in Stripe
    if (sub.stripeSubscriptionId) {
      await stripeService.cancelServiceSubscriptionNow(sub.stripeSubscriptionId);
    }

    sub.status      = 'cancelled';
    sub.cancelledAt = new Date();
    sub.cancelReason = isClient ? 'client_cancelled' : 'freelancer_cancelled';
    await sub.save();

    // Notify the other party
    const cancellerName = isClient ? 'The client' : 'The freelancer';
    const notifyUserId  = isClient ? sub.freelancer : sub.client;
    const service = await Service.findById(sub.service).select('title');
    await notifyServiceEvent({
      recipient: notifyUserId,
      title: 'Subscription cancelled',
      message: `${cancellerName} cancelled the recurring subscription to "${service?.title || 'your service'}"`,
      link: `/services/${sub.service}`,
    });

    res.json({ message: 'Subscription cancelled', subscriptionId: sub._id });
  } catch (err) {
    console.error('Error cancelling subscription:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;
