const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const { Message, Conversation } = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');
const { validateJobPost, validateProposal, validateQueryParams, validateMongoId } = require('../middleware/validation');
const { uploadJobAttachments } = require('../middleware/upload');

router.get('/', validateQueryParams, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filters = {
      isActive: true,
      status: 'open',
      expiresAt: { $gt: new Date() }
    };
    
    if (req.query.category && req.query.category !== 'all') {
      filters.category = req.query.category;
    }
    
    if (req.query.skills) {
      const skills = req.query.skills.split(',').map(skill => skill.trim());
      filters.skills = { $in: skills };
    }
    
    if (req.query.minBudget || req.query.maxBudget) {
      filters['budget.amount'] = {};
      if (req.query.minBudget) {
        filters['budget.amount'].$gte = parseFloat(req.query.minBudget);
      }
      if (req.query.maxBudget) {
        filters['budget.amount'].$lte = parseFloat(req.query.maxBudget);
      }
    }
    
    if (req.query.experienceLevel && req.query.experienceLevel !== 'all') {
      filters.experienceLevel = req.query.experienceLevel;
    }
    
    if (req.query.duration && req.query.duration !== 'all') {
      filters.duration = req.query.duration;
    }
    
    if (req.query.location) {
      const locationFilters = [
        { location: { $regex: req.query.location, $options: 'i' } }
      ];
      if (req.query.location.toLowerCase().includes('remote')) {
        locationFilters.push({ isRemote: true });
      }
      filters.$or = filters.$or ? [...filters.$or, ...locationFilters] : locationFilters;
    }

    if (req.query.workType && req.query.workType !== 'all') {
      if (req.query.workType === 'remote') {
        filters.isRemote = true;
      } else if (req.query.workType === 'onsite') {
        filters.isRemote = false;
      }
    }

    if (req.query.datePosted && req.query.datePosted !== 'all') {
      const now = new Date();
      let dateFilter;
      switch (req.query.datePosted) {
        case 'today':
          dateFilter = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          dateFilter = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          dateFilter = new Date(now.setMonth(now.getMonth() - 1));
          break;
      }
      if (dateFilter) {
        filters.createdAt = { $gte: dateFilter };
      }
    }

    if (req.query.urgentOnly === 'true') {
      filters.isUrgent = true;
    }

    if (req.query.featuredOnly === 'true') {
      filters.isFeatured = true;
    }

    if (req.query.search) {
      const searchTerms = req.query.search.split(' ').filter(term => term.length > 0);
      const searchFilters = [];
      
      searchTerms.forEach(term => {
        searchFilters.push(
          { title: { $regex: term, $options: 'i' } },
          { description: { $regex: term, $options: 'i' } },
          { skills: { $in: [new RegExp(term, 'i')] } },
          { category: { $regex: term, $options: 'i' } }
        );
      });
      
      filters.$or = filters.$or ? [...filters.$or, ...searchFilters] : searchFilters;
    }

    let sortOptions = { createdAt: -1, isFeatured: -1, isUrgent: -1 };
    if (req.query.sortBy) {
      switch (req.query.sortBy) {
        case 'oldest':
          sortOptions = { createdAt: 1 };
          break;
        case 'budget_high':
          sortOptions = { 'budget.amount': -1 };
          break;
        case 'budget_low':
          sortOptions = { 'budget.amount': 1 };
          break;
        case 'most_proposals':
          sortOptions = { proposalCount: -1 };
          break;
        case 'least_proposals':
          sortOptions = { proposalCount: 1 };
          break;
        default:
          sortOptions = { createdAt: -1, isFeatured: -1, isUrgent: -1 };
      }
    }
    
    const jobs = await Job.find(filters)
      .populate('client', 'firstName lastName profilePicture rating totalJobs')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);
    
    const total = await Job.countDocuments(filters);
    
    res.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

