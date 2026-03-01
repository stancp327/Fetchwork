const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin, requirePermission } = require('../middleware/auth');
const { DailyStats, PageView, VisitorSession } = require('../models/Analytics');
const crypto = require('crypto');
const User    = require('../models/User');
const Job     = require('../models/Job');
const Service = require('../models/Service');
const Payment = require('../models/Payment');
const Review  = require('../models/Review');

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

// ── Helper: build last N months array ────────────────────────────
function lastNMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

// ── Helper: fill monthly buckets (0 for missing months) ──────────
function fillMonths(agg, months, valueKey = 'amount') {
  const map = {};
  agg.forEach(r => { map[r._id] = r[valueKey]; });
  return months.map(m => ({ month: m, [valueKey]: Math.round((map[m] || 0) * 100) / 100 }));
}

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId  = (req.user._id || req.user.userId).toString();
    const user    = await User.findById(userId).select('accountType avgResponseTime').lean();
    const isFreelancer = ['freelancer', 'both'].includes(user?.accountType);
    const isClient     = ['client', 'both'].includes(user?.accountType);

    // range param: '30d' | '90d' | '6mo' | '1yr' (default 1yr)
    const range = req.query.range || '1yr';
    const monthCount = range === '30d' ? 1 : range === '90d' ? 3 : range === '6mo' ? 6 : 12;
    const rangeStart = new Date();
    rangeStart.setMonth(rangeStart.getMonth() - monthCount);
    rangeStart.setDate(1); rangeStart.setHours(0, 0, 0, 0);

    const ytdStart = new Date(new Date().getFullYear(), 0, 1);
    const months   = lastNMonths(monthCount);

    const [freelancerStats, clientStats] = await Promise.all([
      isFreelancer ? (async () => {
        const uid = require('mongoose').Types.ObjectId.createFromHexString(userId);

        // ── Aggregate earnings (all-time + YTD + avg job size) ──────────
        const earningsAgg = await Payment.aggregate([
          { $match: { freelancer: uid, type: 'release', status: 'completed' } },
          { $group: {
            _id: null,
            ytdEarnings:      { $sum: { $cond: [{ $gte: ['$createdAt', ytdStart] }, '$netAmount', 0] } },
            totalEarnings:    { $sum: '$netAmount' },
            platformFeesPaid: { $sum: '$fees.platform' },
            paymentCount:     { $sum: 1 },
            avgJobSize:       { $avg: '$netAmount' },
          }}
        ]);
        const ep = earningsAgg[0] || {};

        // ── Monthly earnings time-series ─────────────────────────────────
        const monthlyRaw = await Payment.aggregate([
          { $match: { freelancer: uid, type: 'release', status: 'completed', createdAt: { $gte: rangeStart } } },
          { $group: {
            _id:    { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            amount: { $sum: '$netAmount' },
            fees:   { $sum: '$fees.platform' },
          }},
          { $sort: { _id: 1 } },
        ]);
        const monthlyEarnings = months.map(m => {
          const r = monthlyRaw.find(x => x._id === m) || {};
          return { month: m, amount: Math.round((r.amount || 0) * 100) / 100, fees: Math.round((r.fees || 0) * 100) / 100 };
        });

        // ── Proposal funnel ──────────────────────────────────────────────
        const proposalFunnelAgg = await Job.aggregate([
          { $match: { 'proposals.freelancer': uid } },
          { $project: { proposal: { $filter: { input: '$proposals', as: 'p', cond: { $eq: ['$$p.freelancer', uid] } } } } },
          { $unwind: '$proposal' },
          { $group: { _id: '$proposal.status', count: { $sum: 1 } } },
        ]);
        const funnelMap = {};
        proposalFunnelAgg.forEach(r => { funnelMap[r._id] = r.count; });
        const proposalFunnel = {
          sent:     (funnelMap.pending || 0) + (funnelMap.accepted || 0) + (funnelMap.declined || 0) + (funnelMap.withdrawn || 0),
          pending:  funnelMap.pending  || 0,
          accepted: funnelMap.accepted || 0,
          declined: funnelMap.declined || 0,
        };
        const winRate = proposalFunnel.sent > 0
          ? Math.round((proposalFunnel.accepted / proposalFunnel.sent) * 100) : 0;

        // ── Jobs by status + delivery rate ───────────────────────────────
        const jobStatusAgg = await Job.aggregate([
          { $match: { freelancer: uid } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
        const statusMap = {};
        jobStatusAgg.forEach(r => { statusMap[r._id] = r.count; });
        const completedJobs = statusMap.completed || 0;
        const activeJobs    = statusMap.in_progress || 0;
        const deliveryRate  = (completedJobs + (statusMap.cancelled || 0)) > 0
          ? Math.round((completedJobs / (completedJobs + (statusMap.cancelled || 0))) * 100) : null;

        // ── Repeat clients ───────────────────────────────────────────────
        const clientJobsAgg = await Job.aggregate([
          { $match: { freelancer: uid, status: 'completed' } },
          { $group: { _id: '$client', count: { $sum: 1 } } },
        ]);
        const totalClients  = clientJobsAgg.length;
        const repeatClients = clientJobsAgg.filter(c => c.count >= 2).length;
        const repeatClientRate = totalClients > 0 ? Math.round((repeatClients / totalClients) * 100) : 0;

        // ── Top earning categories ────────────────────────────────────────
        const topCategoriesAgg = await Job.aggregate([
          { $match: { freelancer: uid, status: 'completed' } },
          { $group: { _id: '$category', earned: { $sum: '$escrowAmount' }, jobs: { $sum: 1 } } },
          { $sort: { earned: -1 } },
          { $limit: 5 },
        ]);

        // ── Average review rating ─────────────────────────────────────────
        const ratingAgg = await Review.aggregate([
          { $match: { reviewee: uid } },
          { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]);
        const ratingData = ratingAgg[0] || {};

        // ── Monthly rating trend ──────────────────────────────────────────
        const ratingTrendRaw = await Review.aggregate([
          { $match: { reviewee: uid, createdAt: { $gte: rangeStart } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]);
        const ratingTrend = months.map(m => {
          const r = ratingTrendRaw.find(x => x._id === m);
          return { month: m, avg: r ? Math.round(r.avg * 10) / 10 : null, count: r?.count || 0 };
        });

        return {
          // summary
          ytdEarnings:      Math.round((ep.ytdEarnings   || 0) * 100) / 100,
          totalEarnings:    Math.round((ep.totalEarnings  || 0) * 100) / 100,
          platformFeesPaid: Math.round((ep.platformFeesPaid || 0) * 100) / 100,
          avgJobSize:       Math.round((ep.avgJobSize     || 0) * 100) / 100,
          winRate,
          activeJobs,
          completedJobs,
          deliveryRate,
          repeatClientRate,
          avgResponseTime:  user?.avgResponseTime || null,
          ratingAvg:        ratingData.avg ? Math.round(ratingData.avg * 10) / 10 : null,
          ratingCount:      ratingData.count || 0,
          // time-series
          monthlyEarnings,
          ratingTrend,
          // breakdowns
          proposalFunnel,
          jobsByStatus:     statusMap,
          topCategories:    topCategoriesAgg.map(c => ({ category: c._id || 'Other', earned: Math.round(c.earned * 100) / 100, jobs: c.jobs })),
        };
      })() : null,

      isClient ? (async () => {
        const uid = require('mongoose').Types.ObjectId.createFromHexString(userId);

        // ── Spend summary ─────────────────────────────────────────────────
        const spendAgg = await Payment.aggregate([
          { $match: { client: uid, type: 'release', status: 'completed' } },
          { $group: {
            _id:        null,
            totalSpent: { $sum: '$amount' },
            ytdSpent:   { $sum: { $cond: [{ $gte: ['$createdAt', ytdStart] }, '$amount', 0] } },
            jobCount:   { $sum: 1 },
          }}
        ]);
        const sp = spendAgg[0] || {};

        // ── Monthly spend time-series ─────────────────────────────────────
        const monthlySpendRaw = await Payment.aggregate([
          { $match: { client: uid, type: 'release', status: 'completed', createdAt: { $gte: rangeStart } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, amount: { $sum: '$amount' } } },
          { $sort: { _id: 1 } },
        ]);
        const monthlySpend = months.map(m => {
          const r = monthlySpendRaw.find(x => x._id === m) || {};
          return { month: m, amount: Math.round((r.amount || 0) * 100) / 100 };
        });

        // ── Job stats ─────────────────────────────────────────────────────
        const jobStatusAgg = await Job.aggregate([
          { $match: { client: uid } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
        const statusMap = {};
        jobStatusAgg.forEach(r => { statusMap[r._id] = r.count; });
        const jobsPosted = Object.values(statusMap).reduce((a, b) => a + b, 0);
        const jobsFilled = (statusMap.in_progress || 0) + (statusMap.completed || 0);
        const jobsOpen   = statusMap.open || 0;
        const fillRate   = jobsPosted > 0 ? Math.round((jobsFilled / jobsPosted) * 100) : 0;

        // ── Avg time to hire ──────────────────────────────────────────────
        const hiredJobs = await Job.find({
          client: uid,
          status: { $in: ['accepted', 'pending_start', 'in_progress', 'completed'] },
          acceptedAt: { $exists: true },
        }).select('createdAt acceptedAt category').lean();
        let avgTimeToHire = null;
        if (hiredJobs.length > 0) {
          const totalMs = hiredJobs.reduce((s, j) => s + (new Date(j.acceptedAt) - new Date(j.createdAt)), 0);
          avgTimeToHire = Math.round(totalMs / hiredJobs.length / (1000 * 60 * 60));
        }

        // ── Time-to-hire by category ──────────────────────────────────────
        const tthByCategory = {};
        hiredJobs.forEach(j => {
          const cat = j.category || 'Other';
          if (!tthByCategory[cat]) tthByCategory[cat] = { total: 0, count: 0 };
          tthByCategory[cat].total += new Date(j.acceptedAt) - new Date(j.createdAt);
          tthByCategory[cat].count++;
        });
        const timeToHireByCategory = Object.entries(tthByCategory)
          .map(([cat, d]) => ({ category: cat, avgHours: Math.round(d.total / d.count / (1000 * 60 * 60)) }))
          .sort((a, b) => b.avgHours - a.avgHours)
          .slice(0, 5);

        // ── Repeat freelancers ────────────────────────────────────────────
        const freelancerJobsAgg = await Job.aggregate([
          { $match: { client: uid, status: 'completed' } },
          { $group: { _id: '$freelancer', jobs: { $sum: 1 }, totalPaid: { $sum: '$escrowAmount' } } },
          { $sort: { jobs: -1 } },
        ]);
        const totalFreelancers  = freelancerJobsAgg.length;
        const repeatFreelancers = freelancerJobsAgg.filter(f => f.jobs >= 2).length;
        const repeatHireRate    = totalFreelancers > 0 ? Math.round((repeatFreelancers / totalFreelancers) * 100) : 0;

        // Top freelancers (populate names)
        const topFreelancerIds = freelancerJobsAgg.slice(0, 5).map(f => f._id);
        const topFreelancerUsers = await User.find({ _id: { $in: topFreelancerIds } })
          .select('firstName lastName profilePicture').lean();
        const userMap = {};
        topFreelancerUsers.forEach(u => { userMap[u._id.toString()] = u; });
        const topFreelancers = freelancerJobsAgg.slice(0, 5).map(f => {
          const u = userMap[f._id?.toString()] || {};
          return { id: f._id, name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown', jobs: f.jobs, totalPaid: Math.round((f.totalPaid || 0) * 100) / 100 };
        });

        // ── Spend by category (budget vs actual) ─────────────────────────
        const categoryBudgetAgg = await Job.aggregate([
          { $match: { client: uid, status: { $in: ['in_progress', 'completed'] } } },
          { $group: { _id: '$category', budgeted: { $sum: '$budget.amount' }, actual: { $sum: '$escrowAmount' }, jobs: { $sum: 1 } } },
          { $sort: { budgeted: -1 } },
          { $limit: 5 },
        ]);
        const budgetVsActual = categoryBudgetAgg.map(c => ({
          category: c._id || 'Other',
          budgeted: Math.round(c.budgeted * 100) / 100,
          actual:   Math.round(c.actual * 100) / 100,
          jobs:     c.jobs,
        }));

        // ── Avg rating given by this client ──────────────────────────────
        const ratingGivenAgg = await Review.aggregate([
          { $match: { reviewer: uid, reviewerType: 'client' } },
          { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]);
        const rg = ratingGivenAgg[0] || {};

        // ── Spend by freelancer (Business tier) ──────────────────────
        const spendByFreelancerAgg = await Payment.aggregate([
          { $match: { client: uid, type: 'release', status: 'completed' } },
          { $group: { _id: '$freelancer', totalSpent: { $sum: '$amount' }, payments: { $sum: 1 } } },
          { $sort: { totalSpent: -1 } },
          { $limit: 10 },
        ]);
        const spendFreelancerIds = spendByFreelancerAgg.map(f => f._id);
        const spendFreelancerUsers = await User.find({ _id: { $in: spendFreelancerIds } })
          .select('firstName lastName profilePicture rating avgResponseTime').lean();
        const spendUserMap = {};
        spendFreelancerUsers.forEach(u => { spendUserMap[u._id.toString()] = u; });
        const spendByFreelancer = spendByFreelancerAgg.map(f => {
          const u = spendUserMap[f._id?.toString()] || {};
          return {
            id: f._id,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown',
            profilePicture: u.profilePicture,
            totalSpent: Math.round(f.totalSpent * 100) / 100,
            payments: f.payments,
            rating: u.rating ? Math.round(u.rating * 10) / 10 : null,
            avgResponseTime: u.avgResponseTime || null,
          };
        });

        // ── Spend by month + category (Business tier) ────────────────────
        const spendByCatMonthRaw = await Payment.aggregate([
          { $match: { client: uid, type: 'release', status: 'completed', createdAt: { $gte: rangeStart } } },
          { $lookup: { from: 'jobs', localField: 'job', foreignField: '_id', as: 'jobInfo' } },
          { $unwind: { path: '$jobInfo', preserveNullAndEmptyArrays: true } },
          { $group: {
            _id: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, category: '$jobInfo.category' },
            amount: { $sum: '$amount' },
          }},
          { $sort: { '_id.month': 1 } },
        ]);

        return {
          // summary
          totalSpent:     Math.round((sp.totalSpent || 0) * 100) / 100,
          ytdSpent:       Math.round((sp.ytdSpent   || 0) * 100) / 100,
          avgCostPerJob:  sp.jobCount > 0 ? Math.round((sp.totalSpent / sp.jobCount) * 100) / 100 : 0,
          jobsPosted,
          jobsFilled,
          jobsOpen,
          fillRate,
          avgTimeToHire,
          repeatHireRate,
          avgRatingGiven: rg.avg ? Math.round(rg.avg * 10) / 10 : null,
          // time-series
          monthlySpend,
          // breakdowns
          jobsByStatus:        statusMap,
          budgetVsActual,
          topCategories:       budgetVsActual,
          topFreelancers,
          timeToHireByCategory,
          // Business tier
          spendByFreelancer,
          spendByCategoryMonth: spendByCatMonthRaw.map(r => ({
            month: r._id.month, category: r._id.category || 'Other',
            amount: Math.round(r.amount * 100) / 100,
          })),
        };
      })() : null,
    ]);

    res.json({
      freelancer: freelancerStats,
      client:     clientStats,
      meta: { range, monthCount, months },
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
