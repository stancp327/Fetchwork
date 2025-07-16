const express = require('express');
const jwt = require('jsonwebtoken');
const Job = require('../models/Job');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.userId = user.userId;
    next();
  });
};

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, budget, skills, duration, experienceLevel, deadline } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.userType !== 'client') {
      return res.status(403).json({ message: 'Only clients can post jobs' });
    }

    const skillsArray = Array.isArray(skills) ? skills : [];

    const newJob = new Job({
      title,
      description,
      category,
      budget: {
        amount: budget.amount,
        type: budget.type
      },
      skills: skillsArray,
      duration,
      experienceLevel,
      client: req.userId,
      deadline: deadline ? new Date(deadline) : undefined
    });

    await newJob.save();
    await newJob.populate('client', 'email profile.firstName profile.lastName');

    res.status(201).json({
      message: 'Job posted successfully',
      job: newJob
    });
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
      experienceLevel, 
      page = 1, 
      limit = 10 
    } = req.query;

    const query = { status: 'active' };

    if (search) {
      query.$text = { $search: search };
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (experienceLevel && experienceLevel !== 'all') {
      query.experienceLevel = experienceLevel;
    }

    if (minBudget || maxBudget) {
      query['budget.amount'] = {};
      if (minBudget) query['budget.amount'].$gte = parseFloat(minBudget);
      if (maxBudget) query['budget.amount'].$lte = parseFloat(maxBudget);
    }

    const jobs = await Job.find(query)
      .populate('client', 'email profile.firstName profile.lastName')
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
      .populate('client', 'email profile.firstName profile.lastName')
      .populate('applications.freelancer', 'email profile.firstName profile.lastName profile.skills profile.hourlyRate');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json({ job });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.client.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to update this job' });
    }

    const { title, description, category, budget, budgetType, skills, duration, experienceLevel, status, deadline } = req.body;

    if (title !== undefined) job.title = title;
    if (description !== undefined) job.description = description;
    if (category !== undefined) job.category = category;
    if (duration !== undefined) job.duration = duration;
    if (experienceLevel !== undefined) job.experienceLevel = experienceLevel;
    if (status !== undefined) job.status = status;
    if (deadline !== undefined) job.deadline = deadline ? new Date(deadline) : null;

    if (budget !== undefined && budgetType !== undefined) {
      job.budget = {
        amount: parseFloat(budget),
        type: budgetType
      };
    }

    if (skills !== undefined) {
      job.skills = typeof skills === 'string' 
        ? skills.split(',').map(skill => skill.trim()).filter(skill => skill.length > 0)
        : skills;
    }

    await job.save();
    await job.populate('client', 'email profile.firstName profile.lastName');

    res.json({
      message: 'Job updated successfully',
      job
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.client.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this job' });
    }

    await Job.findByIdAndDelete(req.params.id);

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/apply', authenticateToken, async (req, res) => {
  try {
    const { coverLetter, proposedBudget, proposedBudgetType, timeline } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.userType !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can apply to jobs' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.status !== 'active') {
      return res.status(400).json({ message: 'Job is not accepting applications' });
    }

    const existingApplication = job.applications.find(
      app => app.freelancer.toString() === req.userId
    );

    if (existingApplication) {
      return res.status(400).json({ message: 'You have already applied to this job' });
    }

    const application = {
      freelancer: req.userId,
      coverLetter,
      proposedBudget: proposedBudget ? {
        amount: parseFloat(proposedBudget),
        type: proposedBudgetType || job.budget.type
      } : undefined,
      timeline
    };

    job.applications.push(application);
    await job.save();

    res.status(201).json({
      message: 'Application submitted successfully',
      application
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id/applications/:applicationId', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.client.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to manage applications for this job' });
    }

    const application = job.applications.id(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.status = status;
    await job.save();

    res.json({
      message: 'Application status updated successfully',
      application
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
