const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Notification = require('../models/Notification');

// ── Get user's notifications ────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const query = { recipient: req.user.userId };
    if (unreadOnly === 'true') query.read = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ recipient: req.user.userId, read: false });

    res.json({ notifications, unreadCount, pagination: { current: parseInt(page), pages: Math.ceil(total / parseInt(limit)), total } });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ── Get unread count ────────────────────────────────────────────
router.get('/count', authenticateToken, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user.userId, read: false });
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get count' });
  }
});

// ── Mark one as read ────────────────────────────────────────────
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.userId },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// ── Mark all as read ────────────────────────────────────────────
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

module.exports = router;
