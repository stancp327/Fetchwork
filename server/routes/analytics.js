const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin, requirePermission } = require('../middleware/auth');
const { DailyStats, PageView, VisitorSession } = require('../models/Analytics');
const crypto = require('crypto');
const User = require('../models/User');
const Job = require('../models/Job');
const Service = require('../models/Service');

// ── Public: client-side page view tracking (no auth) ────────────
router.post('/track', async (req, res) => {
  res.status(204).end(); // Respond immediately
  try {
    const { path } = req.body || {};
    if (!path || typeof path !== 'string') return;

    const today = new Date().toISOString().split('T')[0];
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const ua = req.headers['user-agent'] || '';
    const sessionId = crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').substring(0, 16);
    const device = /mobile|android.*mobile|iphone|ipod/i.test(ua) ? 'mobile'
      : /tablet|ipad|android/i.test(ua) ? 'tablet' : 'desktop';

    const session = await VisitorSession.findOneAndUpdate(
      { sessionId, date: today },
      { $set: { lastSeen: new Date(), userAgent: ua, device }, $inc: { pageCount: 1 },
        $setOnInsert: { firstSeen: new Date(), referrer: req.headers['referer'] || '' } },
      { upsert: true, new: true }
    );

    const isNew = session.pageCount === 1;
    const normalizedPath = path.replace(/\/[a-f0-9]{24}/g, '/:id').replace(/\/$/, '') || '/';

    await Promise.all([
      DailyStats.findOneAndUpdate({ date: today }, { $inc: { pageViews: 1, ...(isNew ? { visitors: 1 } : {}) } }, { upsert: true }),
      PageView.findOneAndUpdate({ date: today, path: normalizedPath }, { $inc: { views: 1, ...(isNew ? { uniqueVisitors: 1 } : {}) } }, { upsert: true })
    ]);
  } catch (e) { /* silent */ }
});

