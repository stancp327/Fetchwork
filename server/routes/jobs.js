const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const { Message, Conversation } = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');
const { validateJobPost, validateProposal, validateQueryParams, validateMongoId } = require('../middleware/validation');
const { uploadJobAttachments } = require('../middleware/upload');
const { geocode, nearSphereQuery } = require('../config/geocoding');
const { escapeRegex } = require('../utils/sanitize');
const { trackEvent } = require('../middleware/analytics');
const Notification = require('../models/Notification');
const stripeService = require('../services/stripeService');
const Payment = require('../models/Payment');

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
    
    if (req.query.workLocation && req.query.workLocation !== 'all') {
      switch (req.query.workLocation) {
        case 'remote':
          filters['location.locationType'] = 'remote';
          break;
        case 'local':
          filters['location.locationType'] = 'local';
          break;
        case 'hybrid':
          filters['location.locationType'] = 'hybrid';
          break;
      }
    }

    // Distance-based search: ?near=94520&radius=25 or ?near=Concord,CA&radius=50
    let geoSearchCoords = null;
    let geoSearchRadius = 25;
    if (req.query.near && req.query.near.trim() !== '') {
      geoSearchRadius = parseInt(req.query.radius) || 25;
      const coords = await geocode(req.query.near.trim());
      if (coords) {
        geoSearchCoords = coords;
        // Don't add nearSphere to filters — we'll use $geoNear aggregation instead
        if (!filters['location.locationType']) {
          filters['location.locationType'] = { $in: ['local', 'hybrid'] };
        }
      }
    }

    if (req.query.zipCode && req.query.zipCode.trim() !== '') {
      // Exact zip match (no distance calc) — fast filter
      filters['location.zipCode'] = req.query.zipCode.trim();
    }

    if (req.query.specificLocation && req.query.specificLocation.trim() !== '') {
      const locationQuery = req.query.specificLocation.trim();
      if (locationQuery.toLowerCase() === 'remote') {
        filters['location.locationType'] = 'remote';
      } else {
        filters.$or = filters.$or || [];
        filters.$or.push(
          { 'location.address': { $regex: locationQuery, $options: 'i' } },
          { 'location.city': { $regex: locationQuery, $options: 'i' } },
          { 'location.state': { $regex: locationQuery, $options: 'i' } },
          { 'location.zipCode': { $regex: locationQuery, $options: 'i' } }
        );
      }
    }

    if (req.query.jobType && req.query.jobType !== 'all') {
      filters.jobType = req.query.jobType;
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
        const safeTerm = escapeRegex(term);
        searchFilters.push(
          { title: { $regex: safeTerm, $options: 'i' } },
          { description: { $regex: safeTerm, $options: 'i' } },
          { skills: { $in: [new RegExp(safeTerm, 'i')] } },
          { category: { $regex: safeTerm, $options: 'i' } }
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
    
    let jobs, total;

    if (geoSearchCoords) {
      // Use $geoNear aggregation for distance calculation + sorting
      try {
        const maxDistMeters = geoSearchRadius * 1609.34; // miles to meters
        // Exclude default [0,0] coordinates from geo query
        const geoFilters = { ...filters, 'location.coordinates.coordinates': { $ne: [0, 0] } };
        const pipeline = [
          {
            $geoNear: {
              near: { type: 'Point', coordinates: geoSearchCoords },
              distanceField: 'distanceMeters',
              maxDistance: maxDistMeters,
              spherical: true,
              query: geoFilters,
              key: 'location.coordinates'
            }
          },
          { $addFields: { distanceMiles: { $round: [{ $divide: ['$distanceMeters', 1609.34] }, 1] } } }
        ];

        // Sort by distance by default for geo queries, unless user specified otherwise
        if (!req.query.sortBy || req.query.sortBy === 'distance') {
          pipeline.push({ $sort: { distanceMeters: 1 } });
        } else {
          pipeline.push({ $sort: sortOptions });
        }

        const countPipeline = [...pipeline, { $count: 'total' }];
        pipeline.push({ $skip: skip }, { $limit: limit });

        const [results, countResult] = await Promise.all([
          Job.aggregate(pipeline),
          Job.aggregate(countPipeline)
        ]);

        jobs = await Job.populate(results, { path: 'client', select: 'firstName lastName profilePicture rating totalJobs' });
        total = countResult[0]?.total || 0;
      } catch (geoErr) {
        // Fallback: use $nearSphere filter (no distance in response, but works)
        console.error('$geoNear failed, falling back to $nearSphere:', geoErr.message);
        const { nearSphereQuery } = require('../config/geocoding');
        filters['location.coordinates'] = nearSphereQuery(geoSearchCoords, geoSearchRadius);
        [jobs, total] = await Promise.all([
          Job.find(filters)
            .populate('client', 'firstName lastName profilePicture rating totalJobs')
            .sort(sortOptions).skip(skip).limit(limit),
          Job.countDocuments(filters)
        ]);
      }
    } else {
      [jobs, total] = await Promise.all([
        Job.find(filters)
          .populate('client', 'firstName lastName profilePicture rating totalJobs')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit),
        Job.countDocuments(filters)
      ]);
    }
    
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

// Get current user's jobs (for invite-to-job flow)
router.get('/my-jobs', authenticateToken, async (req, res) => {
  try {
    const statusFilter = req.query.status || 'open';
    const jobs = await Job.find({
      client: req.user._id,
      status: statusFilter,
      isActive: true
    }).select('title status budget createdAt').sort({ createdAt: -1 }).limit(20);
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your jobs' });
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
      isRemote, // backward compat: accept old field
      isUrgent,
      jobType,
      deadline
    } = req.body;

    // Build location object — support both old format (string + isRemote) and new format (object)
    let locationData;
    if (location && typeof location === 'object' && location.locationType) {
      locationData = location;
    } else {
      // Backward compatibility: convert old string + isRemote to new format
      const isRemoteJob = isRemote !== false;
      locationData = {
        locationType: isRemoteJob ? 'remote' : 'local',
        address: (typeof location === 'string' && location !== 'Remote') ? location : '',
        city: '',
        state: '',
        zipCode: '',
        coordinates: { type: 'Point', coordinates: [0, 0] },
        serviceRadius: 25
      };
    }
    
    const job = new Job({
      title,
      description,
      category,
      subcategory,
      skills: skills || [],
      budget,
      duration,
      experienceLevel,
      location: locationData,
      deadline: deadline ? new Date(deadline) : null,
      isUrgent: isUrgent || false,
      jobType: jobType || 'freelance',
      client: req.user._id,
      status: 'open'
    });
    
    await job.save();
    
    const populatedJob = await Job.findById(job._id)
      .populate('client', 'firstName lastName profilePicture rating totalJobs');
    
    trackEvent('jobsPosted');
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
      'budget', 'duration', 'experienceLevel', 'location', 'isUrgent', 'jobType', 'deadline'
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
    
    // For in-progress jobs, check cancellation policy
    if (job.status === 'in_progress') {
      if (job.scheduledDate) {
        const hoursUntil = (job.scheduledDate - new Date()) / (1000 * 60 * 60);
        
        // Check if cancellation is allowed
        if (job.cancellationPolicy === 'strict' && hoursUntil < 0) {
          return res.status(400).json({ error: 'Cannot cancel a job after its scheduled time' });
        }
      }
      
      await job.cancelJob(req.body.reason);
      return res.json({
        message: 'Job cancelled',
        cancellationFee: job.cancellationFee,
        policy: job.cancellationPolicy
      });
    }
    
    job.isActive = false;
    job.status = 'cancelled';
    job.cancelledAt = new Date();
    job.cancellationReason = req.body.reason || 'Job cancelled';
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
    const emailWorkflowService = require('../services/emailWorkflowService');
    const User = require('../models/User');
    const client = await User.findById(job.client);
    if (client && await emailWorkflowService.canSendEmail(client._id, 'job_lifecycle', 'new_proposal')) {
      await emailService.sendJobNotification(client, job, 'new_proposal');
    }

    trackEvent('proposalsSent');
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

router.post('/:id/proposals/:proposalId/accept', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the client can accept proposals' });
    }
    
    if (job.status !== 'open') {
      return res.status(400).json({ error: 'Job is not open for proposals' });
    }
    
    const proposal = job.proposals.id(req.params.proposalId);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    await job.acceptProposal(req.params.proposalId, proposal.freelancer);
    
    res.json({
      message: 'Proposal accepted successfully',
      job: await Job.findById(job._id).populate('freelancer', 'firstName lastName')
    });
  } catch (error) {
    console.error('Error accepting proposal:', error);
    res.status(500).json({ error: 'Failed to accept proposal' });
  }
});

