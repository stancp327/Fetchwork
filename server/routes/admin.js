const express = require('express');
const router = express.Router();
const { authenticateAdmin, requirePermission } = require('../middleware/auth');
const { validateUserSuspension, validateReviewModeration, validateQueryParams, validateUserIdParam, validateJobIdParam, validateReviewIdParam } = require('../middleware/validation');
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
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    const userStatsAgg = await User.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          active: [
            { $match: { isActive: true, isSuspended: false } },
            { $count: 'count' }
          ],
          suspended: [
            { $match: { isSuspended: true } },
            { $count: 'count' }
          ],
          newThisMonth: [
            { $match: { createdAt: { $gte: thisMonthStart } } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const jobStatsAgg = await Job.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          active: [
            { $match: { status: { $in: ['open', 'in_progress'] } } },
            { $count: 'count' }
          ],
          completed: [
            { $match: { status: 'completed' } },
            { $count: 'count' }
          ],
          disputed: [
            { $match: { status: 'disputed' } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const paymentStatsAgg = await Payment.aggregate([
      {
        $facet: {
          totalVolume: [
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ],
          pendingEscrow: [
            { $match: { type: 'escrow', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ],
          thisMonth: [
            {
              $match: {
                status: 'completed',
                createdAt: { $gte: thisMonthStart }
              }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]
        }
      }
    ]);

    const reviewStatsAgg = await Review.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          pending: [
            { $match: { moderationStatus: 'pending' } },
            { $count: 'count' }
          ],
          flagged: [
            { $match: { 'flags.status': 'pending' } },
            { $count: 'count' }
          ],
          averageRating: [
            { $match: { moderationStatus: 'approved' } },
            { $group: { _id: null, avg: { $avg: '$rating' } } }
          ]
        }
      }
    ]);

    const stats = {
      users: {
        total: userStatsAgg[0].total[0]?.count || 0,
        active: userStatsAgg[0].active[0]?.count || 0,
        suspended: userStatsAgg[0].suspended[0]?.count || 0,
        newThisMonth: userStatsAgg[0].newThisMonth[0]?.count || 0
      },
      jobs: {
        total: jobStatsAgg[0].total[0]?.count || 0,
        active: jobStatsAgg[0].active[0]?.count || 0,
        completed: jobStatsAgg[0].completed[0]?.count || 0,
        disputed: jobStatsAgg[0].disputed[0]?.count || 0
      },
      payments: {
        totalVolume: paymentStatsAgg[0].totalVolume[0]?.total || 0,
        pendingEscrow: paymentStatsAgg[0].pendingEscrow[0]?.total || 0,
        thisMonth: paymentStatsAgg[0].thisMonth[0]?.total || 0
      },
      reviews: {
        total: reviewStatsAgg[0].total[0]?.count || 0,
        pending: reviewStatsAgg[0].pending[0]?.count || 0,
        flagged: reviewStatsAgg[0].flagged[0]?.count || 0,
        averageRating: Math.round((reviewStatsAgg[0].averageRating[0]?.avg || 0) * 10) / 10
      }
    };

    const recentActivity = {
      newUsers: await User.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('firstName lastName email createdAt')
        .lean(),
      recentJobs: await Job.find()
        .populate('client', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title status budget createdAt client')
        .lean(),
      pendingReviews: await Review.find({ moderationStatus: 'pending' })
        .populate('reviewer reviewee', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('rating comment reviewer reviewee createdAt')
        .lean()
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

router.get('/users', authenticateAdmin, requirePermission('user_management'), validateQueryParams, async (req, res) => {
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

router.put('/users/:userId/suspend', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, validateUserSuspension, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

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

router.put('/users/:userId/unsuspend', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, async (req, res) => {
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

router.get('/jobs', authenticateAdmin, requirePermission('job_management'), validateQueryParams, async (req, res) => {
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

router.put('/jobs/:jobId/cancel', authenticateAdmin, requirePermission('job_management'), validateJobIdParam, async (req, res) => {
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

router.get('/payments', authenticateAdmin, requirePermission('payment_management'), validateQueryParams, async (req, res) => {
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

router.get('/reviews', authenticateAdmin, requirePermission('content_moderation'), validateQueryParams, async (req, res) => {
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

router.put('/reviews/:reviewId/moderate', authenticateAdmin, requirePermission('content_moderation'), validateReviewIdParam, validateReviewModeration, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status, notes } = req.body;

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

router.get('/analytics', authenticateAdmin, requirePermission('analytics_view'), validateQueryParams, async (req, res) => {
  try {
    const { period = '30d', page = 1, limit = 100 } = req.query;
    
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
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      ])
    };

    res.json({
      message: 'Analytics data retrieved successfully',
      period,
      analytics,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
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
    
    const messageStatsAgg = await Message.aggregate([
      {
        $facet: {
          totalMessages: [
            { $match: { createdAt: { $gte: last24Hours } } },
            { $count: 'count' }
          ],
          groupMessages: [
            { 
              $match: { 
                roomId: { $exists: true }, 
                createdAt: { $gte: last24Hours } 
              } 
            },
            { $count: 'count' }
          ],
          directMessages: [
            { 
              $match: { 
                conversation: { $exists: true }, 
                createdAt: { $gte: last24Hours } 
              } 
            },
            { $count: 'count' }
          ],
          unreadMessages: [
            { $match: { isRead: false } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const roomStatsAgg = await ChatRoom.aggregate([
      {
        $facet: {
          totalRooms: [
            { $match: { isActive: true } },
            { $count: 'count' }
          ],
          activeRooms: [
            { 
              $match: { 
                isActive: true, 
                lastActivity: { $gte: last24Hours } 
              } 
            },
            { $count: 'count' }
          ],
          averageMembersPerRoom: [
            { $match: { isActive: true } },
            { $project: { memberCount: { $size: '$members' } } },
            { $group: { _id: null, avg: { $avg: '$memberCount' } } }
          ]
        }
      }
    ]);

    const messageStats = {
      totalMessages: messageStatsAgg[0].totalMessages[0]?.count || 0,
      groupMessages: messageStatsAgg[0].groupMessages[0]?.count || 0,
      directMessages: messageStatsAgg[0].directMessages[0]?.count || 0,
      unreadMessages: messageStatsAgg[0].unreadMessages[0]?.count || 0
    };

    const roomStats = {
      totalRooms: roomStatsAgg[0].totalRooms[0]?.count || 0,
      activeRooms: roomStatsAgg[0].activeRooms[0]?.count || 0,
      averageMembersPerRoom: Math.round((roomStatsAgg[0].averageMembersPerRoom[0]?.avg || 0) * 10) / 10
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

router.put('/users/:userId/promote', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const ADMIN_EMAILS = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : ['stancp327@gmail.com'];
    if (ADMIN_EMAILS.includes(user.email)) {
      return res.status(400).json({ error: 'User is already an admin' });
    }
    
    user.isAdminPromoted = true;
    await user.save();
    
    res.json({
      message: 'User promoted to admin successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Admin promote user error:', error);
    res.status(500).json({ error: 'Failed to promote user' });
  }
});

router.put('/users/:userId/demote', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const ADMIN_EMAILS = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : ['stancp327@gmail.com'];
    if (ADMIN_EMAILS.includes(user.email)) {
      return res.status(400).json({ error: 'Cannot demote hardcoded admin user' });
    }
    
    user.isAdminPromoted = false;
    await user.save();
    
    res.json({
      message: 'User demoted from admin successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Admin demote user error:', error);
    res.status(500).json({ error: 'Failed to demote user' });
  }
});

module.exports = router;
