const express = require('express');
const router = express.Router();
const { objectIdParam } = require('../middleware/validateObjectId');
router.param('id', objectIdParam);
const Job = require('../models/Job');
const { Message, Conversation } = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');
const { validateJobPost, validateProposal, validateQueryParams, validateMongoId } = require('../middleware/validation');
const { checkJobLimit } = require('../middleware/entitlements');
const { uploadJobAttachments } = require('../middleware/upload');
const { geocode, nearSphereQuery } = require('../config/geocoding');
const { escapeRegex } = require('../utils/sanitize');
const { trackEvent } = require('../middleware/analytics');
const { notify } = require('../services/notificationService');
const User = require('../models/User');
const stripeService = require('../services/stripeService');
const Payment = require('../models/Payment');
const { checkJobAlerts }          = require('./jobAlerts');
const { triggerReferralReward }   = require('./referrals');
const milestoneRoutes = require('./jobs/milestones');

router.get('/', validateQueryParams, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filters = {
      isActive:   true,
      isArchived: { $ne: true },
      status:     'open',
      expiresAt:  { $gt: new Date() }
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

    let sortOptions = { isBoosted: -1, isFeatured: -1, isUrgent: -1, createdAt: -1 };
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
            .sort(sortOptions).skip(skip).limit(limit)
            .lean(),
          Job.countDocuments(filters)
        ]);
      }
    } else {
      [jobs, total] = await Promise.all([
        Job.find(filters)
          .populate('client', 'firstName lastName profilePicture rating totalJobs')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
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

    // Sort proposals: promoted first, then newest
    const jobObj = job.toObject();
    if (Array.isArray(jobObj.proposals)) {
      jobObj.proposals.sort((a, b) => {
        if (a.isPromoted && !b.isPromoted) return -1;
        if (!a.isPromoted && b.isPromoted) return 1;
        return new Date(b.submittedAt) - new Date(a.submittedAt);
      });
    }

    res.json({ job: jobObj });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

router.post('/', authenticateToken, validateJobPost, checkJobLimit, async (req, res) => {
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
      deadline,
      recurring
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
    
    // Team-scoped job posting
    const teamId = req.body.teamId || null;
    let needsApproval = false;

    if (teamId) {
      const Team = require('../models/Team');
      const team = await Team.findById(teamId);
      if (!team || !team.isActive) return res.status(400).json({ error: 'Team not found' });
      if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });
      if (!team.hasPermission(req.user.userId, 'create_jobs')) {
        return res.status(403).json({ error: 'No permission to post jobs for this team' });
      }

      // Check approval threshold
      const amount = budget?.amount || 0;
      if (team.settings?.requireApproval && team.approvalThreshold > 0 && amount >= team.approvalThreshold) {
        needsApproval = true;
      }
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
      team: teamId || undefined,
      status: needsApproval ? 'draft' : 'open',
      approvalStatus: needsApproval ? 'pending' : 'none',
      recurring: recurring?.enabled ? {
        enabled:  true,
        interval: recurring.interval || 'monthly',
        endDate:  recurring.endDate ? new Date(recurring.endDate) : undefined,
        nextRunDate: null,
      } : { enabled: false },
    });
    
    await job.save();

    // Fire job alerts async — non-blocking, never delays response
    checkJobAlerts(job).catch(() => {});

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
    
    // For in-progress jobs, cancel directly — no fee enforcement on jobs
    if (job.status === 'in_progress') {
      await job.cancelJob(req.body.reason);
      return res.json({ message: 'Job cancelled' });
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

// ── Boost status check ─────────────────────────────────────────
router.get('/:id/boost', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).select('isBoosted boostExpiresAt').lean();
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const active = job.isBoosted && job.boostExpiresAt && new Date(job.boostExpiresAt) > new Date();
    res.json({ isBoosted: active, expiresAt: job.boostExpiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Feature a job listing ──────────────────────────────────────────────────
const FEATURE_TIERS = {
  standard: { amountCents: 999,  days: 7,  label: 'Standard feature (7 days)' },
  premium:  { amountCents: 1999, days: 14, label: 'Premium feature (14 days)' },
};

router.post('/:id/feature', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const { tier = 'standard' } = req.body;
    const option = FEATURE_TIERS[tier];
    if (!option) return res.status(400).json({ error: 'Invalid tier. Use standard or premium.' });

    const job = await Job.findById(req.params.id).select('client title isFeatured featuredExpiresAt');
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.client) !== String(req.user._id || req.user.userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Already active?
    if (job.isFeatured && job.featuredExpiresAt && new Date(job.featuredExpiresAt) > new Date()) {
      return res.status(409).json({ error: 'Job is already featured', expiresAt: job.featuredExpiresAt });
    }

    const pi = await stripeService.createPaymentIntent({
      amount:   option.amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        type:        'job_feature',
        jobId:       String(job._id),
        userId:      String(req.user._id || req.user.userId),
        featureTier: tier,
        featureDays: String(option.days),
      },
    });

    return res.json({ clientSecret: pi.client_secret, tier, option });
  } catch (err) {
    console.error('[feature job]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Verify job feature after payment ──────────────────────────────────────
router.post('/:id/feature/verify', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId required' });

    const pi = await stripeService.retrievePaymentIntent(paymentIntentId);

    if (pi.status !== 'succeeded') {
      return res.status(402).json({ error: 'Payment not complete', status: pi.status });
    }

    const days = parseInt(pi.metadata.featureDays) || 7;
    const tier = pi.metadata.featureTier || 'standard';
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await Job.findByIdAndUpdate(req.params.id, {
      isFeatured: true, featuredTier: tier, featuredExpiresAt: expiresAt,
    });

    return res.json({ success: true, tier, expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Promote a proposal ─────────────────────────────────────────────────────
router.post('/:id/proposals/:proposalId/promote', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).select('proposals');
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const proposal = job.proposals.id(req.params.proposalId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (String(proposal.freelancer) !== String(req.user._id || req.user.userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (proposal.isPromoted) {
      return res.status(409).json({ error: 'Proposal is already promoted' });
    }

    const pi = await stripeService.createPaymentIntent({
      amount:   299, // $2.99
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        type:       'proposal_promote',
        jobId:      String(job._id),
        proposalId: String(proposal._id),
        userId:     String(req.user._id || req.user.userId),
      },
    });

    return res.json({ clientSecret: pi.client_secret, amount: 2.99 });
  } catch (err) {
    console.error('[promote proposal]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Verify proposal promotion after payment ────────────────────────────────
router.post('/:id/proposals/:proposalId/promote/verify', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId required' });

    const pi = await stripeService.retrievePaymentIntent(paymentIntentId);
    if (pi.status !== 'succeeded') {
      return res.status(402).json({ error: 'Payment not complete', status: pi.status });
    }

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const proposal = job.proposals.id(req.params.proposalId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    proposal.isPromoted = true;
    proposal.promotedAt = new Date();
    await job.save();

    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/proposals', authenticateToken, uploadJobAttachments, validateMongoId, validateProposal, async (req, res) => {
  try {
    const { coverLetter, proposedBudget, proposedDuration, teamId } = req.body;

    // If submitting as a team, validate membership + permission
    let teamDoc = null;
    if (teamId) {
      const Team = require('../models/Team');
      teamDoc = await Team.findById(teamId);
      if (!teamDoc) return res.status(404).json({ error: 'Team not found' });
      const member = teamDoc.members.find(m => m.user.toString() === req.user._id.toString() && m.status === 'active');
      if (!member) return res.status(403).json({ error: 'You are not an active member of this team' });
      if (!member.permissions.includes('create_jobs') && teamDoc.owner.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'You do not have permission to submit proposals for this team' });
      }
      // Check team hasn't already proposed
      const teamProposal = job.proposals.find(p => p.team && p.team.toString() === teamId);
      if (teamProposal) return res.status(400).json({ error: 'This team has already submitted a proposal' });
    }
    
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
    
    // Parse optional proposed milestones (sent as JSON string in form data)
    let proposedMilestones = [];
    if (req.body.proposedMilestones) {
      try {
        const parsed = JSON.parse(req.body.proposedMilestones);
        if (Array.isArray(parsed)) {
          proposedMilestones = parsed
            .filter(m => m.title && m.amount && parseFloat(m.amount) > 0)
            .map(m => ({ title: String(m.title).trim(), amount: parseFloat(m.amount), description: m.description || '' }));
        }
      } catch (_) { /* ignore invalid JSON */ }
    }

    const proposal = {
      freelancer: req.user._id,
      coverLetter,
      proposedBudget: parseFloat(proposedBudget),
      proposedDuration,
      attachments,
      ...(proposedMilestones.length > 0 ? { proposedMilestones } : {}),
      ...(teamId ? { team: teamId } : {}),
    };
    
    await job.addProposal(proposal);
    
    
    let conversation = await Conversation.findByParticipants(job.client, req.user._id);
    
    if (!conversation) {
      conversation = new Conversation({
        participants: [job.client, req.user._id],
        job: job._id
      });
      await conversation.save();
    }
    
    // Get the newly added proposal's _id so we can wire up in-chat actions
    const savedProposal = job.proposals.find(
      p => p.freelancer.toString() === req.user._id.toString()
    );

    const systemMessage = new Message({
      conversation: conversation._id,
      sender: req.user._id,
      recipient: job.client,
      content: `🔔 New Proposal Received for "${job.title}"\n\nFreelancer: ${req.user.firstName} ${req.user.lastName}\nProposed Budget: $${proposedBudget}\nTimeline: ${proposedDuration}\nSubmitted: ${new Date().toLocaleString()}\n\nCover Letter:\n${coverLetter}`,
      messageType: 'system',
      metadata: {
        type: 'job_proposal',
        jobId:          String(job._id),
        jobTitle:       job.title,
        proposalId:     savedProposal ? String(savedProposal._id) : null,
        proposedBudget: parseFloat(proposedBudget),
        proposedDuration: proposedDuration,
        coverLetter:    coverLetter,
        freelancerId:   String(req.user._id),
        freelancerName: `${req.user.firstName} ${req.user.lastName}`,
      }
    });
    
    await systemMessage.save();
    
    conversation.lastMessage = systemMessage._id;
    await conversation.updateLastActivity();
    
    const updatedJob = await Job.findById(job._id)
      .populate('proposals.freelancer', 'firstName lastName profilePicture rating totalJobs');
    
    const emailService = require('../services/emailService');
    const emailWorkflowService = require('../services/emailWorkflowService');
    const User = require('../models/User');
    const client = await User.findById(job.client);
    if (client && await emailWorkflowService.canSendEmail(client._id, 'job_lifecycle', 'new_proposal')) {
      await emailService.sendJobNotification(client, job, 'new_proposal');
    }

    // SMS: notify job owner of new proposal
    try {
      const { notifyUser: smsSend, SMS: smsT } = require('../services/smsService');
      if (client) smsSend(client, 'proposals', smsT.proposalReceived(job.title)).catch(() => {});
    } catch (_) {}

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
      .populate('proposals.freelancer', 'firstName lastName profilePicture rating totalJobs')
      .populate('proposals.team', 'name slug avatar');
    
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

    // SMS: notify freelancer their proposal was accepted
    try {
      const { notifyUser: smsSend, SMS: smsT } = require('../services/smsService');
      const User = require('../models/User');
      const freelancer = await User.findById(proposal.freelancer).select('phone preferences');
      if (freelancer) smsSend(freelancer, 'proposals', smsT.proposalAccepted(job.title)).catch(() => {});
    } catch (_) {}

    res.json({
      message: 'Proposal accepted successfully',
      job: await Job.findById(job._id).populate('freelancer', 'firstName lastName')
    });
  } catch (error) {
    console.error('Error accepting proposal:', error);
    res.status(500).json({ error: 'Failed to accept proposal' });
  }
});

// Decline a proposal
router.post('/:id/proposals/:proposalId/decline', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the client can decline proposals' });
    }

    const proposal = job.proposals.id(req.params.proposalId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    proposal.status = 'declined';
    await job.save();

    res.json({ message: 'Proposal declined' });
  } catch (error) {
    console.error('Error declining proposal:', error);
    res.status(500).json({ error: 'Failed to decline proposal' });
  }
});

// POST /api/jobs/:id/start — freelancer signals ready to start (accepted → pending_start)
router.post('/:id/start', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('client', 'firstName lastName')
      .populate('freelancer', 'firstName lastName');
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = (req.user._id || req.user.userId)?.toString();
    const freelancerId = job.freelancer?._id?.toString() || job.freelancer?.toString();
    if (freelancerId !== userId) {
      return res.status(403).json({ error: 'Only the assigned freelancer can start this job' });
    }
    if (job.status !== 'accepted') {
      return res.status(400).json({ error: 'Job must be in accepted state to start' });
    }

    job.status = 'pending_start';
    job.pendingStartAt = new Date();
    await job.save();

    // Notify client
    const freelancerName = `${job.freelancer.firstName} ${job.freelancer.lastName}`;
    await notify({
      recipient: job.client._id,
      title: 'Freelancer is ready to start',
      message: `${freelancerName} is ready to begin "${job.title}". You have 24 hours to review milestones and approve the start.`,
      type: 'job_start_requested',
      link: `/projects?view=client`
    });

    res.json({ message: 'Job start requested. Client has 24 hours to approve.', job });
  } catch (err) {
    console.error('Error starting job:', err);
    res.status(500).json({ error: 'Failed to start job' });
  }
});

// POST /api/jobs/:id/begin — client approves start (pending_start → in_progress)
router.post('/:id/begin', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('client', 'firstName lastName')
      .populate('freelancer', 'firstName lastName');
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = (req.user._id || req.user.userId)?.toString();
    const clientId = job.client?._id?.toString() || job.client?.toString();
    if (clientId !== userId) {
      return res.status(403).json({ error: 'Only the client can approve the job start' });
    }
    if (job.status !== 'pending_start') {
      return res.status(400).json({ error: 'Job is not waiting for start approval' });
    }

    // Apply milestones from request body — replaces any proposal-stage milestones
    // (job hasn't started yet so none are funded; safe to replace)
    const { milestones } = req.body;
    const validMilestones = Array.isArray(milestones)
      ? milestones.filter(m => m.title && String(m.title).trim())
      : [];
    if (validMilestones.length > 0) {
      job.milestones = validMilestones.map(m => ({
        title:       String(m.title).trim(),
        description: m.description || '',
        amount:      Number(m.amount) || 0,
        dueDate:     m.dueDate || undefined,
        status:      'pending'
      }));
    }

    job.status = 'in_progress';
    job.startDate = new Date();
    await job.save();

    // Notify freelancer
    const clientName = `${job.client.firstName} ${job.client.lastName}`;
    await notify({
      recipient: job.freelancer._id,
      title: 'Job approved — time to get to work!',
      message: `${clientName} approved the start of "${job.title}". The job is now in progress.`,
      type: 'job_started',
      link: `/projects?view=freelancer`
    });

    res.json({ message: 'Job is now in progress.', job });
  } catch (err) {
    console.error('Error beginning job:', err);
    res.status(500).json({ error: 'Failed to begin job' });
  }
});

// POST /api/jobs/:id/deliver — freelancer submits deliverables
router.post('/:id/deliver', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('client', 'firstName lastName _id')
      .populate('freelancer', 'firstName lastName _id');

    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = (req.user._id || req.user.userId)?.toString();
    const isFreelancer = job.freelancer?._id?.toString() === userId;

    if (!isFreelancer) return res.status(403).json({ error: 'Only the freelancer can deliver this job' });
    if (!['in_progress', 'delivered'].includes(job.status)) {
      return res.status(400).json({ error: 'Job must be in progress to deliver' });
    }

    const { note, files } = req.body;
    // files: [{ filename, url, size, contentType }] — frontend uploads via /api/upload first
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const now = new Date();

    job.status = 'delivered';
    job.deliveredAt = now;
    job.deliveryNote = note || '';
    job.autoReleaseAt = new Date(now.getTime() + THREE_DAYS_MS);
    if (Array.isArray(files) && files.length > 0) {
      job.deliveryFiles = files.map(f => ({
        filename: f.filename || f.name || 'file',
        url: f.url,
        size: f.size || 0,
        contentType: f.contentType || f.mimeType || 'application/octet-stream',
        uploadedAt: now,
      }));
    }

    // Add activity log entry
    job.activityLog = job.activityLog || [];
    job.activityLog.push({
      type: 'file_delivered',
      user: job.freelancer._id,
      message: note || 'Deliverables submitted for review.',
      attachments: job.deliveryFiles || [],
      timestamp: now,
    });

    await job.save();

    const freelancerName = `${job.freelancer.firstName} ${job.freelancer.lastName}`.trim();
    // Notify client
    try {
      await notify({
        recipient: job.client._id,
        title: 'Work delivered — please review',
        message: `${freelancerName} has delivered "${job.title}". You have 3 days to review and release payment. After that, funds auto-release to the freelancer.`,
        type: 'job_delivered',
        link: `/jobs/${job._id}/progress`,
        metadata: { type: 'job_delivered', jobId: job._id },
      });
    } catch (notifErr) {
      console.error('Delivery notification error (non-fatal):', notifErr.message);
    }

    res.json({ message: 'Work delivered. Client has 3 days to review.', job });
  } catch (err) {
    console.error('Error delivering job:', err);
    res.status(500).json({ error: 'Failed to deliver job' });
  }
});

// POST /api/jobs/:id/complete — client approves work + releases payment
router.post('/:id/complete', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('client', 'firstName lastName').populate('freelancer', 'firstName lastName');
    
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = (req.user._id || req.user.userId)?.toString();
    const isFreelancer = job.freelancer?._id?.toString() === userId;
    const isClient     = job.client?.toString()          === userId ||
                         job.client?._id?.toString()     === userId;

    if (!isFreelancer && !isClient) {
      return res.status(403).json({ error: 'Only the client or freelancer can complete this job' });
    }
    if (!['in_progress', 'delivered'].includes(job.status)) {
      return res.status(400).json({ error: 'Job must be in progress or delivered to complete' });
    }

    const freelancerName = `${job.freelancer.firstName} ${job.freelancer.lastName}`.trim();

    // ── Client completing: approve work + release payment if funded ───
    if (isClient) {
      await job.completeJob();
      trackEvent('jobsCompleted');

      // Release Stripe escrow if it exists
      if (job.stripePaymentIntentId && job.escrowAmount > 0) {
        try {
          const stripeService = require('../services/stripeService');
          const Payment = require('../models/Payment');
          const User = require('../models/User');
          const freelancer = await User.findById(job.freelancer._id).select('stripeAccountId feeWaiver');
          if (freelancer?.stripeAccountId) {
            const escrowPayment = await Payment.findOne({ job: job._id, type: 'escrow' });
            const { calcPlatformFee } = require('../services/feeEngine');
            const waived = freelancer.isFeeWaived?.() || false;
            const platformFee = waived ? 0 : (escrowPayment?.platformFee || await calcPlatformFee(
              String(job.freelancer._id), 'freelancer', job, job.escrowAmount
            ));
            const payoutAmt = job.escrowAmount - platformFee;
            await stripeService.releasePayment(payoutAmt, freelancer.stripeAccountId, job.stripePaymentIntentId);
            if (waived) await freelancer.useFeeWaiverJob();
            if (escrowPayment) { escrowPayment.status = 'completed'; await escrowPayment.save(); }
          }
        } catch (payErr) {
          console.error('Payment release error (non-fatal):', payErr.message);
          // Don't block job completion if payment release fails — admin can reconcile
        }
      }

      // Notify freelancer
      try {
        const conversation = await Conversation.findOne({ job: job._id });
        if (conversation) {
          const sysMsg = new Message({
            conversation: conversation._id,
            sender: job.client._id,
            recipient: job.freelancer._id,
            content: `✅ The client has approved the work and released payment for "${job.title}". Great job!`,
            messageType: 'system',
            metadata: { type: 'job_completed', jobId: job._id }
          });
          await sysMsg.save();
          conversation.lastMessage = sysMsg._id;
          await conversation.updateLastActivity();
        }
      } catch (msgErr) { console.error('Failed to post completion message:', msgErr.message); }

      try {
        await notify({
          recipient: job.freelancer._id,
          type: 'job_update',
          title: 'Job approved & payment released',
          message: `The client approved your work on "${job.title}" and released your payment!`,
          relatedJob: job._id,
          link: `/jobs/${job._id}`,
        });
      } catch (notifErr) { console.error('Failed to create notification:', notifErr.message); }

      // Trigger referral reward if this is the freelancer's first completed job
      triggerReferralReward(String(job.freelancer._id)).catch(() => {});

      // Schedule next run for recurring jobs
      if (job.recurring?.enabled) {
        const next = new Date();
        if (job.recurring.interval === 'weekly')        next.setDate(next.getDate() + 7);
        else if (job.recurring.interval === 'biweekly') next.setDate(next.getDate() + 14);
        else                                             next.setMonth(next.getMonth() + 1);
        await Job.updateOne({ _id: job._id }, { 'recurring.nextRunDate': next });
      }

      // Remove watermarks from shared images now that job is complete
      try {
        const { removeWatermarksForJob } = require('../services/watermarkService');
        const wmResult = await removeWatermarksForJob(job._id);
        if (wmResult.updated > 0) console.log(`Removed watermarks from ${wmResult.updated} messages for job ${job._id}`);
      } catch (wmErr) { console.error('Watermark removal failed:', wmErr.message); }

      return res.json({ message: 'Job approved and payment released', job: await Job.findById(job._id) });
    }

    // ── Freelancer completing: mark done, notify client to review ────
    await job.completeJob();
    trackEvent('jobsCompleted');

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
      await notify({
        recipient: job.client._id,
        type: 'job_update',
        title: 'Job marked complete',
        message: `${freelancerName} has marked "${job.title}" as complete. Please review and release payment.`,
        relatedJob: job._id,
        link: `/jobs/${job._id}/progress`,
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
      await notify({
        recipient:  notifRecipient,
        type:       'job_update',
        title:      'Job cancelled',
        message:    `${requesterName} cancelled "${job.title}".${refunded ? ' A refund has been issued.' : ''}`,
        relatedJob: job._id,
        link:  `/jobs/${job._id}`,
      });
    } catch (_) {}

    res.json({ message: 'Job cancelled', refunded });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// ── Milestone & Progress routes (extracted to jobs/milestones.js) ──
router.use('/:id', milestoneRoutes);

// POST /api/jobs/cron/auto-release — called by Render cron daily, auto-releases overdue deliveries
router.post('/cron/auto-release', async (req, res) => {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const overdueJobs = await Job.find({
      status: 'delivered',
      autoReleaseAt: { $lte: new Date() },
      autoReleased: false,
    }).populate('client', 'firstName').populate('freelancer', 'firstName lastName _id stripeAccountId feeWaiver');

    let released = 0;
    for (const job of overdueJobs) {
      try {
        // Release payment if escrow exists
        if (job.stripePaymentIntentId && job.escrowAmount > 0 && job.freelancer?.stripeAccountId) {
          const stripeService = require('../services/stripeService');
          const Payment = require('../models/Payment');
          const { calcPlatformFee } = require('../services/feeEngine');
          const waived = job.freelancer.isFeeWaived?.() || false;
          const escrowPayment = await Payment.findOne({ job: job._id, type: 'escrow' });
          const platformFee = waived ? 0 : (escrowPayment?.platformFee || await calcPlatformFee(
            String(job.freelancer._id), 'freelancer', job, job.escrowAmount
          ));
          const payoutAmt = job.escrowAmount - platformFee;
          await stripeService.releasePayment(payoutAmt, job.freelancer.stripeAccountId, job.stripePaymentIntentId);
          if (escrowPayment) { escrowPayment.status = 'completed'; await escrowPayment.save(); }
        }

        job.status = 'completed';
        job.autoReleased = true;
        job.completedAt = new Date();
        await job.save();

        // Notify both parties
        try {
          const freelancerName = `${job.freelancer.firstName} ${job.freelancer.lastName}`;
          await notify({ recipient: job.client._id, title: 'Funds auto-released', message: `The review period for "${job.title}" ended. Payment was automatically released to ${freelancerName}.`, type: 'auto_release' });
          await notify({ recipient: job.freelancer._id, title: 'Payment auto-released', message: `The review period for "${job.title}" ended and your payment was released automatically.`, type: 'auto_release' });
        } catch {}

        released++;
      } catch (jobErr) {
        console.error(`Auto-release failed for job ${job._id}:`, jobErr.message);
      }
    }

    res.json({ message: `Auto-released ${released} job(s)`, released });
  } catch (err) {
    console.error('Auto-release cron error:', err);
    res.status(500).json({ error: 'Auto-release failed' });
  }
});

module.exports = router;



