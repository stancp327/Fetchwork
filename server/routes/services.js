const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const { Message, Conversation } = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');

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
    
    if (req.query.search) {
      filters.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { skills: { $in: [new RegExp(req.query.search, 'i')] } }
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
      requirements
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

router.post('/:id/order', authenticateToken, async (req, res) => {
  try {
    const { package, requirements } = req.body;
    
    if (!package || !['basic', 'standard', 'premium'].includes(package)) {
      return res.status(400).json({ error: 'Valid package selection is required' });
    }
    
    const service = await Service.findById(req.params.id);
    
    if (!service || !service.isActive || service.status !== 'active') {
      return res.status(404).json({ error: 'Service not found or not available' });
    }
    
    if (service.freelancer.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot order your own service' });
    }
    
    const selectedPackage = service.pricing[package];
    if (!selectedPackage) {
      return res.status(400).json({ error: 'Selected package not available' });
    }
    
    const order = {
      client: req.user._id,
      package,
      status: 'pending',
      price: selectedPackage.price
    };
    
    await service.addOrder(order);
    
    let conversation = await Conversation.findByParticipants(service.freelancer, req.user._id);
    
    if (!conversation) {
      conversation = new Conversation({
        participants: [service.freelancer, req.user._id],
        service: service._id
      });
      await conversation.save();
    }
    
    const systemMessage = new Message({
      conversation: conversation._id,
      sender: req.user._id,
      recipient: service.freelancer,
      content: `🛒 New Service Order: "${service.title}"\n\nPackage: ${selectedPackage.title}\nPrice: $${selectedPackage.price}\nDelivery: ${selectedPackage.deliveryTime} days\nOrdered: ${new Date().toLocaleString()}\n\n${requirements ? `Requirements:\n${requirements}` : ''}`,
      messageType: 'system'
    });
    
    await systemMessage.save();
    conversation.lastMessage = systemMessage._id;
    await conversation.updateLastActivity();
    
    res.status(201).json({
      message: 'Service ordered successfully',
      order: service.orders[service.orders.length - 1]
    });
  } catch (error) {
    console.error('Error ordering service:', error);
    res.status(500).json({ error: 'Failed to order service' });
  }
});

module.exports = router;