router.post('/:id/complete', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('client', 'firstName lastName').populate('freelancer', 'firstName lastName');
    
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.freelancer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the assigned freelancer can complete this job' });
    }
    if (job.status !== 'in_progress') {
      return res.status(400).json({ error: 'Job must be in progress to complete' });
    }
    
    await job.completeJob();
    trackEvent('jobsCompleted');

    const freelancerName = `${job.freelancer.firstName} ${job.freelancer.lastName}`.trim();

    // Post system message to the job conversation
    try {
      const conversation = await Conversation.findOne({ job: job._id });
      if (conversation) {
        const sysMsg = new Message({
          conversation: conversation._id,
          sender:    job.freelancer._id,
          recipient: job.client._id,
          content:   `✅ ${freelancerName} has marked this job as complete.\n\nPlease review the work and release payment when you're satisfied. Go to the job progress page to release funds.`,
          messageType: 'system',
          metadata: { type: 'job_completed', jobId: job._id }
        });
        await sysMsg.save();
        conversation.lastMessage = sysMsg._id;
        await conversation.updateLastActivity();
      }
    } catch (msgErr) {
      console.error('Failed to post completion message:', msgErr.message);
    }

    // Notify client
    try {
      await Notification.create({
        recipient: job.client._id,
        type: 'job_update',
        title: 'Job marked complete',
        message: `${freelancerName} has marked "${job.title}" as complete. Please review and release payment.`,
        relatedJob: job._id,
        actionUrl: `/jobs/${job._id}/progress`,
      });
    } catch (notifErr) {
      console.error('Failed to create completion notification:', notifErr.message);
    }
    
    res.json({ message: 'Job completed successfully', job: await Job.findById(job._id) });
  } catch (error) {
    console.error('Error completing job:', error);
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// ── POST /api/jobs/:id/refund ───────────────────────────────────
// Cancel an in-progress job and refund the client if payment was held.
// Either party can request; notifies the other.
router.post('/:id/refund', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const { reason } = req.body;
    const job = await Job.findById(req.params.id)
      .populate('client',     'firstName lastName')
      .populate('freelancer', 'firstName lastName');
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const isClient     = String(job.client._id)     === String(req.user._id);
    const isFreelancer = String(job.freelancer?._id) === String(req.user._id);
    if (!isClient && !isFreelancer) return res.status(403).json({ error: 'Unauthorized' });
    if (!['in_progress', 'open'].includes(job.status)) {
      return res.status(400).json({ error: 'Can only cancel in-progress or open jobs' });
    }

    let refunded = false;

    // Refund Stripe payment if funded
    if (job.stripePaymentIntentId && job.escrowAmount > 0) {
      try {
        await stripeService.refundPayment(job.stripePaymentIntentId, null, reason || 'requested_by_customer');
        refunded = true;
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: job.stripePaymentIntentId },
          { status: 'refunded' }
        );
      } catch (refErr) {
        return res.status(500).json({ error: 'Stripe refund failed: ' + refErr.message });
      }
    }

    job.status             = 'cancelled';
    job.cancelledAt        = new Date();
    job.cancellationReason = reason || 'Cancelled by ' + (isClient ? 'client' : 'freelancer');
    job.escrowAmount       = 0;
    job.isActive           = false;
    await job.save();

    const requesterName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'A party';

    // Post message to thread
    try {
      const conv = await Conversation.findOne({ job: job._id });
      if (conv) {
        const sysMsg = new Message({
          conversation: conv._id,
          sender:    req.user._id,
          recipient: isClient ? job.freelancer._id : job.client._id,
          content:   `❌ Job cancelled by ${requesterName}.\n${reason ? `Reason: ${reason}\n` : ''}${refunded ? '💸 A full refund has been issued to the client.' : ''}`,
          messageType: 'system',
          metadata: { type: 'job_cancelled', jobId: job._id }
        });
        await sysMsg.save();
        conv.lastMessage = sysMsg._id;
        await conv.updateLastActivity();
      }
    } catch (_) {}

    // Notify the other party
    try {
      const notifRecipient = isClient ? job.freelancer._id : job.client._id;
      await Notification.create({
        recipient:  notifRecipient,
        type:       'job_update',
        title:      'Job cancelled',
        message:    `${requesterName} cancelled "${job.title}".${refunded ? ' A refund has been issued.' : ''}`,
        relatedJob: job._id,
        actionUrl:  `/jobs/${job._id}`,
      });
    } catch (_) {}

    res.json({ message: 'Job cancelled', refunded });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// ── Milestone Payments ──────────────────────────────────────────

