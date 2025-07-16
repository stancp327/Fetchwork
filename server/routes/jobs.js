const express = require('express');
const Job = require('../models/Job');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'client') {
      return res.status(403).json({ message: 'Only clients can post jobs' });
    }

    const {
      title,
      description,
      category,
      budget,
      jobType,
      location,
      requiredSkills,
      deadline
    } = req.body;

    const job = new Job({
      title,
      description,
      category,
      budget,
      jobType,
      location,
      requiredSkills: requiredSkills || [],
      deadline,
      client: req.user._id
    });

    await job.save();
    await job.populate('client', 'name email');

    res.status(201).json(job);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const {
      search,
      category,
      minBudget,
      maxBudget,
      jobType,
      skills,
      page = 1,
      limit = 10
    } = req.query;

    let query = { status: 'open' };

    if (search) {
      query.$text = { $search: search };
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (minBudget || maxBudget) {
      query['budget.min'] = {};
      if (minBudget) query['budget.min'].$gte = parseInt(minBudget);
      if (maxBudget) query['budget.max'] = { $lte: parseInt(maxBudget) };
    }

    if (jobType && jobType !== 'all') {
      query.jobType = jobType;
    }

    if (skills) {
      const skillsArray = skills.split(',').map(skill => skill.trim());
      query.requiredSkills = { $in: skillsArray };
    }

    const jobs = await Job.find(query)
      .populate('client', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Job.countDocuments(query);

    res.json({
      jobs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('client', 'name email')
      .populate('applications.freelancer', 'name email')
      .populate('assignedFreelancer', 'name email');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/apply', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can apply to jobs' });
    }

    const { proposal, bidAmount, estimatedDuration } = req.body;
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.status !== 'open') {
      return res.status(400).json({ message: 'Job is no longer accepting applications' });
    }

    const existingApplication = job.applications.find(
      app => app.freelancer.toString() === req.user._id.toString()
    );

    if (existingApplication) {
      return res.status(400).json({ message: 'You have already applied to this job' });
    }

    job.applications.push({
      freelancer: req.user._id,
      proposal,
      bidAmount,
      estimatedDuration
    });

    await job.save();
    await job.populate('applications.freelancer', 'name email');

    res.json({ message: 'Application submitted successfully', job });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id/applications/:applicationId/accept', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the job client can accept applications' });
    }

    const application = job.applications.id(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.status = 'accepted';
    job.assignedFreelancer = application.freelancer;
    job.status = 'in-progress';
    job.payment.amount = application.bidAmount;
    job.payment.status = 'escrowed';
    job.payment.escrowedAt = new Date();

    job.applications.forEach(app => {
      if (app._id.toString() !== req.params.applicationId) {
        app.status = 'rejected';
      }
    });

    await job.save();
    await job.populate('assignedFreelancer', 'name email');

    res.json({ message: 'Application accepted successfully', job });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id/complete', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const isClient = job.client.toString() === req.user._id.toString();
    const isFreelancer = job.assignedFreelancer && job.assignedFreelancer.toString() === req.user._id.toString();

    if (!isClient && !isFreelancer) {
      return res.status(403).json({ message: 'Only the client or assigned freelancer can mark job as complete' });
    }

    job.status = 'completed';
    job.payment.status = 'released';
    job.payment.releasedAt = new Date();

    await job.save();

    res.json({ message: 'Job marked as completed', job });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/rate', auth, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ message: 'Job must be completed before rating' });
    }

    const isClient = job.client.toString() === req.user._id.toString();
    const isFreelancer = job.assignedFreelancer && job.assignedFreelancer.toString() === req.user._id.toString();

    if (!isClient && !isFreelancer) {
      return res.status(403).json({ message: 'Only job participants can leave ratings' });
    }

    if (isClient) {
      job.rating.clientRating = {
        score: rating,
        review,
        ratedAt: new Date()
      };
    } else {
      job.rating.freelancerRating = {
        score: rating,
        review,
        ratedAt: new Date()
      };
    }

    await job.save();

    res.json({ message: 'Rating submitted successfully', job });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/user/my-jobs', auth, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.userType === 'client') {
      query.client = req.user._id;
    } else {
      query.$or = [
        { assignedFreelancer: req.user._id },
        { 'applications.freelancer': req.user._id }
      ];
    }

    const jobs = await Job.find(query)
      .populate('client', 'name email')
      .populate('assignedFreelancer', 'name email')
      .populate('applications.freelancer', 'name email')
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