// ── User-facing analytics (auth required, no admin) ─────────────
const Payment = require('../models/Payment');

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId  = (req.user._id || req.user.userId).toString();
    const user    = await User.findById(userId).select('accountType').lean();
    const isFreelancer = ['freelancer', 'both'].includes(user?.accountType);
    const isClient     = ['client', 'both'].includes(user?.accountType);

    const ytdStart = new Date(new Date().getFullYear(), 0, 1); // Jan 1 of current year
    const allTime  = new Date(0);

    const [freelancerStats, clientStats] = await Promise.all([
      isFreelancer ? (async () => {
        const uid = require('mongoose').Types.ObjectId.createFromHexString(userId);

        // Earnings
        const earningsAgg = await Payment.aggregate([
          { $match: { freelancer: uid, type: 'release', status: 'completed' } },
          { $group: {
            _id: null,
            ytdEarnings:    { $sum: { $cond: [{ $gte: ['$createdAt', ytdStart] }, '$netAmount', 0] } },
            totalEarnings:  { $sum: '$netAmount' },
            platformFeesPaid: { $sum: '$fees.platform' },
            paymentCount:   { $sum: 1 },
          }}
        ]);
        const ep = earningsAgg[0] || {};

        // Proposal stats (win rate)
        const [totalProposals, acceptedProposals] = await Promise.all([
          Job.countDocuments({ 'proposals.freelancer': uid }),
          Job.countDocuments({ 'proposals': { $elemMatch: { freelancer: uid, status: 'accepted' } } }),
        ]);
        const winRate = totalProposals > 0 ? Math.round((acceptedProposals / totalProposals) * 100) : 0;

        // Jobs by status
        const [activeJobs, completedJobs] = await Promise.all([
          Job.countDocuments({ freelancer: uid, status: 'in_progress', isArchived: { $ne: true } }),
          Job.countDocuments({ freelancer: uid, status: 'completed' }),
        ]);

        // Repeat clients (clients with 2+ completed jobs)
        const clientJobsAgg = await Job.aggregate([
          { $match: { freelancer: uid, status: 'completed' } },
          { $group: { _id: '$client', count: { $sum: 1 } } },
        ]);
        const totalClients  = clientJobsAgg.length;
        const repeatClients = clientJobsAgg.filter(c => c.count >= 2).length;
        const repeatClientRate = totalClients > 0 ? Math.round((repeatClients / totalClients) * 100) : 0;

        // Avg response time (from User model)
        const fullUser = await User.findById(userId).select('avgResponseTime').lean();

        return {
          ytdEarnings:      Math.round((ep.ytdEarnings   || 0) * 100) / 100,
          totalEarnings:    Math.round((ep.totalEarnings  || 0) * 100) / 100,
          platformFeesPaid: Math.round((ep.platformFeesPaid || 0) * 100) / 100,
          proposalsSent:    totalProposals,
          winRate,
          activeJobs,
          completedJobs,
          repeatClientRate,
          avgResponseTime:  fullUser?.avgResponseTime || null,
        };
      })() : null,

      isClient ? (async () => {
        const uid = require('mongoose').Types.ObjectId.createFromHexString(userId);

        // Spend
        const spendAgg = await Payment.aggregate([
          { $match: { client: uid, type: 'release', status: 'completed' } },
          { $group: {
            _id: null,
            totalSpent: { $sum: '$amount' },
            ytdSpent:   { $sum: { $cond: [{ $gte: ['$createdAt', ytdStart] }, '$amount', 0] } },
            jobCount:   { $sum: 1 },
          }}
        ]);
        const sp = spendAgg[0] || {};

        // Job stats
        const [jobsPosted, jobsFilled, jobsOpen] = await Promise.all([
          Job.countDocuments({ client: uid }),
          Job.countDocuments({ client: uid, status: { $in: ['in_progress', 'completed'] } }),
          Job.countDocuments({ client: uid, status: 'open', isArchived: { $ne: true } }),
        ]);
        const fillRate = jobsPosted > 0 ? Math.round((jobsFilled / jobsPosted) * 100) : 0;

        // Avg time to hire (open → accepted)
        const hiredJobs = await Job.find({
          client: uid,
          status: { $in: ['accepted', 'pending_start', 'in_progress', 'completed'] },
          acceptedAt: { $exists: true },
          createdAt: { $exists: true },
        }).select('createdAt acceptedAt').lean();
        let avgTimeToHire = null;
        if (hiredJobs.length > 0) {
          const avgMs = hiredJobs.reduce((s, j) =>
            s + (new Date(j.acceptedAt) - new Date(j.createdAt)), 0) / hiredJobs.length;
          avgTimeToHire = Math.round(avgMs / (1000 * 60 * 60)); // hours
        }

        // Repeat freelancers
        const freelancerJobsAgg = await Job.aggregate([
          { $match: { client: uid, status: 'completed' } },
          { $group: { _id: '$freelancer', count: { $sum: 1 } } },
        ]);
        const totalFreelancers  = freelancerJobsAgg.length;
        const repeatFreelancers = freelancerJobsAgg.filter(f => f.count >= 2).length;
        const repeatHireRate    = totalFreelancers > 0 ? Math.round((repeatFreelancers / totalFreelancers) * 100) : 0;

        // Spend by category
        const categoryAgg = await Job.aggregate([
          { $match: { client: uid, status: 'completed' } },
          { $group: { _id: '$category', spent: { $sum: '$budget' }, jobs: { $sum: 1 } } },
          { $sort: { spent: -1 } },
          { $limit: 5 },
        ]);

        return {
          totalSpent:        Math.round((sp.totalSpent || 0) * 100) / 100,
          ytdSpent:          Math.round((sp.ytdSpent   || 0) * 100) / 100,
          avgCostPerJob:     sp.jobCount > 0 ? Math.round((sp.totalSpent / sp.jobCount) * 100) / 100 : 0,
          jobsPosted,
          jobsFilled,
          jobsOpen,
          fillRate,
          avgTimeToHire,
          repeatHireRate,
          topCategories:     categoryAgg.map(c => ({ category: c._id, spent: c.spent, jobs: c.jobs })),
        };
      })() : null,
    ]);

    res.json({
      freelancer: freelancerStats,
      client:     clientStats,
    });
  } catch (err) {
    console.error('User analytics error:', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// All other analytics routes require admin + analytics_view permission
router.use(authenticateToken, authenticateAdmin, requirePermission('analytics_view'));

// GET /api/analytics/overview — real-time snapshot
router.get('/overview', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    const [
      todayStats,
      last30Days,
      totalUsers,
      activeUsers30d,
      totalJobs,
      openJobs,
      totalServices,
      deviceBreakdown,
      topPages7d
    ] = await Promise.all([
      DailyStats.findOne({ date: today }),
      DailyStats.getRange(thirtyDaysAgo, today),
      User.countDocuments(),
      User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 30 * 86400000) } }),
      Job.countDocuments(),
      Job.countDocuments({ status: 'open' }),
      Service.countDocuments({ isActive: true }),
      VisitorSession.aggregate([
        { $match: { date: { $gte: sevenDaysAgo } } },
        { $group: { _id: '$device', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      PageView.aggregate([
        { $match: { date: { $gte: sevenDaysAgo } } },
        { $group: { _id: '$path', views: { $sum: '$views' }, unique: { $sum: '$uniqueVisitors' } } },
        { $sort: { views: -1 } },
        { $limit: 15 }
      ])
    ]);

    // Aggregate 30-day totals
    const totals30d = last30Days.reduce((acc, d) => {
      acc.visitors += d.visitors || 0;
      acc.pageViews += d.pageViews || 0;
      acc.signups += d.signups || 0;
      acc.jobsPosted += d.jobsPosted || 0;
      acc.jobsCompleted += d.jobsCompleted || 0;
      acc.proposalsSent += d.proposalsSent || 0;
      acc.messagesExchanged += d.messagesExchanged || 0;
      acc.searches += d.searches || 0;
      return acc;
    }, { visitors: 0, pageViews: 0, signups: 0, jobsPosted: 0, jobsCompleted: 0, proposalsSent: 0, messagesExchanged: 0, searches: 0 });

    // Conversion rate: visitors → signups
    const conversionRate = totals30d.visitors > 0
      ? ((totals30d.signups / totals30d.visitors) * 100).toFixed(1)
      : '0.0';

    res.json({
      today: todayStats || { visitors: 0, pageViews: 0, signups: 0 },
      last30Days: totals30d,
      conversionRate,
      platform: {
        totalUsers, activeUsers30d, totalJobs, openJobs, totalServices
      },
      devices: deviceBreakdown.reduce((acc, d) => { acc[d._id] = d.count; return acc; }, {}),
      topPages: topPages7d.map(p => ({ path: p._id, views: p.views, unique: p.unique })),
      chartData: last30Days.map(d => ({
        date: d.date,
        visitors: d.visitors || 0,
        pageViews: d.pageViews || 0,
        signups: d.signups || 0,
        jobsPosted: d.jobsPosted || 0
      }))
    });
  } catch (err) {
    console.error('Analytics overview error:', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// GET /api/analytics/daily?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/daily', async (req, res) => {
  try {
    const end = req.query.end || new Date().toISOString().split('T')[0];
    const start = req.query.start || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const data = await DailyStats.getRange(start, end);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load daily stats' });
  }
});

// GET /api/analytics/pages?days=7
router.get('/pages', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 90);
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const pages = await PageView.aggregate([
      { $match: { date: { $gte: since } } },
      { $group: { _id: '$path', views: { $sum: '$views' }, unique: { $sum: '$uniqueVisitors' } } },
      { $sort: { views: -1 } },
      { $limit: 50 }
    ]);
    res.json(pages.map(p => ({ path: p._id, views: p.views, unique: p.unique })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load page analytics' });
  }
});

// GET /api/analytics/funnel — visitor → signup → post job → hire
router.get('/funnel', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const stats = await DailyStats.getRange(since, today);

    const totals = stats.reduce((acc, d) => {
      acc.visitors += d.visitors || 0;
      acc.signups += d.signups || 0;
      acc.jobsPosted += d.jobsPosted || 0;
      acc.proposalsSent += d.proposalsSent || 0;
      acc.jobsCompleted += d.jobsCompleted || 0;
      return acc;
    }, { visitors: 0, signups: 0, jobsPosted: 0, proposalsSent: 0, jobsCompleted: 0 });

    res.json({
      period: `${days} days`,
      funnel: [
        { stage: 'Visitors', count: totals.visitors, pct: 100 },
        { stage: 'Sign Ups', count: totals.signups, pct: totals.visitors ? ((totals.signups / totals.visitors) * 100).toFixed(1) : 0 },
        { stage: 'Jobs Posted', count: totals.jobsPosted, pct: totals.signups ? ((totals.jobsPosted / totals.signups) * 100).toFixed(1) : 0 },
        { stage: 'Proposals Sent', count: totals.proposalsSent, pct: totals.jobsPosted ? ((totals.proposalsSent / totals.jobsPosted) * 100).toFixed(1) : 0 },
        { stage: 'Jobs Completed', count: totals.jobsCompleted, pct: totals.proposalsSent ? ((totals.jobsCompleted / totals.proposalsSent) * 100).toFixed(1) : 0 }
      ]
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load funnel' });
  }
});

module.exports = router;