// POST /api/jobs/:id/milestones/:index/fund — client funds a specific milestone
router.post('/:id/milestones/:index/fund', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('freelancer', '_id firstName lastName');
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.client) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the client can fund milestones' });
    }

    const idx = parseInt(req.params.index);
    if (isNaN(idx) || idx < 0 || idx >= job.milestones.length) {
      return res.status(404).json({ error: 'Milestone not found' });
    }
    const milestone = job.milestones[idx];
    if (milestone.escrowAmount > 0) {
      return res.status(400).json({ error: 'This milestone is already funded' });
    }
    if (milestone.status === 'approved') {
      return res.status(400).json({ error: 'This milestone is already completed and paid' });
    }

    const paymentIntent = await stripeService.chargeForJob(milestone.amount, 'usd', {
      jobId:          String(job._id),
      milestoneIndex: String(idx),
      milestoneTitle: milestone.title,
      clientId:       String(req.user._id),
      freelancerId:   String(job.freelancer._id),
      type:           'milestone',
    });

    res.json({
      clientSecret:    paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      milestoneIndex:  idx,
      milestoneTitle:  milestone.title,
      amount:          milestone.amount,
    });
  } catch (error) {
    console.error('Error funding milestone:', error);
    res.status(500).json({ error: 'Failed to fund milestone' });
  }
});

