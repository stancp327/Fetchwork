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
