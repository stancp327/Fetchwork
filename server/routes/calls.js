const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Call = require('../models/Call');

// GET /api/calls — user's call history
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const [calls, total] = await Promise.all([
      Call.find({ $or: [{ caller: userId }, { recipient: userId }] })
        .populate('caller', 'firstName lastName profileImage')
        .populate('recipient', 'firstName lastName profileImage')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Call.countDocuments({ $or: [{ caller: userId }, { recipient: userId }] }),
    ]);

    res.json({ calls, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

// GET /api/calls/:id — single call detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const call = await Call.findById(req.params.id)
      .populate('caller', 'firstName lastName profileImage')
      .populate('recipient', 'firstName lastName profileImage');
    if (!call) return res.status(404).json({ error: 'Call not found' });

    const userId = req.user.userId;
    if (call.caller._id.toString() !== userId && call.recipient._id.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({ call });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch call' });
  }
});

module.exports = router;
