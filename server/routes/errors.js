const express = require('express');
const router = express.Router();
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const ServerError = require('../models/ServerError');

// ── POST /api/errors — public endpoint for frontend error reporting (no auth, lightweight)
router.post('/', (req, res) => {
  try {
    const { message, stack, component, url, userAgent, userId, timestamp } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    // Fire-and-forget DB write
    ServerError.findOneAndUpdate(
      { message: String(message).substring(0, 500), source: 'client', resolved: false },
      {
        $set: {
          stack: stack ? String(stack).substring(0, 2000) : null,
          'client.component': component ? String(component).substring(0, 100) : null,
          'client.url': url ? String(url).substring(0, 500) : null,
          'client.userAgent': userAgent ? String(userAgent).substring(0, 300) : null,
          lastSeenAt: new Date(),
        },
        $inc: { occurrences: 1 },
        $setOnInsert: {
          message: String(message).substring(0, 500),
          source: 'client',
          severity: 'medium',
          resolved: false,
          userId: userId || null,
        },
      },
      { upsert: true, new: true }
    ).catch(err => console.error('Error logging client error:', err.message));

    res.status(201).json({ received: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log error' });
  }
});

// ── POST /api/errors/client — authenticated client error reporting
router.post('/client', authenticateToken, async (req, res) => {
  try {
    const { message, stack, url, component } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const existing = await ServerError.findOneAndUpdate(
      { message: String(message).substring(0, 500), source: 'client', resolved: false },
      {
        $set: {
          stack: stack ? String(stack).substring(0, 2000) : null,
          'client.component': component ? String(component).substring(0, 100) : null,
          'client.url': url ? String(url).substring(0, 500) : null,
          userId: req.user.userId,
          lastSeenAt: new Date(),
        },
        $inc: { occurrences: 1 },
        $setOnInsert: {
          message: String(message).substring(0, 500),
          source: 'client',
          severity: 'medium',
          resolved: false,
        },
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ message: 'Error logged', errorId: existing._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Admin routes
// ═══════════════════════════════════════════════════════════════

// GET /api/errors/admin/stats — error dashboard stats
router.get('/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, unresolved, critical, todayCount, bySource, bySeverity, dailyTrend] = await Promise.all([
      ServerError.countDocuments(),
      ServerError.countDocuments({ resolved: false }),
      ServerError.countDocuments({ severity: 'critical', resolved: false }),
      ServerError.countDocuments({ createdAt: { $gte: today } }),
      ServerError.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]),
      ServerError.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
      ServerError.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      total,
      unresolved,
      critical,
      today: todayCount,
      bySource: bySource.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
      bySeverity: bySeverity.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
      dailyTrend,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load error stats' });
  }
});

// GET /api/errors/admin — paginated error list
router.get('/admin', authenticateAdmin, async (req, res) => {
  try {
    const { severity, source, resolved, page = 1, limit = 50, search } = req.query;
    const query = {};
    if (severity) query.severity = severity;
    if (source) query.source = source;
    if (resolved !== undefined) query.resolved = resolved === 'true';
    if (search) query.message = { $regex: search, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);

    const [errors, total] = await Promise.all([
      ServerError.find(query)
        .populate('userId', 'firstName lastName email')
        .sort({ lastSeenAt: -1, createdAt: -1 })
        .limit(Number(limit))
        .skip(skip),
      ServerError.countDocuments(query),
    ]);

    res.json({
      errors,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load errors' });
  }
});

// PATCH /api/errors/admin/:id/resolve — resolve/unresolve an error
router.patch('/admin/:id/resolve', authenticateAdmin, async (req, res) => {
  try {
    const error = await ServerError.findById(req.params.id);
    if (!error) return res.status(404).json({ error: 'Error not found' });

    error.resolved = req.body.resolved !== undefined ? req.body.resolved : true;
    error.resolvedAt = error.resolved ? new Date() : null;
    error.resolvedBy = error.resolved ? req.admin?.id : null;
    error.notes = req.body.notes || error.notes;
    await error.save();

    res.json({ message: `Error ${error.resolved ? 'resolved' : 'reopened'}`, error });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update error' });
  }
});

// POST /api/errors/admin/resolve-all — mark ALL unresolved errors as resolved
router.post('/admin/resolve-all', authenticateAdmin, async (req, res) => {
  try {
    const result = await ServerError.updateMany(
      { resolved: { $ne: true } },
      { $set: { resolved: true, resolvedAt: new Date() } }
    );
    res.json({ message: `${result.modifiedCount} error(s) resolved` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve all errors' });
  }
});

// POST /api/errors/admin/bulk-resolve — bulk resolve errors
router.post('/admin/bulk-resolve', authenticateAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: 'ids array required' });

    const result = await ServerError.updateMany(
      { _id: { $in: ids } },
      { $set: { resolved: true, resolvedAt: new Date(), resolvedBy: req.admin?.id } }
    );

    res.json({ message: `${result.modifiedCount} error(s) resolved` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to bulk resolve' });
  }
});

// DELETE /api/errors/admin/cleanup — delete old resolved errors (>30 days)
router.delete('/admin/cleanup', authenticateAdmin, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 30 * 86400000);
    const result = await ServerError.deleteMany({ resolved: true, resolvedAt: { $lt: cutoff } });
    res.json({ message: `${result.deletedCount} old error(s) cleaned up` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clean up errors' });
  }
});

module.exports = router;
