const express = require('express');
const router = express.Router();
const { authenticateAdmin, requirePermission } = require('../middleware/auth');
const { validateUserSuspension, validateReviewModeration, validateQueryParams, validateUserIdParam, validateJobIdParam, validateReviewIdParam } = require('../middleware/validation');
const User = require('../models/User');
const { escapeRegex } = require('../utils/sanitize');
const Admin = require('../models/Admin');
const Job = require('../models/Job');
const Service = require('../models/Service');
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
      const safeSearch = escapeRegex(search);
      query.$or = [
        { firstName: { $regex: safeSearch, $options: 'i' } },
        { lastName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } }
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
    const search = req.query.search || '';
    const budgetMin = req.query.budgetMin ? parseFloat(req.query.budgetMin) : null;
    const budgetMax = req.query.budgetMax ? parseFloat(req.query.budgetMax) : null;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = {};
    
    if (status !== 'all') {
      query.status = status;
    }
    
    if (category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { skills: { $regex: search, $options: 'i' } }
      ];
    }

    if (budgetMin !== null || budgetMax !== null) {
      query['budget.amount'] = {};
      if (budgetMin !== null) query['budget.amount'].$gte = budgetMin;
      if (budgetMax !== null) query['budget.amount'].$lte = budgetMax;
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

// ── Services Admin ──────────────────────────────────────────────
router.get('/services', authenticateAdmin, requirePermission('job_management'), validateQueryParams, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || 'all';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = {};
    if (status !== 'all') query.status = status;

    const services = await Service.find(query)
      .populate('freelancer', 'firstName lastName email')
      .sort({ [sortBy]: sortOrder })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Service.countDocuments(query);

    res.json({
      services,
      pagination: { current: page, pages: Math.ceil(total / limit), total, limit }
    });
  } catch (error) {
    console.error('Admin services error:', error);
    res.status(500).json({ error: 'Failed to retrieve services' });
  }
});

router.delete('/services/:serviceId', authenticateAdmin, requirePermission('job_management'), async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    service.isActive = false;
    service.status = 'paused';
    await service.save();

    res.json({ message: 'Service removed successfully', service: { _id: service._id, title: service.title } });
  } catch (error) {
    console.error('Admin remove service error:', error);
    res.status(500).json({ error: 'Failed to remove service' });
  }
});

