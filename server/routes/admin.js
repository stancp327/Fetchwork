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
const Team = require('../models/Team');
const { Message, ChatRoom } = require('../models/Message');
const { logAdminAction, AdminAuditLog } = require('../utils/adminAudit');

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
    const roleFilter = req.query.role || 'all';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = {};
    if (roleFilter !== 'all') query.role = roleFilter;
    
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
      .select('-password -resetPasswordToken -resetPasswordExpires -emailVerificationToken -bankAccount -emailVerificationExpires -bankAccount -paypalEmail -stripeAccountId')
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

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: user._id, action: 'user.suspend',
      reason, ip: req.ip,
    });

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

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: user._id, action: 'user.unsuspend',
      ip: req.ip,
    });

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

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: job.client, action: 'job.cancel',
      reason: reason || 'Cancelled by admin',
      metadata: { jobId: job._id, jobTitle: job.title },
      ip: req.ip,
    });

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

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: service.freelancer, action: 'service.delete',
      metadata: { serviceId: service._id, serviceTitle: service.title },
      ip: req.ip,
    });

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

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: job.client, action: 'job.delete',
      reason: reason || 'Removed by admin',
      metadata: { jobId: job._id, jobTitle: job.title },
      ip: req.ip,
    });

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

    const oldStatus = review.moderationStatus;
    await review.moderate(status, req.admin._id, notes);

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: review.reviewee, action: 'review.moderate',
      reason: notes,
      oldValue: { moderationStatus: oldStatus },
      newValue: { moderationStatus: status },
      metadata: { reviewId: review._id },
      ip: req.ip,
    });

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

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: revieweeId, action: 'review.delete',
      reason: req.body.reason,
      metadata: { reviewId: req.params.reviewId, revieweeName, rating: review.rating },
      ip: req.ip,
    });

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

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: user._id, action: `verification.${action}`,
      reason: notes,
      newValue: { verificationLevel: user.verificationLevel },
      ip: req.ip,
    });

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

    // Only hardcoded admins can promote to admin (prevent privilege escalation)
    const ADMIN_EMAILS = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : ['stancp327@gmail.com'];
    if (!ADMIN_EMAILS.includes(req.admin.email)) {
      return res.status(403).json({ error: 'Only the platform owner can promote admins' });
    }

    // Can't promote yourself
    if (userId === req.admin._id.toString()) {
      return res.status(400).json({ error: 'Cannot promote yourself' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'admin' || ADMIN_EMAILS.includes(user.email)) {
      return res.status(400).json({ error: 'User is already an admin' });
    }

    await User.updateOne({ _id: userId }, {
      $set: { isAdminPromoted: true, role: 'admin' },
      $inc: { tokenVersion: 1 }  // Invalidate existing JWTs
    });

    console.log(`[AUDIT] User ${user.email} promoted to admin by ${req.admin.email}`);

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: user._id, action: 'user.promote',
      oldValue: { role: user.role },
      newValue: { role: 'admin' },
      ip: req.ip,
    });

    res.json({
      message: 'User promoted to admin successfully',
      user: { ...user.toObject(), role: 'admin', isAdminPromoted: true }
    });
  } catch (error) {
    console.error('Admin promote user error:', error);
    res.status(500).json({ error: 'Failed to promote user' });
  }
});