// POST /api/jobs/:id/milestones/:index/fund/confirm — called after frontend confirms payment
router.post('/:id/milestones/:index/fund/confirm', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId required' });

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.client) !== String(req.user._id)) return res.status(403).json({ error: 'Unauthorized' });

    const idx = parseInt(req.params.index);
    const milestone = job.milestones[idx];
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    milestone.stripePaymentIntentId = paymentIntentId;
    milestone.escrowAmount          = milestone.amount;
    milestone.fundedAt              = new Date();
    await job.save();

    await Payment.create({
      job:           job._id,
      client:        req.user._id,
      freelancer:    job.freelancer,
      amount:        milestone.amount,
      type:          'escrow',
      status:        'processing',
      paymentMethod: 'stripe',
      stripePaymentIntentId: paymentIntentId,
      transactionId: paymentIntentId,
      platformFee:   Math.round(milestone.amount * 0.10 * 100) / 100,
    });

    // Notify freelancer
    await Notification.create({
      recipient:  job.freelancer,
      type:       'payment_received',
      title:      'Milestone funded',
      message:    `Milestone "${milestone.title}" has been funded ($${milestone.amount}).`,
      relatedJob: job._id,
      actionUrl:  `/jobs/${job._id}/progress`,
    });

    res.json({ message: 'Milestone funded', milestone: { ...milestone.toObject(), _id: String(milestone._id) } });
  } catch (error) {
    console.error('Error confirming milestone funding:', error);
    res.status(500).json({ error: 'Failed to confirm milestone funding' });
  }
});

