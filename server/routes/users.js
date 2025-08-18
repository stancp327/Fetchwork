const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const { Message } = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');
const { uploadProfilePicture } = require('../middleware/upload');
const { validateProfilePictureUpdate } = require('../middleware/validation');
const { normalize, isValid } = require('../utils/username');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const activeJobsAsClient = await Job.countDocuments({
      client: userId,
      status: { $in: ['open', 'in_progress'] },
      isActive: true
    });
    
    const activeJobsAsFreelancer = await Job.countDocuments({
      freelancer: userId,
      status: 'in_progress',
      isActive: true
    });
    
    const totalEarnings = await Payment.aggregate([
      {
        $match: {
          freelancer: userId,
          status: 'completed',
          type: { $in: ['release', 'bonus'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$netAmount' }
        }
      }
    ]);
    
    const totalSpent = await Payment.aggregate([
      {
        $match: {
          client: userId,
          status: 'completed',
          type: { $in: ['escrow', 'bonus'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const unreadMessages = await Message.countDocuments({
      recipient: userId,
      isRead: false,
      isDeleted: false
    });
    
    const recentJobsAsClient = await Job.find({
      client: userId,
      isActive: true
    })
    .populate('freelancer', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 })
    .limit(5);
    
    const recentJobsAsFreelancer = await Job.find({
      freelancer: userId,
      isActive: true
    })
    .populate('client', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 })
    .limit(5);
    
    const pendingProposals = await Job.aggregate([
      {
        $match: {
          'proposals.freelancer': userId,
          'proposals.status': 'pending',
          isActive: true
        }
      },
      {
        $project: {
          title: 1,
          budget: 1,
          createdAt: 1,
          proposals: {
            $filter: {
              input: '$proposals',
              cond: { $eq: ['$$this.freelancer', userId] }
            }
          }
        }
      }
    ]);

    const proposalsReceived = await Job.find({
      client: userId,
      isActive: true,
      status: 'open',
      'proposals.0': { $exists: true } // Has at least one proposal
    })
    .populate('proposals.freelancer', 'firstName lastName profilePicture rating totalJobs')
    .sort({ 'proposals.submittedAt': -1 })
    .limit(5);
    
    const dashboardData = {
      stats: {
        activeJobsAsClient,
        activeJobsAsFreelancer,
        totalEarnings: totalEarnings[0]?.total || 0,
        totalSpent: totalSpent[0]?.total || 0,
        unreadMessages,
        pendingProposals: pendingProposals.length
      },
      recentActivity: {
        jobsAsClient: recentJobsAsClient,
        jobsAsFreelancer: recentJobsAsFreelancer,
        pendingProposals,
        proposalsReceived
      }
    };
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: user.getPublicProfile() });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
router.get('/username-availability', authenticateToken, async (req, res) => {
  try {
    const raw = req.query.username || '';
    const username = normalize(raw);
    if (!isValid(username)) {
      return res.json({ available: false, reason: 'invalid' });
    }
    const exists = await User.findOne({ username }).select('_id').lean();
    if (exists) {
      return res.json({ available: false, reason: 'taken' });
    }
    return res.json({ available: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to check availability' });
  }
});

router.put('/me/username', authenticateToken, async (req, res) => {
  try {
    const raw = req.body.username || '';
    const username = normalize(raw);
    if (!isValid(username)) {
      return res.status(400).json({ error: 'Invalid username' });
    }
    const exists = await User.findOne({ username, _id: { $ne: req.user.userId } }).select('_id').lean();
    if (exists) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.username = username;
    await user.save();
    return res.json({ username });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to set username' });
  }
});

});

router.put('/profile', authenticateToken, uploadProfilePicture, validateProfilePictureUpdate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const allowedUpdates = [
      'firstName', 'lastName', 'bio', 'skills', 'hourlyRate',
      'location', 'timezone', 'portfolio', 'socialLinks', 'phone',
      'headline', 'tagline', 'languages', 'experience', 'education',
      'certifications', 'preferencesExtended', 'socialLinksExtended',
      'bannerUrl', 'visibility', 'modes'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'socialLinks' && typeof req.body[field] === 'object') {
          user[field] = { ...user[field], ...req.body[field] };
        } else {
          user[field] = req.body[field];
        }
      }
    });

    if (req.file) {
      user.profilePicture = req.file.path || req.file.secure_url || `/uploads/${req.file.filename}`;
    }
    
    await user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/jobs', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const type = req.query.type || 'all';
    
    let filters = { isActive: true };
    
    if (type === 'posted') {
      filters.client = req.user.userId;
    } else if (type === 'working') {
      filters.freelancer = req.user.userId;
    } else if (type === 'applied') {
      filters['proposals.freelancer'] = req.user.userId;
    } else {
      filters.$or = [
        { client: req.user.userId },
        { freelancer: req.user.userId },
        { 'proposals.freelancer': req.user.userId }
      ];
    }
    
    const jobs = await Job.find(filters)
      .populate('client', 'firstName lastName profilePicture')
      .populate('freelancer', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 })
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
    console.error('Error fetching user jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

module.exports = router;