router.get('/:id', validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('client', 'firstName lastName profilePicture rating totalJobs memberSince')
      .populate('freelancer', 'firstName lastName profilePicture rating totalJobs')
      .populate('proposals.freelancer', 'firstName lastName profilePicture rating totalJobs');
    
    if (!job || !job.isActive) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    await job.incrementViews();
    
    res.json({ job });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

router.post('/', authenticateToken, validateJobPost, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      subcategory,
      skills,
      budget,
      duration,
      experienceLevel,
      location,
      isRemote,
      isUrgent
    } = req.body;
    
    const job = new Job({
      title,
      description,
      category,
      subcategory,
      skills: skills || [],
      budget,
      duration,
      experienceLevel,
      location: location || 'Remote',
      isRemote: isRemote !== false,
      isUrgent: isUrgent || false,
      client: req.user._id,
      status: 'open'
    });
    
    await job.save();
    
    const populatedJob = await Job.findById(job._id)
      .populate('client', 'firstName lastName profilePicture rating totalJobs');
    
    res.status(201).json({
      message: 'Job posted successfully',
      job: populatedJob
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

router.put('/:id', authenticateToken, validateMongoId, validateJobPost, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to edit this job' });
    }
    
    if (job.status !== 'draft' && job.status !== 'open') {
      return res.status(400).json({ error: 'Cannot edit job in current status' });
    }
    
    const allowedUpdates = [
      'title', 'description', 'category', 'subcategory', 'skills',
      'budget', 'duration', 'experienceLevel', 'location', 'isRemote', 'isUrgent'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        job[field] = req.body[field];
      }
    });
    
    await job.save();
    
    const populatedJob = await Job.findById(job._id)
      .populate('client', 'firstName lastName profilePicture rating totalJobs');
    
    res.json({
      message: 'Job updated successfully',
      job: populatedJob
    });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

router.delete('/:id', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this job' });
    }
    
    if (job.status === 'in_progress') {
      return res.status(400).json({ error: 'Cannot delete job in progress' });
    }
    
    job.isActive = false;
    job.status = 'cancelled';
    await job.save();
    
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

router.post('/:id/proposals', authenticateToken, uploadJobAttachments, validateMongoId, validateProposal, async (req, res) => {
  try {
    const { coverLetter, proposedBudget, proposedDuration } = req.body;
    
    const job = await Job.findById(req.params.id);
    
    if (!job || !job.isActive || job.status !== 'open') {
      return res.status(404).json({ error: 'Job not found or not accepting proposals' });
    }
    
    if (job.client.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot apply to your own job' });
    }
    
    const existingProposal = job.proposals.find(
      p => p.freelancer.toString() === req.user._id.toString()
    );
    
    if (existingProposal) {
      return res.status(400).json({ error: 'You have already submitted a proposal for this job' });
    }

    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      url: `/uploads/${file.filename}`,
      size: file.size
    })) : [];
    
    const proposal = {
      freelancer: req.user._id,
      coverLetter,
      proposedBudget: parseFloat(proposedBudget),
      proposedDuration,
      attachments
    };
    
    await job.addProposal(proposal);
    
    console.log('DEBUG: Starting notification system for proposal submission');
    console.log('DEBUG: job.client:', job.client);
    console.log('DEBUG: req.user._id:', req.user._id);
    
    let conversation = await Conversation.findByParticipants(job.client, req.user._id);
    console.log('DEBUG: Found existing conversation:', conversation);
    
    if (!conversation) {
      console.log('DEBUG: Creating new conversation');
      conversation = new Conversation({
        participants: [job.client, req.user._id],
        job: job._id
      });
      await conversation.save();
      console.log('DEBUG: New conversation created:', conversation._id);
    }
    
    console.log('DEBUG: Creating system message');
    const systemMessage = new Message({
      conversation: conversation._id,
      sender: req.user._id,
      recipient: job.client,
      content: `🔔 New Proposal Received for "${job.title}"\n\nFreelancer: ${req.user.firstName} ${req.user.lastName}\nProposed Budget: $${proposedBudget}\nTimeline: ${proposedDuration}\nSubmitted: ${new Date().toLocaleString()}\n\nCover Letter:\n${coverLetter}`,
      messageType: 'system'
    });
    
    await systemMessage.save();
    console.log('DEBUG: System message saved:', systemMessage._id);
    
    conversation.lastMessage = systemMessage._id;
    await conversation.updateLastActivity();
    console.log('DEBUG: Conversation updated with last message');
    
    const updatedJob = await Job.findById(job._id)
      .populate('proposals.freelancer', 'firstName lastName profilePicture rating totalJobs');
    
    const emailService = require('../services/emailService');
    const User = require('../models/User');
    const client = await User.findById(job.client);
    if (client) {
      await emailService.sendJobNotification(client, job, 'new_proposal');
    }

    res.status(201).json({
      message: 'Proposal submitted successfully',
      proposal: updatedJob.proposals[updatedJob.proposals.length - 1],
      conversationCreated: !conversation.lastMessage || conversation.lastMessage.toString() === systemMessage._id.toString()
    });
  } catch (error) {
    console.error('Error submitting proposal:', error);
    res.status(500).json({ error: 'Failed to submit proposal' });
  }
});

router.get('/:id/proposals', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('proposals.freelancer', 'firstName lastName profilePicture rating totalJobs');
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to view proposals' });
    }
    
    res.json({ proposals: job.proposals });
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

module.exports = router;
