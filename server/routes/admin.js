const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const auth = require('../middleware/auth');

const adminAuth = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

router.get('/stats', auth, adminAuth, async (req, res) => {
  try {
    const [totalUsers, activeJobs, totalRevenue, pendingDisputes] = await Promise.all([
      User.countDocuments(),
      Job.countDocuments({ status: { $in: ['open', 'in-progress'] } }),
      Payment.aggregate([
        { $match: { status: 'released' } },
        { $group: { _id: null, total: { $sum: '$platformFee' } } }
      ]),
      Payment.countDocuments({ 'dispute.isDisputed': true, status: 'disputed' })
    ]);

    res.json({
      totalUsers,
      activeJobs,
      totalRevenue: totalRevenue[0]?.total || 0,
      pendingDisputes
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, userType, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (userType) query.userType = userType;
    if (status) query.isActive = status === 'active';

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/users/:userId/suspend', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = false;
    user.suspendedAt = new Date();
    user.suspendedBy = req.user.id;
    await user.save();

    res.json({ message: 'User suspended successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/users/:userId/activate', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = true;
    user.suspendedAt = null;
    user.suspendedBy = null;
    await user.save();

    res.json({ message: 'User activated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/users/:userId/ban', auth, adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isBanned = true;
    user.isActive = false;
    user.bannedAt = new Date();
    user.bannedBy = req.user.id;
    user.banReason = reason || 'Banned by admin';
    await user.save();

    res.json({ message: 'User banned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/jobs', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;

    const jobs = await Job.find(query)
      .populate('client', 'name email')
      .populate('freelancer', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Job.countDocuments(query);

    res.json({
      jobs,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/payments', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;

    const payments = await Payment.find(query)
      .populate('job', 'title')
      .populate('client', 'name email')
      .populate('freelancer', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    res.json({
      payments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/reviews/flagged', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({
      'flaggedBy.0': { $exists: true }
    })
    .populate('job', 'title')
    .populate('reviewer', 'name email')
    .populate('reviewee', 'name email')
    .sort({ 'flaggedBy.0.flaggedAt': -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Review.countDocuments({
      'flaggedBy.0': { $exists: true }
    });

    res.json({
      reviews,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/analytics', auth, adminAuth, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '7d':
        dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30d':
        dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case '90d':
        dateFilter = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
        break;
    }

    const [userGrowth, jobStats, revenueStats] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Job.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Payment.aggregate([
        { $match: { createdAt: dateFilter, status: 'released' } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$platformFee' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    res.json({
      userGrowth,
      jobStats,
      revenueStats
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
