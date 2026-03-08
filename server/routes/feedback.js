const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const SiteFeedback = require('../models/SiteFeedback');

const feedbackLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 5,
  message: { error: 'Too many feedback submissions — try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/feedback — submit feedback (auth optional)
router.post('/', feedbackLimiter, async (req, res) => {
  try {
    // Try to get user from token if present (optional auth)
    let userId = null;
    let userEmail = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        userId = decoded.userId || decoded._id || null;
        if (userId) {
          const User = require('../models/User');
          const user = await User.findById(userId).select('email').lean();
          userEmail = user?.email || null;
        }
      } catch { /* unauthenticated — fine */ }
    }

    const { category, message, page, email } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });
    if (message.trim().length < 5) return res.status(400).json({ error: 'Message too short' });

    const feedback = await SiteFeedback.create({
      userId,
      email: email || userEmail || undefined,
      category: category || 'other',
      message: message.trim().slice(0, 2000),
      page: (page || '').slice(0, 200),
      userAgent: req.headers['user-agent']?.slice(0, 300),
    });

    // Notify admin via email if configured (non-blocking)
    try {
      const emailService = require('../services/emailService');
      if (emailService.sendAdminBroadcast) {
        await emailService.sendAdminBroadcast({
          subject: `[Feedback] ${category || 'General'}: ${message.slice(0, 60)}…`,
          body: `Category: ${category}\nPage: ${page || 'unknown'}\nFrom: ${email || userEmail || 'Guest'}\n\n${message}`,
        });
      }
    } catch { /* email failure is non-critical */ }

    res.status(201).json({ message: 'Thank you for your feedback!', id: feedback._id });
  } catch (err) {
    console.error('[feedback] submit error:', err.message);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// GET /api/feedback — admin: list feedback
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (!req.user?.isAdmin && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { status, category, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const [items, total] = await Promise.all([
      SiteFeedback.find(filter)
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      SiteFeedback.countDocuments(filter),
    ]);

    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('[feedback] list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// PUT /api/feedback/:id — admin: update status/note
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.user?.isAdmin && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { status, adminNote } = req.body;
    const update = {};
    if (status) update.status = status;
    if (adminNote !== undefined) update.adminNote = adminNote;

    const item = await SiteFeedback.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

module.exports = router;
