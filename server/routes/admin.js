const express = require('express');
const router = express.Router();
const { authenticateAdmin, requirePermission } = require('../middleware/auth');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const { Message, ChatRoom } = require('../models/Message');

router.get('/profile', authenticateAdmin, async (req, res) => {
  try {
    res.json({
      message: 'Admin profile retrieved successfully',
      admin: req.admin.getPublicProfile()
    });
  } catch (error) {
    console.error('Admin profile error:', error);
    res.status(500).json({ error: 'Failed to retrieve admin profile' });
  }
});

router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const stats = {
      users: {
        total: await User.countDocuments(),
        active: await User.countDocuments({ isActive: true, isSuspended: false }),
        suspended: await User.countDocuments({ isSuspended: true }),
        newThisMonth: await User.countDocuments({
          createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
        })
      },
      jobs: {
        total: await Job.countDocuments(),
        active: await Job.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
        completed: await Job.countDocuments({ status: 'completed' }),
        disputed: await Job.countDocuments({ status: 'disputed' })
      },
      payments: {
        totalVolume: await Payment.aggregate([
          { $match: { status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).then(result => result[0]?.total || 0),
        pendingEscrow: await Payment.aggregate([
          { $match: { type: 'escrow', status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).then(result => result[0]?.total || 0),
        thisMonth: await Payment.aggregate([
          {
            $match: {
              status: 'completed',
              createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
            }
          },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).then(result => result[0]?.total || 0)
      },
      reviews: {
        total: await Review.countDocuments(),
        pending: await Review.countDocuments({ moderationStatus: 'pending' }),
        flagged: await Review.countDocuments({ 'flags.status': 'pending' }),
        averageRating: await Review.aggregate([
          { $match: { moderationStatus: 'approved' } },
          { $group: { _id: null, avg: { $avg: '$rating' } } }
        ]).then(result => Math.round((result[0]?.avg || 0) * 10) / 10)
      }
    };

    const recentActivity = {
      newUsers: await User.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('firstName lastName email createdAt'),
      recentJobs: await Job.find()
        .populate('client', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title status budget createdAt client'),
      pendingReviews: await Review.find({ moderationStatus: 'pending' })
        .populate('reviewer reviewee', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('rating comment reviewer reviewee createdAt')
    };

    res.json({
      message: 'Admin dashboard data retrieved successfully',
      stats,
      recentActivity,
      admin: req.admin.getPublicProfile()
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard data' });
  }
});

router.get('/users', authenticateAdmin, requirePermission('user_management'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = {};
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (status !== 'all') {
      switch (status) {
        case 'active':
          query.isActive = true;
          query.isSuspended = false;
          break;
        case 'suspended':
          query.isSuspended = true;
          break;
        case 'inactive':
          query.isActive = false;
          break;
      }
    }

    const users = await User.find(query)
      .select('-password -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires -bankAccount -paypalEmail -stripeAccountId')
      .sort({ [sortBy]: sortOrder })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

router.put('/users/:userId/suspend', authenticateAdmin, requirePermission('user_management'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Suspension reason is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.suspend(reason);

    res.json({
      message: 'User suspended successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Admin suspend user error:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

router.put('/users/:userId/unsuspend', authenticateAdmin, requirePermission('user_management'), async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.unsuspend();

    res.json({
      message: 'User unsuspended successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Admin unsuspend user error:', error);
    res.status(500).json({ error: 'Failed to unsuspend user' });
  }
});

router.get('/jobs', authenticateAdmin, requirePermission('job_management'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || 'all';
    const category = req.query.category || 'all';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = {};
    
    if (status !== 'all') {
      query.status = status;
    }
    
    if (category !== 'all') {
      query.category = category;
    }

    const jobs = await Job.find(query)
      .populate('client', 'firstName lastName email')
      .populate('freelancer', 'firstName lastName email')
      .sort({ [sortBy]: sortOrder })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Job.countDocuments(query);

    res.json({
      jobs,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Admin jobs error:', error);
    res.status(500).json({ error: 'Failed to retrieve jobs' });
  }
});

router.put('/jobs/:jobId/cancel', authenticateAdmin, requirePermission('job_management'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await job.cancelJob(reason || 'Cancelled by admin');

    res.json({
      message: 'Job cancelled successfully',
      job
    });
  } catch (error) {
    console.error('Admin cancel job error:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

router.get('/payments', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || 'all';
    const type = req.query.type || 'all';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = {};
    
    if (status !== 'all') {
      query.status = status;
    }
    
    if (type !== 'all') {
      query.type = type;
    }

    const payments = await Payment.find(query)
      .populate('client', 'firstName lastName email')
      .populate('freelancer', 'firstName lastName email')
      .populate('job', 'title')
      .sort({ [sortBy]: sortOrder })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.json({
      payments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Admin payments error:', error);
    res.status(500).json({ error: 'Failed to retrieve payments' });
  }
});

router.get('/reviews', authenticateAdmin, requirePermission('content_moderation'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || 'all';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = {};
    
    if (status !== 'all') {
      if (status === 'flagged') {
        query['flags.status'] = 'pending';
      } else {
        query.moderationStatus = status;
      }
    }

    const reviews = await Review.find(query)
      .populate('reviewer', 'firstName lastName email')
      .populate('reviewee', 'firstName lastName email')
      .populate('job', 'title')
      .sort({ [sortBy]: sortOrder })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(query);

    res.json({
      reviews,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Admin reviews error:', error);
    res.status(500).json({ error: 'Failed to retrieve reviews' });
  }
});

router.put('/reviews/:reviewId/moderate', authenticateAdmin, requirePermission('content_moderation'), async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status, notes } = req.body;

    if (!['approved', 'rejected', 'hidden'].includes(status)) {
      return res.status(400).json({ error: 'Invalid moderation status' });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    await review.moderate(status, req.admin._id, notes);

    res.json({
      message: 'Review moderated successfully',
      review
    });
  } catch (error) {
    console.error('Admin moderate review error:', error);
    res.status(500).json({ error: 'Failed to moderate review' });
  }
});

router.get('/analytics', authenticateAdmin, requirePermission('analytics_view'), async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let dateFilter;
    const now = new Date();
    
    switch (period) {
      case '7d':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const analytics = {
      userGrowth: await User.aggregate([
        { $match: { createdAt: { $gte: dateFilter } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      jobsPosted: await Job.aggregate([
        { $match: { createdAt: { $gte: dateFilter } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      paymentVolume: await Payment.aggregate([
        { 
          $match: { 
            createdAt: { $gte: dateFilter },
            status: 'completed'
          } 
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            volume: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      topCategories: await Job.aggregate([
        { $match: { createdAt: { $gte: dateFilter } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    };

    res.json({
      message: 'Analytics data retrieved successfully',
      period,
      analytics
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics data' });
  }
});

router.get('/monitoring', authenticateAdmin, async (req, res) => {
  try {
    const io = req.app.get('io');
    const activeUsers = io.getActiveUsers();
    
    const connectionStats = {
      totalConnections: Array.from(activeUsers.values()).reduce((sum, sockets) => sum + sockets.size, 0),
      uniqueUsers: activeUsers.size,
      averageConnectionsPerUser: activeUsers.size > 0 ? 
        Array.from(activeUsers.values()).reduce((sum, sockets) => sum + sockets.size, 0) / activeUsers.size : 0
    };

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messageStats = {
      totalMessages: await Message.countDocuments({ createdAt: { $gte: last24Hours } }),
      groupMessages: await Message.countDocuments({ 
        roomId: { $exists: true }, 
        createdAt: { $gte: last24Hours } 
      }),
      directMessages: await Message.countDocuments({ 
        conversation: { $exists: true }, 
        createdAt: { $gte: last24Hours } 
      }),
      unreadMessages: await Message.countDocuments({ isRead: false })
    };

    const roomStats = {
      totalRooms: await ChatRoom.countDocuments({ isActive: true }),
      activeRooms: await ChatRoom.countDocuments({ 
        isActive: true, 
        lastActivity: { $gte: last24Hours } 
      }),
      averageMembersPerRoom: await ChatRoom.aggregate([
        { $match: { isActive: true } },
        { $project: { memberCount: { $size: '$members' } } },
        { $group: { _id: null, avg: { $avg: '$memberCount' } } }
      ]).then(result => Math.round((result[0]?.avg || 0) * 10) / 10)
    };

    const onlineUsersList = await User.find({
      _id: { $in: Array.from(activeUsers.keys()) }
    }).select('firstName lastName email lastActive').limit(50);

    res.json({
      message: 'Monitoring data retrieved successfully',
      timestamp: new Date(),
      connectionStats,
      messageStats,
      roomStats,
      onlineUsers: onlineUsersList,
      systemHealth: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version
      }
    });
  } catch (error) {
    console.error('Admin monitoring error:', error);
    res.status(500).json({ error: 'Failed to retrieve monitoring data' });
  }
});

module.exports = router;