router.put('/users/:userId/demote', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, async (req, res) => {
  try {
    const { userId } = req.params;

    // Only hardcoded admins can demote (prevent privilege escalation)
    const ADMIN_EMAILS = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : ['stancp327@gmail.com'];
    if (!ADMIN_EMAILS.includes(req.admin.email)) {
      return res.status(403).json({ error: 'Only the platform owner can demote admins' });
    }

    // Can't demote yourself
    if (userId === req.admin._id.toString()) {
      return res.status(400).json({ error: 'Cannot demote yourself' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (ADMIN_EMAILS.includes(user.email)) {
      return res.status(400).json({ error: 'Cannot demote hardcoded admin user' });
    }

    await User.updateOne({ _id: userId }, {
      $set: { isAdminPromoted: false, role: 'user' },
      $inc: { tokenVersion: 1 }  // Invalidate existing JWTs
    });

    console.log(`[AUDIT] User ${user.email} demoted from admin by ${req.admin.email}`);

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: user._id, action: 'user.demote',
      oldValue: { role: user.role },
      newValue: { role: 'user' },
      ip: req.ip,
    });

    res.json({
      message: 'User demoted from admin successfully',
      user: { ...user.toObject(), role: 'user', isAdminPromoted: false }
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

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: user._id, action: 'user.delete',
      reason: reason || 'Account deleted by admin',
      metadata: { email: user.email, name: `${user.firstName} ${user.lastName}` },
      ip: req.ip,
    });

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
    await User.updateOne({ _id: req.params.userId }, {
      $set: { role: 'moderator', permissions: customPerms },
      $inc: { tokenVersion: 1 }
    });

    console.log(`[AUDIT] User ${user.email} made moderator by ${req.admin.email}`);

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: user._id, action: 'user.make-moderator',
      oldValue: { role: user.role },
      newValue: { role: 'moderator', permissions: customPerms },
      ip: req.ip,
    });

    res.json({ message: `${user.firstName} is now a moderator`, permissions: customPerms });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

router.put('/users/:userId/remove-moderator', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    await User.updateOne({ _id: req.params.userId }, {
      $set: { role: 'user', permissions: [] },
      $inc: { tokenVersion: 1 }
    });

    console.log(`[AUDIT] User ${user.email} removed as moderator by ${req.admin.email}`);

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: user._id, action: 'user.remove-moderator',
      oldValue: { role: user.role },
      newValue: { role: 'user' },
      ip: req.ip,
    });

    res.json({ message: `${user.firstName} is no longer a moderator` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// ── Permission catalog + role defaults ──────────────────────────
const ALL_PERMISSIONS = [
  { key: 'user_management',    label: 'User Management',    description: 'Suspend, unsuspend, promote/demote users' },
  { key: 'job_management',     label: 'Job Management',     description: 'Edit, remove, feature, archive jobs' },
  { key: 'content_moderation', label: 'Content Moderation', description: 'Review and remove listings, reviews, profiles' },
  { key: 'payment_management', label: 'Payment Management', description: 'View payments, issue refunds, waive fees' },
  { key: 'dispute_management', label: 'Dispute Management', description: 'Review and resolve disputes between users' },
  { key: 'analytics_view',     label: 'Analytics View',     description: 'Access platform analytics and reports' },
  { key: 'fee_waiver',         label: 'Fee Waiver',         description: 'Waive platform fees for specific users/jobs' },
  { key: 'user_impersonation', label: 'User Impersonation', description: 'Log in as another user for support purposes' },
  { key: 'system_settings',    label: 'System Settings',    description: 'Edit platform config, billing plans, cron jobs' },
];

const ROLE_DEFAULTS = {
  admin:     ALL_PERMISSIONS.map(p => p.key),
  moderator: ['job_management', 'content_moderation', 'dispute_management'],
  user:      [],
};

router.get('/permissions', authenticateAdmin, async (req, res) => {
  res.json({ permissions: ALL_PERMISSIONS, roleDefaults: ROLE_DEFAULTS });
});

// ── Update a user's custom permissions ──────────────────────────
router.put('/users/:userId/permissions', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, async (req, res) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) return res.status(400).json({ error: 'permissions must be an array' });

    const validKeys = ALL_PERMISSIONS.map(p => p.key);
    const filtered  = permissions.filter(p => validKeys.includes(p));

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'moderator') return res.status(400).json({ error: 'Custom permissions only apply to moderators' });

    const oldPerms = [...(user.permissions || [])];
    user.permissions = filtered;
    await user.save();

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: user._id, action: 'user.permissions-update',
      oldValue: { permissions: oldPerms },
      newValue: { permissions: filtered },
      ip: req.ip,
    });

    res.json({ message: 'Permissions updated', permissions: filtered });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update permissions' });
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

// ═══════════════════════════════════════════════════════════════
// 💳 BILLING ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════
const Plan             = require('../models/Plan');
const UserSubscription = require('../models/UserSubscription');
const BillingCredit    = require('../models/BillingCredit');
const BillingAuditLog  = require('../models/BillingAuditLog');
const PromoRule        = require('../models/PromoRule');
const { logBillingAction } = require('../utils/billingUtils');

// ── GET /api/admin/billing/plans ────────────────────────────────
// List all plans with live subscriber counts
router.get('/billing/plans', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const plans = await Plan.find().sort('sortOrder').lean();
    // Attach subscriber counts
    const counts = await UserSubscription.aggregate([
      { $match: { status: { $in: ['active', 'trialing'] } } },
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map(c => [String(c._id), c.count]));
    const enriched = plans.map(p => ({ ...p, subscriberCount: countMap[String(p._id)] || 0 }));
    res.json({ plans: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// ── POST /api/admin/billing/plans ───────────────────────────────
// Create a new plan
router.post('/billing/plans', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const plan = await Plan.create(req.body);
    res.status(201).json({ plan });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to create plan' });
  }
});

// ── PUT /api/admin/billing/plans/:planId ────────────────────────
// Edit a plan (price changes don't cascade to existing subscribers — grandfathered)
router.put('/billing/plans/:planId', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.planId, { $set: req.body }, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ plan });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update plan' });
  }
});

