const express = require('express');
const router = express.Router();
const { authenticateToken, authenticateAdmin, requirePermission } = require('../middleware/auth');
const ServerError = require('../models/ServerError');
const { logClientError } = require('../middleware/errorTracker');

// ── Client Error Reporting (any authenticated user) ─────────────
router.post('/client', authenticateToken, async (req, res) => {
  try {
    const { message, stack, name, url, component, viewport } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Error message is required' });
    }

    await logClientError(
      {
        message: message.substring(0, 1000),
        stack: stack?.substring(0, 5000),
        name,
        url,
        component,
        userAgent: req.get('user-agent'),
        viewport
      },
      req.user.userId,
      req.user.email
    );

    res.status(201).json({ message: 'Error logged' });
  } catch (error) {
    console.error('Error logging client error:', error);
    res.status(500).json({ error: 'Failed to log error' });
  }
});

// ── Admin: Get Error Dashboard Stats ────────────────────────────
router.get('/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const [total, unresolved, critical, today] = await Promise.all([
      ServerError.countDocuments(),
      ServerError.countDocuments({ resolved: false }),
      ServerError.countDocuments({ severity: 'critical', resolved: false }),
      ServerError.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      })
    ]);

    const bySource = await ServerError.aggregate([
      { $match: { resolved: false } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    const bySeverity = await ServerError.aggregate([
      { $match: { resolved: false } },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]);

    // Errors per day (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const trend = await ServerError.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      total,
      unresolved,
      critical,
      today,
      bySource: Object.fromEntries(bySource.map(s => [s._id, s.count])),
      bySeverity: Object.fromEntries(bySeverity.map(s => [s._id, s.count])),
      trend
    });
  } catch (error) {
    console.error('Error fetching error stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Admin: List Errors ──────────────────────────────────────────
router.get('/admin', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const { source, severity, resolved, search } = req.query;

    const query = {};
    if (source) query.source = source;
    if (severity) query.severity = severity;
    if (resolved !== undefined) query.resolved = resolved === 'true';
    if (search) {
      query.$or = [
        { message: { $regex: search, $options: 'i' } },
        { 'request.url': { $regex: search, $options: 'i' } }
      ];
    }

    const [errors, total] = await Promise.all([
      ServerError.find(query)
        .populate('userId', 'firstName lastName email')
        .populate('resolvedBy', 'firstName lastName')
        .sort({ lastSeenAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit),
      ServerError.countDocuments(query)
    ]);

    res.json({
      errors,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching errors:', error);
    res.status(500).json({ error: 'Failed to fetch errors' });
  }
});

// ── Admin: Get Single Error ─────────────────────────────────────
router.get('/admin/:id', authenticateAdmin, async (req, res) => {
  try {
    const error = await ServerError.findById(req.params.id)
      .populate('userId', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName');

    if (!error) {
      return res.status(404).json({ error: 'Error not found' });
    }

    res.json({ error });
  } catch (err) {
    console.error('Error fetching error detail:', err);
    res.status(500).json({ error: 'Failed to fetch error' });
  }
});

// ── Admin: Resolve/Unresolve Error ──────────────────────────────
router.patch('/admin/:id/resolve', authenticateAdmin, async (req, res) => {
  try {
    const { resolved, notes } = req.body;
    const error = await ServerError.findById(req.params.id);

    if (!error) {
      return res.status(404).json({ error: 'Error not found' });
    }

    error.resolved = resolved !== false;
    error.resolvedBy = req.admin._id;
    error.resolvedAt = resolved !== false ? new Date() : null;
    if (notes) error.notes = notes;

    await error.save();

    res.json({ message: `Error ${error.resolved ? 'resolved' : 'reopened'}`, error });
  } catch (err) {
    console.error('Error updating error:', err);
    res.status(500).json({ error: 'Failed to update error' });
  }
});

// ── Admin: Bulk Resolve ─────────────────────────────────────────
router.post('/admin/bulk-resolve', authenticateAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) {
      return res.status(400).json({ error: 'No error IDs provided' });
    }

    const result = await ServerError.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          resolved: true,
          resolvedBy: req.admin._id,
          resolvedAt: new Date()
        }
      }
    );

    res.json({ message: `${result.modifiedCount} errors resolved` });
  } catch (error) {
    console.error('Error bulk resolving:', error);
    res.status(500).json({ error: 'Failed to bulk resolve' });
  }
});

// ── Admin: Delete Old Resolved Errors ───────────────────────────
router.delete('/admin/cleanup', authenticateAdmin, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await ServerError.deleteMany({
      resolved: true,
      resolvedAt: { $lt: thirtyDaysAgo }
    });

    res.json({ message: `${result.deletedCount} old resolved errors cleaned up` });
  } catch (error) {
    console.error('Error cleaning up:', error);
    res.status(500).json({ error: 'Failed to cleanup' });
  }
});

module.exports = router;