// POST /api/jobs/:id/milestones/:index/release — client releases milestone payment
router.post('/:id/milestones/:index/release', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('freelancer', '_id firstName lastName stripeAccountId');
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.client) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the client can release milestone payments' });
    }

    const idx = parseInt(req.params.index);
    const milestone = job.milestones[idx];
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
    if (milestone.escrowAmount === 0) {
      return res.status(400).json({ error: 'This milestone has no funds to release' });
    }
    if (!['completed', 'approved'].includes(milestone.status)) {
      return res.status(400).json({ error: 'Milestone must be completed before releasing payment' });
    }
    if (!job.freelancer.stripeAccountId) {
      return res.status(400).json({ error: 'Freelancer has not connected their bank account yet' });
    }

    const platformFee = Math.round(milestone.amount * 0.10 * 100) / 100;
    const payoutAmt   = milestone.amount - platformFee;

    const transfer = await stripeService.releasePayment(
      payoutAmt,
      job.freelancer.stripeAccountId,
      milestone.stripePaymentIntentId
    );

    milestone.status      = 'approved';
    milestone.approvedAt  = new Date();
    milestone.releasedAt  = new Date();
    milestone.escrowAmount = 0;
    await job.save();

    await Payment.findOneAndUpdate(
      { stripePaymentIntentId: milestone.stripePaymentIntentId },
      { status: 'completed' }
    );

    await Payment.create({
      job:           job._id,
      client:        req.user._id,
      freelancer:    job.freelancer._id,
      amount:        payoutAmt,
      type:          'release',
      status:        'completed',
      paymentMethod: 'stripe',
      transactionId: transfer.id,
      platformFee,
    });

    // Notify freelancer
    await Notification.create({
      recipient:  job.freelancer._id,
      type:       'payment_received',
      title:      'Milestone payment released',
      message:    `$${payoutAmt.toFixed(2)} released for milestone "${milestone.title}".`,
      relatedJob: job._id,
      actionUrl:  `/jobs/${job._id}/progress`,
    });

    res.json({ message: 'Milestone payment released', payoutAmt, transfer: transfer.id });
  } catch (error) {
    console.error('Error releasing milestone payment:', error);
    res.status(500).json({ error: 'Failed to release milestone payment' });
  }
});

// ── Milestone Management ────────────────────────────────────────

// POST /api/jobs/:id/milestones — add milestones (client only)
router.post('/:id/milestones', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.client.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the client can manage milestones' });
    }

    const { milestones } = req.body;
    if (!Array.isArray(milestones) || milestones.length === 0) {
      return res.status(400).json({ error: 'At least one milestone is required' });
    }

    for (const m of milestones) {
      if (!m.title || m.amount === undefined) {
        return res.status(400).json({ error: 'Each milestone needs a title and amount' });
      }
      job.milestones.push({
        title: m.title,
        description: m.description || '',
        amount: m.amount,
        dueDate: m.dueDate || null,
        status: 'pending'
      });
    }

    // Add progress update
    job.progressUpdates.push({
      author: req.user.userId,
      type: 'update',
      message: `Added ${milestones.length} milestone${milestones.length > 1 ? 's' : ''}: ${milestones.map(m => m.title).join(', ')}`
    });

    await job.save();
    res.json({ message: 'Milestones added', job });
  } catch (error) {
    console.error('Error adding milestones:', error);
    res.status(500).json({ error: 'Failed to add milestones' });
  }
});