// ── GET /api/admin/users/:userId/billing ────────────────────────
// Full billing history for a user: subscription, credits, audit log
router.get('/users/:userId/billing', authenticateAdmin, requirePermission('payment_management'), validateUserIdParam, async (req, res) => {
  try {
    const { userId } = req.params;
    const [sub, credits, auditLog, promos] = await Promise.all([
      UserSubscription.findOne({ user: userId }).populate('plan grantedBy', 'firstName lastName email slug name').lean(),
      BillingCredit.find({ user: userId }).sort({ createdAt: -1 }).lean(),
      BillingAuditLog.find({ user: userId }).sort({ createdAt: -1 }).limit(50).lean(),
      PromoRule.find({ specificUsers: userId, active: true }).lean(),
    ]);
    res.json({ subscription: sub, credits, auditLog, promos });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

// ── POST /api/admin/users/:userId/billing/grant ─────────────────
// Manually grant a plan to a user (with optional custom price + expiry)
router.post('/users/:userId/billing/grant', authenticateAdmin, requirePermission('payment_management'), validateUserIdParam, async (req, res) => {
  try {
    const { userId } = req.params;
    const { planSlug, customPrice, expiresAt, reason } = req.body;
    if (!planSlug || !reason) return res.status(400).json({ error: 'planSlug and reason are required' });

    const plan = await Plan.findOne({ slug: planSlug, active: true });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const existing = await UserSubscription.findOne({ user: userId });
    const before = existing ? { planSlug: String(existing.plan) } : null;

    const sub = await UserSubscription.findOneAndUpdate(
      { user: userId },
      {
        plan:          plan._id,
        status:        'active',
        customPrice:   customPrice ?? null,
        grantedBy:     req.user.userId,
        grantReason:   reason,
        grantExpiresAt: expiresAt ? new Date(expiresAt) : null,
        source:        'admin_grant',
        stripeSubscriptionId: null,
      },
      { upsert: true, new: true }
    );

    await logBillingAction({
      userId,
      action:  'plan_granted',
      before,
      after:   { planSlug: plan.slug, customPrice, expiresAt },
      adminId: req.user.userId,
      note:    reason,
    });

    res.json({ subscription: sub, message: `${plan.name} granted to user` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to grant plan' });
  }
});

// ── POST /api/admin/users/:userId/billing/fee-override ──────────
// Set custom fee rates for a user (overrides plan defaults)
router.post('/users/:userId/billing/fee-override', authenticateAdmin, requirePermission('payment_management'), validateUserIdParam, async (req, res) => {
  try {
    const { userId } = req.params;
    const { feeRateOverrides, reason } = req.body;
    if (!feeRateOverrides || !reason) return res.status(400).json({ error: 'feeRateOverrides and reason are required' });

    const sub = await UserSubscription.findOne({ user: userId });
    const before = sub?.feeRateOverrides || null;

    const updated = await UserSubscription.findOneAndUpdate(
      { user: userId },
      { $set: { feeRateOverrides } },
      { upsert: true, new: true }
    );

    await logBillingAction({
      userId,
      action:  'fee_override_set',
      before,
      after:   feeRateOverrides,
      adminId: req.user.userId,
      note:    reason,
    });

    res.json({ subscription: updated, message: 'Fee override applied' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set fee override' });
  }
});

// ── POST /api/admin/users/:userId/billing/fee-override/remove ───
// Remove custom fee rate overrides (revert to plan defaults)
router.post('/users/:userId/billing/fee-override/remove', authenticateAdmin, requirePermission('payment_management'), validateUserIdParam, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const sub = await UserSubscription.findOne({ user: userId });
    const before = sub?.feeRateOverrides || null;

    await UserSubscription.findOneAndUpdate(
      { user: userId },
      { $unset: { feeRateOverrides: '' } }
    );

    await logBillingAction({
      userId,
      action:  'fee_override_removed',
      before,
      after:   null,
      adminId: req.user.userId,
      note:    reason || 'Fee override removed by admin',
    });

    res.json({ message: 'Fee overrides removed — plan defaults restored' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove fee override' });
  }
});

// ── POST /api/admin/users/:userId/billing/credit ────────────────
// Add a billing credit (goodwill gesture, refund credit, promo)
router.post('/users/:userId/billing/credit', authenticateAdmin, requirePermission('payment_management'), validateUserIdParam, async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason, expiresAt } = req.body;
    if (!amount || !reason) return res.status(400).json({ error: 'amount and reason are required' });
    if (amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

    const credit = await BillingCredit.create({
      user:      userId,
      amount,
      reason,
      appliedBy: req.user.userId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    await logBillingAction({
      userId,
      action:  'credit_added',
      before:  null,
      after:   { amount, reason, expiresAt },
      adminId: req.user.userId,
      note:    reason,
    });

    res.status(201).json({ credit, message: `$${amount} credit added` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add credit' });
  }
});

// ── GET /api/admin/billing/promos ───────────────────────────────
router.get('/billing/promos', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const promos = await PromoRule.find().sort({ createdAt: -1 }).lean();
    res.json({ promos });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch promo rules' });
  }
});

// ── POST /api/admin/billing/promo ───────────────────────────────
// Create a promo rule (cohort fee override, seasonal discount, retention offer)
router.post('/billing/promo', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const promo = await PromoRule.create({ ...req.body, createdBy: req.user.userId });
    res.status(201).json({ promo });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to create promo rule' });
  }
});

// ── PUT /api/admin/billing/promo/:promoId ───────────────────────
router.put('/billing/promo/:promoId', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const promo = await PromoRule.findByIdAndUpdate(req.params.promoId, { $set: req.body }, { new: true });
    if (!promo) return res.status(404).json({ error: 'Promo not found' });
    res.json({ promo });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update promo' });
  }
});

// ── STRIPE CATALOG MANAGEMENT ─────────────────────────────────────
// These endpoints create/update in Stripe AND sync to MongoDB in one step.
// Igor (the AI) can call these directly when Chaz says "add a new plan".

// GET /api/admin/stripe/catalog — list Stripe Products with their Prices
router.get('/stripe/catalog', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const stripeService = require('../services/stripeService');
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const [products, prices, plans] = await Promise.all([
      stripe.products.list({ limit: 50, active: true }),
      stripe.prices.list({ limit: 100, active: true }),
      Plan.find().lean(),
    ]);

    const priceMap = {};
    prices.data.forEach(p => {
      if (!priceMap[p.product]) priceMap[p.product] = [];
      priceMap[p.product].push({
        id:       p.id,
        amount:   p.unit_amount / 100,
        currency: p.currency,
        interval: p.recurring?.interval || 'one_time',
        active:   p.active,
      });
    });

    const plansByProduct = {};
    plans.forEach(p => { if (p.stripeProductId) plansByProduct[p.stripeProductId] = p; });

    const catalog = products.data.map(prod => ({
      id:          prod.id,
      name:        prod.name,
      description: prod.description,
      active:      prod.active,
      prices:      priceMap[prod.id] || [],
      dbPlan:      plansByProduct[prod.id] || null,
    }));

    res.json({ catalog });
  } catch (err) {
    console.error('Stripe catalog error:', err.message);
    res.status(500).json({ error: 'Failed to fetch Stripe catalog' });
  }
});

// POST /api/admin/stripe/plans — create plan in DB + Stripe Product + Price
// Body: { name, description, slug, audience, tier, price, interval, features, limits }
router.post('/stripe/plans', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const stripeService = require('../services/stripeService');
    const { name, description, slug, audience, tier, price, interval = 'month', features, limits, sortOrder } = req.body;

    if (!name || !slug || !tier || !price) {
      return res.status(400).json({ error: 'name, slug, tier, and price are required' });
    }
    if (await Plan.findOne({ slug })) {
      return res.status(409).json({ error: `Plan slug '${slug}' already exists` });
    }

    // 1. Create Stripe Product
    const product = await stripeService.createProduct(name, description || '');

    // 2. Create Stripe Price
    const stripePrice = await stripeService.createPrice(
      product.id,
      Math.round(price * 100),
      interval === 'year' ? 'year' : 'month'
    );

    // 3. Save to DB
    const plan = await Plan.create({
      name, description, slug, audience, tier, price,
      interval,
      features:        features || [],
      limits:          limits || {},
      sortOrder:       sortOrder || 99,
      stripeProductId: product.id,
      stripePriceId:   stripePrice.id,
      active:          true,
    });

    res.status(201).json({ plan, stripeProductId: product.id, stripePriceId: stripePrice.id });
  } catch (err) {
    console.error('Create Stripe plan error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create plan' });
  }
});