router.delete('/jobs/:jobId', authenticateAdmin, requirePermission('job_management'), validateJobIdParam, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Soft delete: deactivate and mark as removed
    job.isActive = false;
    job.status = 'cancelled';
    job.adminAction = {
      action: 'removed',
      reason: reason || 'Removed by admin',
      removedAt: new Date(),
      removedBy: req.admin._id
    };
    await job.save();

    res.json({
      message: 'Job removed successfully',
      job: { _id: job._id, title: job.title, status: job.status }
    });
  } catch (error) {
    console.error('Admin remove job error:', error);
    res.status(500).json({ error: 'Failed to remove job' });
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

// Admin delete review
router.delete('/reviews/:reviewId', authenticateAdmin, requirePermission('content_moderation'), validateReviewIdParam, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId).populate('reviewee', 'firstName lastName');
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const revieweeName = `${review.reviewee?.firstName} ${review.reviewee?.lastName}`;
    const revieweeId = review.reviewee?._id;

    await Review.findByIdAndDelete(req.params.reviewId);

    // Recalculate reviewee's rating
    if (revieweeId) {
      const stats = await Review.aggregate([
        { $match: { reviewee: revieweeId, isPublic: true, moderationStatus: { $in: ['approved', 'pending'] } } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]);
      await User.findByIdAndUpdate(revieweeId, {
        rating: stats[0]?.avg ? Math.round(stats[0].avg * 10) / 10 : 0,
        totalReviews: stats[0]?.count || 0
      });
    }

    res.json({ message: `Review for ${revieweeName} deleted and rating recalculated` });
  } catch (error) {
    console.error('Admin delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// ID Verification: list pending
router.get('/verifications', authenticateAdmin, requirePermission('content_moderation'), async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const users = await User.find({ 'idVerification.status': status })
      .select('firstName lastName email profilePicture idVerification verificationLevel createdAt')
      .sort({ 'idVerification.submittedAt': -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load verifications' });
  }
});

// ID Verification: approve/reject
router.put('/verifications/:userId', authenticateAdmin, requirePermission('content_moderation'), validateUserIdParam, async (req, res) => {
  try {
    const { action, notes } = req.body; // action: 'approve' | 'reject'
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (action === 'approve') {
      user.idVerification.status = 'approved';
      user.idVerification.reviewedBy = req.admin._id;
      user.idVerification.reviewedAt = new Date();
      user.idVerification.notes = notes || '';
      user.verificationLevel = 'identity';
      if (!user.badges.includes('id_verified')) user.badges.push('id_verified');
    } else if (action === 'reject') {
      user.idVerification.status = 'rejected';
      user.idVerification.reviewedBy = req.admin._id;
      user.idVerification.reviewedAt = new Date();
      user.idVerification.notes = notes || 'Verification rejected';
    } else {
      return res.status(400).json({ error: 'Invalid action. Use approve or reject.' });
    }
    await user.save();
    res.json({ message: `Verification ${action}d for ${user.firstName}`, user: { verificationLevel: user.verificationLevel, badges: user.badges, idVerification: user.idVerification } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update verification' });
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

router.delete('/users/:userId', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(400).json({ error: 'User is already deleted' });
    }

    await user.deleteUser(reason || 'Account deleted by admin');

    res.json({
      message: 'User deleted successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ── Promote/demote moderator ────────────────────────────────────
router.put('/users/:userId/make-moderator', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const customPerms = req.body.permissions || [];
    user.role = 'moderator';
    user.permissions = customPerms;
    await user.save();
    
    res.json({ message: `${user.firstName} is now a moderator`, permissions: customPerms });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

router.put('/users/:userId/remove-moderator', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    user.role = 'user';
    user.permissions = [];
    await user.save();
    
    res.json({ message: `${user.firstName} is no longer a moderator` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// ── User detail with all their jobs ─────────────────────────────
router.get('/users/:userId/detail', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password -resetPasswordToken -emailVerificationToken');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [jobsAsClient, jobsAsFreelancer, services, reviews] = await Promise.all([
      Job.find({ client: user._id }).select('title status budget createdAt proposalCount category freelancer').populate('freelancer', 'firstName lastName').sort({ createdAt: -1 }),
      Job.find({ freelancer: user._id }).select('title status budget createdAt category client').populate('client', 'firstName lastName').sort({ createdAt: -1 }),
      Service.find({ freelancer: user._id }).select('title status category pricing isActive createdAt').sort({ createdAt: -1 }),
      Review.find({ $or: [{ freelancer: user._id }, { client: user._id }] }).populate('freelancer client', 'firstName lastName').sort({ createdAt: -1 }).limit(50)
    ]);

    res.json({
      user: user.toObject(),
      jobsAsClient,
      jobsAsFreelancer,
      services,
      reviews,
      summary: {
        totalJobsPosted: jobsAsClient.length,
        totalJobsWorked: jobsAsFreelancer.length,
        totalServices: services.length,
        totalReviews: reviews.length,
        accountAge: Math.floor((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24))
      }
    });
  } catch (error) {
    console.error('User detail error:', error);
    res.status(500).json({ error: 'Failed to fetch user detail' });
  }
});

// ── Fee waiver ──────────────────────────────────────────────────
router.put('/users/:userId/fee-waiver', authenticateAdmin, requirePermission('fee_waiver'), validateUserIdParam, async (req, res) => {
  try {
    const { enabled, reason, expiresAt, maxJobs } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (enabled) {
      user.feeWaiver = {
        enabled: true,
        reason: reason || '',
        waivedBy: req.admin._id,
        waivedAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxJobs: maxJobs ? parseInt(maxJobs) : null,
        jobsUsed: 0
      };
    } else {
      user.feeWaiver = { enabled: false, reason: '', waivedBy: null, waivedAt: null, expiresAt: null, maxJobs: null, jobsUsed: 0 };
    }
    await user.save();

    res.json({
      message: enabled
        ? `Fee waiver for ${user.firstName}: ${maxJobs || '∞'} jobs, expires ${expiresAt ? new Date(expiresAt).toLocaleDateString() : 'never'}`
        : `Fee waiver removed for ${user.firstName}`,
      feeWaiver: user.feeWaiver
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update fee waiver' });
  }
});

// ── Admin search users (enhanced) ───────────────────────────────
router.get('/users/search', authenticateAdmin, requirePermission('user_management'), async (req, res) => {
  try {
    const { q, role, status } = req.query;
    const query = {};
    
    if (q) {
      query.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } }
      ];
    }
    if (role && role !== 'all') query.role = role;
    if (status === 'suspended') query.isSuspended = true;
    if (status === 'active') { query.isActive = true; query.isSuspended = false; }
    if (status === 'inactive') query.isActive = false;

    const users = await User.find(query)
      .select('firstName lastName email role isActive isSuspended isVerified rating completedJobs createdAt profilePicture feeWaiver')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ users, total: users.length });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