// PUT /api/jobs/:id/milestones/:index — update milestone status
router.put('/:id/milestones/:index', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = req.user.userId;
    const isClient = job.client.toString() === userId;
    const isFreelancer = job.freelancer?.toString() === userId;
    if (!isClient && !isFreelancer) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const idx = parseInt(req.params.index);
    if (idx < 0 || idx >= job.milestones.length) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const milestone = job.milestones[idx];
    const { status } = req.body;

    // Freelancer can mark as in_progress or completed
    if (isFreelancer && ['in_progress', 'completed'].includes(status)) {
      milestone.status = status;
      if (status === 'completed') milestone.completedAt = new Date();

      job.progressUpdates.push({
        author: userId,
        type: status === 'completed' ? 'milestone_completed' : 'status_change',
        message: `Milestone "${milestone.title}" marked as ${status.replace('_', ' ')}`,
        milestoneIndex: idx
      });
    }

    // Client can approve completed milestones
    if (isClient && status === 'approved' && milestone.status === 'completed') {
      milestone.status = 'approved';
      milestone.approvedAt = new Date();

      job.progressUpdates.push({
        author: userId,
        type: 'milestone_completed',
        message: `Approved milestone "${milestone.title}" — $${milestone.amount}`,
        milestoneIndex: idx
      });
    }

    // Client can request revision
    if (isClient && status === 'in_progress' && milestone.status === 'completed') {
      milestone.status = 'in_progress';
      milestone.completedAt = null;

      job.progressUpdates.push({
        author: userId,
        type: 'revision_requested',
        message: `Requested revision on milestone "${milestone.title}"${req.body.message ? ': ' + req.body.message : ''}`,
        milestoneIndex: idx
      });
    }

    await job.save();

    // Notify the other party about milestone status changes
    try {
      if (isFreelancer && status === 'completed') {
        await Notification.create({
          recipient: job.client,
          type: 'job_update',
          title: 'Milestone completed',
          message: `Milestone "${milestone.title}" has been marked complete on "${job.title}". Review and approve it.`,
          relatedJob: job._id,
          actionUrl: `/jobs/${job._id}/progress`,
        });
      }
      if (isClient && status === 'approved') {
        await Notification.create({
          recipient: job.freelancer,
          type: 'job_update',
          title: 'Milestone approved',
          message: `The client approved milestone "${milestone.title}" on "${job.title}".`,
          relatedJob: job._id,
          actionUrl: `/jobs/${job._id}/progress`,
        });
      }
      if (isClient && status === 'in_progress') {
        await Notification.create({
          recipient: job.freelancer,
          type: 'job_update',
          title: 'Revision requested',
          message: `The client requested a revision on milestone "${milestone.title}" for "${job.title}".`,
          relatedJob: job._id,
          actionUrl: `/jobs/${job._id}/progress`,
        });
      }
    } catch (notifErr) {
      console.error('Failed to create milestone notification:', notifErr.message);
    }

    res.json({ message: 'Milestone updated', job });
  } catch (error) {
    console.error('Error updating milestone:', error);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

// ── Progress Updates ────────────────────────────────────────────

// GET /api/jobs/:id/progress — get progress timeline
router.get('/:id/progress', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('progressUpdates.author', 'firstName lastName profilePicture')
      .populate('client', 'firstName lastName')
      .populate('freelancer', 'firstName lastName');

    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = req.user.userId;
    if (job.client._id.toString() !== userId && job.freelancer?._id?.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      progress: job.progressUpdates || [],
      milestones: job.milestones || [],
      status: job.status,
      deadline: job.deadline,
      job: {
        _id: job._id,
        title: job.title,
        client: job.client,
        freelancer: job.freelancer,
        budget: job.budget,
        escrowAmount: job.escrowAmount || 0,
        totalPaid: job.totalPaid || 0,
        stripePaymentIntentId: job.stripePaymentIntentId || null
      }
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// POST /api/jobs/:id/progress — post a progress update
router.post('/:id/progress', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = req.user.userId;
    if (job.client.toString() !== userId && job.freelancer?.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { message, type, attachments } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    job.progressUpdates.push({
      author: userId,
      type: type || 'update',
      message: message.trim(),
      attachments: attachments || []
    });

    await job.save();

    const updated = await Job.findById(job._id)
      .populate('progressUpdates.author', 'firstName lastName profilePicture');

    res.status(201).json({
      message: 'Update posted',
      update: updated.progressUpdates[updated.progressUpdates.length - 1]
    });
  } catch (error) {
    console.error('Error posting progress update:', error);
    res.status(500).json({ error: 'Failed to post update' });
  }
});

module.exports = router;