// PUT /api/admin/stripe/plans/:planId/price — change price (creates new Stripe Price, archives old)
// Body: { price, interval }
router.put('/stripe/plans/:planId/price', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const stripeService = require('../services/stripeService');
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const plan = await Plan.findById(req.params.planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const { price, interval } = req.body;
    if (!price) return res.status(400).json({ error: 'price is required' });

    // Archive old Price in Stripe
    if (plan.stripePriceId) {
      await stripe.prices.update(plan.stripePriceId, { active: false }).catch(() => {});
    }

    // Create new Price
    const newPrice = await stripeService.createPrice(
      plan.stripeProductId,
      Math.round(price * 100),
      (interval || plan.interval) === 'year' ? 'year' : 'month'
    );

    plan.price        = price;
    plan.stripePriceId = newPrice.id;
    if (interval) plan.interval = interval;
    await plan.save();

    res.json({ plan, newStripePriceId: newPrice.id });
  } catch (err) {
    console.error('Update plan price error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update price' });
  }
});

// PUT /api/admin/stripe/products/:productId — update Stripe product name/description
router.put('/stripe/products/:productId', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { name, description } = req.body;
    const product = await stripe.products.update(req.params.productId, {
      ...(name        && { name }),
      ...(description && { description }),
    });
    // Sync name to local DB plan
    if (name) await Plan.findOneAndUpdate({ stripeProductId: req.params.productId }, { name });
    res.json({ product });
  } catch (err) {
    console.error('Update Stripe product error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update product' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// USER SEARCH — for admin panels (feature groups, etc.)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/users/search', authenticateAdmin, requirePermission('user_management'), async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q || q.length < 2) return res.json({ users: [] });

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({
      $or: [
        { email: regex },
        { firstName: regex },
        { lastName: regex },
      ],
    })
      .select('firstName lastName email accountType role profilePicture')
      .limit(Math.min(Number(limit), 25))
      .lean();

    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE GRANTS — per-user admin overrides
// ─────────────────────────────────────────────────────────────────────────────

const { setUserFeature, removeUserFeature, getUserGrants, getUserFeatures, FEATURES } = require('../services/entitlementEngine');

// GET /admin/users/:userId/features — get all feature grants + resolved access for a user
router.get('/users/:userId/features', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, async (req, res) => {
  try {
    const [grants, resolved] = await Promise.all([
      getUserGrants(req.params.userId),
      getUserFeatures(req.params.userId),
    ]);
    res.json({ grants, resolved, availableFeatures: Object.values(FEATURES) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/users/:userId/features — grant or revoke a feature for a user
router.post('/users/:userId/features', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, async (req, res) => {
  try {
    const { feature, enabled = true, reason, expiresAt } = req.body;
    if (!feature) return res.status(400).json({ error: 'feature is required' });
    if (!Object.values(FEATURES).includes(feature)) {
      return res.status(400).json({ error: `Unknown feature: ${feature}`, availableFeatures: Object.values(FEATURES) });
    }

    const grant = await setUserFeature({
      userId:    req.params.userId,
      feature,
      enabled:   enabled !== false,
      grantedBy: req.user._id || req.user.id,
      reason,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    const User = require('../models/User');
    const user = await User.findById(req.params.userId).select('firstName lastName email').lean();
    console.log(`[admin] Feature grant: ${feature}=${enabled} for user ${user?.email} by admin ${req.user.email}`);

    await logAdminAction({
      adminId: req.user._id || req.user.id, adminEmail: req.user.email,
      targetId: req.params.userId, action: enabled ? 'feature.grant' : 'feature.revoke',
      reason,
      newValue: { feature, enabled },
      metadata: { expiresAt: expiresAt || null },
      ip: req.ip,
    });

    res.json({ message: `Feature "${feature}" ${enabled ? 'granted' : 'revoked'} successfully`, grant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/users/:userId/features/:feature — remove a feature grant (revert to plan)
router.delete('/users/:userId/features/:feature', authenticateAdmin, requirePermission('user_management'), validateUserIdParam, async (req, res) => {
  try {
    await removeUserFeature(req.params.userId, req.params.feature);

    await logAdminAction({
      adminId: req.user._id || req.user.id, adminEmail: req.user.email,
      targetId: req.params.userId, action: 'feature.remove',
      metadata: { feature: req.params.feature },
      ip: req.ip,
    });

    res.json({ message: `Feature grant for "${req.params.feature}" removed — user reverts to plan default` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE GROUPS — cohort-level feature access
// ─────────────────────────────────────────────────────────────────────────────

const FeatureGroup = require('../models/FeatureGroup');

// GET /admin/feature-groups — list all groups
router.get('/feature-groups', authenticateAdmin, requirePermission('user_management'), async (req, res) => {
  try {
    const groups = await FeatureGroup.find()
      .populate('createdBy', 'firstName lastName email')
      .populate('members', 'firstName lastName email')
      .sort({ createdAt: -1 }).lean();
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/feature-groups — create a group
router.post('/feature-groups', authenticateAdmin, requirePermission('user_management'), async (req, res) => {
  try {
    const { name, description, features = [], members = [], expiresAt } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    const group = await FeatureGroup.create({
      name: name.trim(),
      description,
      features,
      members,
      createdBy:  req.user._id || req.user.id,
      expiresAt:  expiresAt ? new Date(expiresAt) : null,
    });
    res.status(201).json({ message: 'Feature group created', group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /admin/feature-groups/:groupId — update a group (features, members, expiry)
router.put('/feature-groups/:groupId', authenticateAdmin, requirePermission('user_management'), async (req, res) => {
  try {
    const { name, description, features, active, expiresAt } = req.body;
    const group = await FeatureGroup.findByIdAndUpdate(
      req.params.groupId,
      { $set: { name, description, features, active, expiresAt: expiresAt ? new Date(expiresAt) : null } },
      { new: true }
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json({ message: 'Group updated', group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/feature-groups/:groupId/members — add users to a group
router.post('/feature-groups/:groupId/members', authenticateAdmin, requirePermission('user_management'), async (req, res) => {
  try {
    const { userIds = [] } = req.body;
    if (!userIds.length) return res.status(400).json({ error: 'userIds array required' });

    const group = await FeatureGroup.findByIdAndUpdate(
      req.params.groupId,
      { $addToSet: { members: { $each: userIds } } },
      { new: true }
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json({ message: `${userIds.length} user(s) added to group "${group.name}"`, memberCount: group.members.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/feature-groups/:groupId/members/:userId — remove a user from a group
router.delete('/feature-groups/:groupId/members/:userId', authenticateAdmin, requirePermission('user_management'), async (req, res) => {
  try {
    const group = await FeatureGroup.findByIdAndUpdate(
      req.params.groupId,
      { $pull: { members: req.params.userId } },
      { new: true }
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json({ message: 'User removed from group', memberCount: group.members.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/feature-groups/:groupId — delete a group
router.delete('/feature-groups/:groupId', authenticateAdmin, requirePermission('user_management'), async (req, res) => {
  try {
    await FeatureGroup.findByIdAndDelete(req.params.groupId);
    res.json({ message: 'Feature group deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// BOOST MANAGEMENT
// ═══════════════════════════════════════════════════════════════

const Boost = Job; // Boosts are stored on Job/Service models

// GET /admin/boosts — list all active/recent boosts
router.get('/boosts', authenticateAdmin, requirePermission('job_management'), async (req, res) => {
  try {
    const { status = 'active', page = 1, limit = 50 } = req.query;
    const now = new Date();
    
    let query = {};
    if (status === 'active') {
      query = { 'boost.active': true, 'boost.expiresAt': { $gt: now } };
    } else if (status === 'expired') {
      query = { 'boost.active': false, 'boost.startedAt': { $exists: true } };
    } else {
      query = { 'boost.startedAt': { $exists: true } };
    }

    const [jobs, services] = await Promise.all([
      Job.find(query).select('title boost client category createdAt')
        .populate('client', 'firstName lastName email').sort({ 'boost.startedAt': -1 })
        .skip((page - 1) * limit).limit(Number(limit)).lean(),
      Service.find(query).select('title boost freelancer category createdAt')
        .populate('freelancer', 'firstName lastName email').sort({ 'boost.startedAt': -1 })
        .skip((page - 1) * limit).limit(Number(limit)).lean()
    ]);

    const boostedJobs = jobs.map(j => ({ ...j, type: 'job' }));
    const boostedServices = services.map(s => ({ ...s, type: 'service' }));
    const all = [...boostedJobs, ...boostedServices].sort((a, b) => 
      new Date(b.boost?.startedAt || 0) - new Date(a.boost?.startedAt || 0)
    );

    res.json({ boosts: all, count: all.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /admin/boosts/:type/:id/cancel — cancel an active boost
router.put('/boosts/:type/:id/cancel', authenticateAdmin, requirePermission('job_management'), async (req, res) => {
  try {
    const Model = req.params.type === 'service' ? Service : Job;
    const item = await Model.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (!item.boost?.active) return res.status(400).json({ error: 'No active boost' });

    item.boost.active = false;
    item.boost.cancelledBy = 'admin';
    item.boost.cancelledAt = new Date();
    item.boost.cancelReason = req.body.reason || 'Cancelled by admin';
    await item.save();

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      action: 'boost.cancel',
      reason: req.body.reason || 'Cancelled by admin',
      metadata: { type: req.params.type, itemId: item._id, title: item.title },
      ip: req.ip,
    });

    res.json({ message: 'Boost cancelled', item: { _id: item._id, boost: item.boost } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// BOOKING MANAGEMENT
// ═══════════════════════════════════════════════════════════════

const Booking = require('../models/Booking');

// GET /admin/bookings — list all bookings
router.get('/bookings', authenticateAdmin, requirePermission('job_management'), async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const query = status ? { status } : {};
    
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('client', 'firstName lastName email')
        .populate('freelancer', 'firstName lastName email')
        .populate('service', 'title')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(Number(limit)).lean(),
      Booking.countDocuments(query)
    ]);

    res.json({ bookings, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/bookings/:id — booking detail
router.get('/bookings/:id', authenticateAdmin, requirePermission('job_management'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('client', 'firstName lastName email')
      .populate('freelancer', 'firstName lastName email')
      .populate('service', 'title price');
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /admin/bookings/:id/cancel — admin cancel a booking
router.patch('/bookings/:id/cancel', authenticateAdmin, requirePermission('job_management'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (['cancelled', 'completed'].includes(booking.status)) {
      return res.status(400).json({ error: `Booking already ${booking.status}` });
    }

    booking.status = 'cancelled';
    booking.cancelledBy = 'admin';
    booking.cancelReason = req.body.reason || 'Cancelled by admin';
    booking.cancelledAt = new Date();
    await booking.save();

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: booking.client, action: 'booking.cancel',
      reason: req.body.reason || 'Cancelled by admin',
      metadata: { bookingId: booking._id },
      ip: req.ip,
    });

    res.json({ message: 'Booking cancelled', booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PAYMENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /admin/payments/all — list all payments (already exists at /admin/payments, adding search)
router.get('/payments/search', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const { userId, type, status, minAmount, maxAmount, page = 1, limit = 50 } = req.query;
    const query = {};
    if (userId) query.$or = [{ client: userId }, { freelancer: userId }];
    if (type) query.type = type;
    if (status) query.status = status;
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = Number(minAmount);
      if (maxAmount) query.amount.$lte = Number(maxAmount);
    }

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('client', 'firstName lastName email')
        .populate('freelancer', 'firstName lastName email')
        .populate('job', 'title')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(Number(limit)).lean(),
      Payment.countDocuments(query)
    ]);

    res.json({ payments, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/payments/:id/refund — admin-initiated refund
router.post('/payments/:id/refund', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status === 'refunded') return res.status(400).json({ error: 'Already refunded' });

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    if (payment.stripePaymentIntentId) {
      await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        reason: 'requested_by_customer',
        metadata: { adminRefund: 'true', reason: req.body.reason || 'Admin refund' }
      });
    }

    payment.status = 'refunded';
    payment.refundedAt = new Date();
    payment.refundReason = req.body.reason || 'Admin refund';
    payment.refundedBy = req.admin.id;
    await payment.save();

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: payment.client, action: 'payment.refund',
      reason: req.body.reason || 'Admin refund',
      metadata: { paymentId: payment._id, amount: payment.amount, stripePaymentIntentId: payment.stripePaymentIntentId },
      ip: req.ip,
    });

    res.json({ message: 'Payment refunded', payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CONTRACT MANAGEMENT
// ═══════════════════════════════════════════════════════════════

const Contract = require('../models/Contract');

// GET /admin/contracts — list all contracts
router.get('/contracts', authenticateAdmin, requirePermission('content_moderation'), async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const query = status ? { status } : {};

    const [contracts, total] = await Promise.all([
      Contract.find(query)
        .populate('creator', 'firstName lastName email')
        .populate('recipient', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(Number(limit)).lean(),
      Contract.countDocuments(query)
    ]);

    res.json({ contracts, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/contracts/:id — contract detail
router.get('/contracts/:id', authenticateAdmin, requirePermission('content_moderation'), async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('creator', 'firstName lastName email')
      .populate('recipient', 'firstName lastName email')
      .populate('job', 'title');
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json({ contract });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /admin/contracts/:id/void — admin void a contract
router.patch('/contracts/:id/void', authenticateAdmin, requirePermission('content_moderation'), async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    contract.status = 'voided';
    contract.voidedBy = 'admin';
    contract.voidReason = req.body.reason || 'Voided by admin';
    contract.voidedAt = new Date();
    await contract.save();

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: contract.creator, action: 'contract.void',
      reason: req.body.reason || 'Voided by admin',
      metadata: { contractId: contract._id },
      ip: req.ip,
    });

    res.json({ message: 'Contract voided', contract });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// MESSAGE MODERATION
// ═══════════════════════════════════════════════════════════════

// GET /admin/messages/conversations — list conversations with flags
router.get('/messages/conversations', authenticateAdmin, requirePermission('content_moderation'), async (req, res) => {
  try {
    const { page = 1, limit = 50, flagged } = req.query;
    const query = flagged === 'true' ? { flagged: true } : {};

    const [conversations, total] = await Promise.all([
      ChatRoom.find(query)
        .populate('participants', 'firstName lastName email')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit).limit(Number(limit)).lean(),
      ChatRoom.countDocuments(query)
    ]);

    res.json({ conversations, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/messages/conversation/:id — read messages in a conversation
router.get('/messages/conversation/:id', authenticateAdmin, requirePermission('content_moderation'), async (req, res) => {
  try {
    const messages = await Message.find({ conversation: req.params.id })
      .populate('sender', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(100).lean();

    res.json({ messages, conversationId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/messages/:id — remove a specific message
router.delete('/messages/:id', authenticateAdmin, requirePermission('content_moderation'), async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const originalContent = message.content;
    message.content = '[Removed by moderator]';
    message.moderatedAt = new Date();
    message.moderatedBy = req.admin.id;
    message.moderationReason = req.body.reason || 'Content violation';
    message.attachments = [];
    await message.save();

    await logAdminAction({
      adminId: req.admin._id, adminEmail: req.admin.email,
      targetId: message.sender, action: 'message.delete',
      reason: req.body.reason || 'Content violation',
      metadata: { messageId: message._id, conversationId: message.conversation, contentPreview: originalContent?.substring(0, 100) },
      ip: req.ip,
    });

    res.json({ message: 'Message removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// SERVICE ORDER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /admin/orders — list all service orders
router.get('/orders', authenticateAdmin, requirePermission('job_management'), async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    
    const matchStage = {};
    if (status) matchStage['orders.status'] = status;

    const services = await Service.find({ 'orders.0': { $exists: true } })
      .populate('freelancer', 'firstName lastName email')
      .select('title orders freelancer')
      .sort({ 'orders.createdAt': -1 })
      .lean();

    // Flatten orders with service context
    const allOrders = [];
    for (const svc of services) {
      for (const order of (svc.orders || [])) {
        if (status && order.status !== status) continue;
        allOrders.push({
          orderId: order._id,
          serviceId: svc._id,
          serviceTitle: svc.title,
          freelancer: svc.freelancer,
          client: order.client,
          status: order.status,
          amount: order.amount,
          createdAt: order.createdAt
        });
      }
    }

    // Sort and paginate
    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = allOrders.length;
    const paginated = allOrders.slice((page - 1) * limit, page * limit);

    // Populate client info
    const clientIds = [...new Set(paginated.map(o => o.client?.toString()).filter(Boolean))];
    const clients = await User.find({ _id: { $in: clientIds } }).select('firstName lastName email').lean();
    const clientMap = {};
    clients.forEach(c => { clientMap[c._id.toString()] = c; });
    paginated.forEach(o => { o.client = clientMap[o.client?.toString()] || o.client; });

    res.json({ orders: paginated, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/wallets — aggregate wallet balances by user ──
router.get('/wallets', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const matchStage = {
      status:    'active',
      remaining: { $gt: 0 },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    };

    const agg = await BillingCredit.aggregate([
      { $match: matchStage },
      { $group: {
        _id:     '$user',
        balance: { $sum: '$remaining' },
        credits: { $sum: 1 },
        oldest:  { $min: '$createdAt' },
        newest:  { $max: '$createdAt' },
      }},
      { $sort: { balance: -1 } },
      { $facet: {
        total: [{ $count: 'count' }],
        data:  [{ $skip: skip }, { $limit: Number(limit) }],
      }},
    ]);

    const total = agg[0]?.total[0]?.count || 0;
    let wallets = agg[0]?.data || [];

    // Populate user info
    const userIds = wallets.map(w => w._id);
    const users = await User.find({ _id: { $in: userIds } })
      .select('firstName lastName email stripeAccountId')
      .lean();
    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = u; });

    wallets = wallets.map(w => ({
      userId:   w._id,
      user:     userMap[String(w._id)] || null,
      balance:  Math.round(w.balance * 100) / 100,
      credits:  w.credits,
      oldest:   w.oldest,
      newest:   w.newest,
    }));

    // Optional search filter (post-aggregate for simplicity)
    if (search) {
      const q = search.toLowerCase();
      wallets = wallets.filter(w => {
        const u = w.user;
        if (!u) return false;
        return (u.firstName + ' ' + u.lastName).toLowerCase().includes(q) ||
               u.email.toLowerCase().includes(q);
      });
    }

    res.json({ wallets, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

// ── POST /api/admin/wallets/:userId/adjust — admin adjust wallet balance ──
// Body: { amount, reason } — positive to add, negative to deduct
router.post('/wallets/:userId/adjust', authenticateAdmin, requirePermission('payment_management'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;
    const parsedAmount = parseFloat(amount);

    if (!parsedAmount || parsedAmount === 0) return res.status(400).json({ error: 'amount must be non-zero' });
    if (!reason) return res.status(400).json({ error: 'reason is required' });

    const user = await User.findById(userId).select('firstName lastName email');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (parsedAmount > 0) {
      // Add credit
      const credit = await BillingCredit.create({
        user:      userId,
        amount:    parsedAmount,
        reason:    `Admin adjustment: ${reason}`,
        appliedBy: req.user.userId,
      });

      await logBillingAction({
        userId,
        action:  'wallet_admin_credit',
        before:  null,
        after:   { amount: parsedAmount, reason },
        adminId: req.user.userId,
        note:    `Admin added $${parsedAmount} — ${reason}`,
      });

      res.status(201).json({ credit, message: `$${parsedAmount} added to wallet` });
    } else {
      // Deduct from wallet FIFO
      const deductAmt = Math.abs(parsedAmount);
      const credits = await BillingCredit.find({
        user:      userId,
        status:    'active',
        remaining: { $gt: 0 },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      }).sort({ createdAt: 1 });

      const balance = credits.reduce((sum, c) => sum + (c.remaining || 0), 0);
      if (balance < deductAmt) {
        return res.status(400).json({ error: `Insufficient balance ($${balance.toFixed(2)} available)` });
      }

      let remaining = deductAmt;
      for (const credit of credits) {
        if (remaining <= 0) break;
        const deduct = Math.min(credit.remaining, remaining);
        credit.remaining = Math.round((credit.remaining - deduct) * 100) / 100;
        if (credit.remaining <= 0) {
          credit.status = 'used';
          credit.usedAt = new Date();
          credit.usedOn = `admin_adjustment`;
        }
        await credit.save();
        remaining = Math.round((remaining - deduct) * 100) / 100;
      }

      await logBillingAction({
        userId,
        action:  'wallet_admin_debit',
        before:  { balance },
        after:   { deducted: deductAmt, reason },
        adminId: req.user.userId,
        note:    `Admin deducted $${deductAmt} — ${reason}`,
      });

      res.json({ message: `$${deductAmt} deducted from wallet` });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to adjust wallet' });
  }
});

// ── GET /api/admin/users/:userId/wallet — user wallet detail ──────────────────
router.get('/users/:userId/wallet', authenticateAdmin, requirePermission('payment_management'), validateUserIdParam, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('firstName lastName email walletFrozen walletFrozenReason walletFrozenAt').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Sum active, unexpired BillingCredit entries = wallet balance
    const credits = await BillingCredit.find({
      user: userId,
      status: 'active',
      remaining: { $gt: 0 },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).sort({ createdAt: -1 }).lean();

    const balance = credits.reduce((sum, c) => sum + (c.remaining || 0), 0);

    // Recent transaction history (all credits including used/expired)
    const history = await BillingCredit.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    res.json({
      user,
      balance: Math.round(balance * 100) / 100,
      activeCredits: credits,
      history,
      walletFrozen: user.walletFrozen || false,
      walletFrozenReason: user.walletFrozenReason || '',
      walletFrozenAt: user.walletFrozenAt || null,
    });
  } catch (err) {
    console.error('Admin wallet detail error:', err);
    res.status(500).json({ error: 'Failed to fetch wallet data' });
  }
});

// ── PUT /api/admin/wallets/:userId/freeze — freeze / unfreeze wallet ──────────
router.put('/wallets/:userId/freeze', authenticateAdmin, requirePermission('payment_management'), validateUserIdParam, async (req, res) => {
  try {
    const { userId } = req.params;
    const { freeze, reason } = req.body;  // freeze: boolean

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.walletFrozen       = !!freeze;
    user.walletFrozenReason = freeze ? (reason || 'Admin freeze') : '';
    user.walletFrozenAt     = freeze ? new Date() : null;
    await user.save();

    await logBillingAction({
      userId,
      action:  freeze ? 'wallet_frozen' : 'wallet_unfrozen',
      before:  { walletFrozen: !freeze },
      after:   { walletFrozen: !!freeze, reason },
      adminId: req.user.userId,
      note:    freeze ? `Wallet frozen — ${reason}` : 'Wallet unfrozen by admin',
    });

    res.json({
      walletFrozen: user.walletFrozen,
      message: freeze ? '🧊 Wallet frozen' : '✅ Wallet unfrozen',
    });
  } catch (err) {
    console.error('Admin wallet freeze error:', err);
    res.status(500).json({ error: 'Failed to update wallet status' });
  }
});

// Teams summary for Admin Dashboard
router.get('/teams', authenticateAdmin, async (req, res) => {
  try {
    const teams = await Team.find({ isActive: true })
      .populate('owner', 'firstName lastName email')
      .select('name type owner members createdAt')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const normalized = teams.map((t) => ({
      ...t,
      activeMembers: (t.members || []).filter((m) => m.status === 'active').length,
    }));

    res.json({ teams: normalized });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load teams' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN AUDIT LOG
// ═══════════════════════════════════════════════════════════════

// GET /admin/audit-log?page=1&limit=50&action=user.ban&adminId=xxx&targetId=yyy
router.get('/audit-log', authenticateAdmin, requirePermission('analytics_view'), async (req, res) => {
  try {
    const { page = 1, limit = 50, action, adminId, targetId } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (adminId) filter.adminId = adminId;
    if (targetId) filter.targetId = targetId;

    const [logs, total] = await Promise.all([
      AdminAuditLog.find(filter)
        .populate('adminId', 'firstName lastName email')
        .populate('targetId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean(),
      AdminAuditLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('Audit log fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

module.exports = router;

