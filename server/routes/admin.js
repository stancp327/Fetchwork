const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const Admin = require('../models/Admin');
const auth = require('../middleware/auth');

const requireAdmin = async (req, res, next) => {
  try {
    const admin = await Admin.getAdminByUserId(req.user.userId);
    if (!admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    req.admin = admin;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin.hasPermission(permission)) {
      return res.status(403).json({ message: `Permission required: ${permission}` });
    }
    next();
  };
};

router.get('/dashboard', auth, requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalJobs,
      totalPayments,
      totalReviews,
      recentUsers,
      recentJobs,
      flaggedReviews,
      pendingPayments
    ] = await Promise.all([
      User.countDocuments(),
      Job.countDocuments(),
      Payment.countDocuments(),
      Review.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(5).select('email profile createdAt'),
      Job.find().sort({ createdAt: -1 }).limit(5).populate('clientId', 'email profile'),
      Review.find({ 'adminModeration.flagged': true, 'adminModeration.adminReviewed': false }).limit(10),
      Payment.find({ status: 'pending' }).limit(10).populate('jobId clientId')
    ]);

    const userStats = await User.aggregate([
      {
        $group: {
          _id: '$userType',
          count: { $sum: 1 }
        }
      }
    ]);

    const jobStats = await Job.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const paymentStats = await Payment.aggregate([
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      overview: {
        totalUsers,
        totalJobs,
        totalPayments,
        totalReviews
      },
      stats: {
        users: userStats,
        jobs: jobStats,
        payments: paymentStats
      },
      recent: {
        users: recentUsers,
        jobs: recentJobs
      },
      alerts: {
        flaggedReviews: flaggedReviews.length,
        pendingPayments: pendingPayments.length
      },
      flaggedReviews,
      pendingPayments
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/users', auth, requireAdmin, requirePermission('userManagement'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const userType = req.query.userType || '';
    const status = req.query.status || '';

    const query = {};
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } }
      ];
    }
    if (userType) query.userType = userType;
    if (status === 'suspended') query.isSuspended = true;
    if (status === 'active') query.isSuspended = { $ne: true };

    const users = await User.find(query)
      .select('email userType profile createdAt isSuspended rating')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/users/:userId/suspend', auth, requireAdmin, requirePermission('userManagement'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { suspend, reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isSuspended = suspend;
    if (suspend) {
      user.suspensionReason = reason;
      user.suspendedAt = new Date();
      user.suspendedBy = req.user.userId;
    } else {
      user.suspensionReason = undefined;
      user.suspendedAt = undefined;
      user.suspendedBy = undefined;
    }

    await user.save();

    res.json({ 
      message: suspend ? 'User suspended successfully' : 'User unsuspended successfully',
      user: {
        id: user._id,
        email: user.email,
        isSuspended: user.isSuspended
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/jobs', auth, requireAdmin, requirePermission('jobManagement'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || '';
    const search = req.query.search || '';

    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const jobs = await Job.find(query)
      .populate('clientId', 'email profile')
      .populate('assignedTo', 'email profile')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Job.countDocuments(query);

    res.json({
      jobs,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/payments', auth, requireAdmin, requirePermission('paymentOverride'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || '';

    const query = {};
    if (status) query.status = status;

    const payments = await Payment.find(query)
      .populate('jobId', 'title')
      .populate('clientId', 'email profile')
      .populate('freelancerId', 'email profile')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.json({
      payments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/payments/:paymentId/override', auth, requireAdmin, requirePermission('paymentOverride'), async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { action, reason } = req.body; // action: 'release', 'refund', 'hold'

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    payment.adminOverride = {
      action,
      reason,
      adminId: req.user.userId,
      timestamp: new Date()
    };

    switch (action) {
      case 'release':
        payment.status = 'released';
        payment.releasedAt = new Date();
        break;
      case 'refund':
        payment.status = 'refunded';
        payment.refundedAt = new Date();
        break;
      case 'hold':
        payment.status = 'held';
        break;
    }

    await payment.save();

    res.json({ 
      message: `Payment ${action} successfully`,
      payment: {
        id: payment._id,
        status: payment.status,
        adminOverride: payment.adminOverride
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/reviews/flagged', auth, requireAdmin, requirePermission('reviewModeration'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const reviews = await Review.find({
      'adminModeration.flagged': true,
      'adminModeration.adminReviewed': false
    })
      .populate('reviewerId', 'email profile')
      .populate('revieweeId', 'email profile')
      .populate('jobId', 'title')
      .sort({ 'adminModeration.flaggedDate': -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments({
      'adminModeration.flagged': true,
      'adminModeration.adminReviewed': false
    });

    res.json({
      reviews,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/reviews/:reviewId/moderate', auth, requireAdmin, requirePermission('reviewModeration'), async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { action, notes } = req.body; // action: 'approved', 'removed', 'edited'

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    review.adminModeration.adminReviewed = true;
    review.adminModeration.adminId = req.user.userId;
    review.adminModeration.adminAction = action;
    review.adminModeration.adminNotes = notes;
    review.adminModeration.adminDate = new Date();

    if (action === 'removed') {
      review.isPublic = false;
    }

    await review.save();

    res.json({ 
      message: `Review ${action} successfully`,
      review: {
        id: review._id,
        isPublic: review.isPublic,
        adminModeration: review.adminModeration
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/analytics', auth, requireAdmin, requirePermission('analytics'), async (req, res) => {
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

    const [
      userGrowth,
      jobGrowth,
      paymentVolume,
      reviewStats
    ] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]),
      Job.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]),
      Payment.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]),
      Review.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
            flaggedCount: {
              $sum: { $cond: ['$adminModeration.flagged', 1, 0] }
            }
          }
        }
      ])
    ]);

    res.json({
      period,
      userGrowth,
      jobGrowth,
      paymentVolume,
      reviewStats: reviewStats[0] || { averageRating: 0, totalReviews: 0, flaggedCount: 0 }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
