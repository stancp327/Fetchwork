const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Call = require('../models/Call');

const normalizeCallStatus = (status) => {
  if (status === 'active') return 'connected';
  if (status === 'rejected') return 'declined';
  return status;
};

const normalizeCallForResponse = (call) => ({
  ...call,
  status: normalizeCallStatus(call?.status),
});

// GET /api/calls/turn-credentials — time-limited TURN credentials (RFC 5389 long-term)
router.get('/turn-credentials', authenticateToken, (req, res) => {
  const secret = process.env.TURN_AUTH_SECRET;
  const urls = process.env.TURN_URLS;
  if (!secret || !urls) {
    return res.status(503).json({ error: 'TURN not configured' });
  }

  const ttl = parseInt(process.env.TURN_TTL_SECONDS, 10) || 86400;
  const unixExpiry = Math.floor(Date.now() / 1000) + ttl;
  const username = `${unixExpiry}:${req.user.userId}`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');

  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: urls.split(',').map(u => u.trim()),
        username,
        credential,
      },
    ],
    ttl,
  });
});

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

    const normalizedCalls = calls.map(normalizeCallForResponse);
    res.json({ calls: normalizedCalls, total, page: Number(page), pages: Math.ceil(total / limit) });
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

    res.json({ call: normalizeCallForResponse(call.toObject()) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch call' });
  }
});

// POST /api/calls/:id/relay-credentials — ephemeral TURN credentials (Phase 1)
router.post('/:id/relay-credentials', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const call = await Call.findById(req.params.id).select('caller recipient status').lean();
    if (!call) return res.status(404).json({ error: 'Call not found' });

    if (call.caller.toString() !== userId && call.recipient.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const turnUrls = (process.env.TURN_URLS || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    if (!turnUrls.length || !process.env.TURN_AUTH_SECRET) {
      return res.status(503).json({ error: 'TURN is not configured' });
    }

    const ttlSeconds = Number(process.env.TURN_TTL_SECONDS || 120);
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${expiresAt}:${userId}:${req.params.id}`;
    const credential = crypto
      .createHmac('sha1', process.env.TURN_AUTH_SECRET)
      .update(username)
      .digest('base64');

    return res.json({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        { urls: turnUrls, username, credential },
      ],
      ttlSeconds,
      expiresAt,
    });
  } catch (err) {
    console.error('relay credentials error:', err.message);
    res.status(500).json({ error: 'Failed to issue relay credentials' });
  }
});

// POST /api/calls/:id/quality — client quality summary upload
router.post('/:id/quality', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const call = await Call.findById(req.params.id);
    if (!call) return res.status(404).json({ error: 'Call not found' });

    if (call.caller.toString() !== userId && call.recipient.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const {
      avgRttMs,
      avgJitterMs,
      avgPacketLossPct,
      maxFreezeMs,
      audioFallbackUsed,
      iceSelectedCandidateType,
    } = req.body || {};

    call.networkDiagnostics = {
      avgRttMs: Number.isFinite(Number(avgRttMs)) ? Number(avgRttMs) : call.networkDiagnostics?.avgRttMs,
      avgJitterMs: Number.isFinite(Number(avgJitterMs)) ? Number(avgJitterMs) : call.networkDiagnostics?.avgJitterMs,
      avgPacketLossPct: Number.isFinite(Number(avgPacketLossPct)) ? Number(avgPacketLossPct) : call.networkDiagnostics?.avgPacketLossPct,
      maxFreezeMs: Number.isFinite(Number(maxFreezeMs)) ? Number(maxFreezeMs) : call.networkDiagnostics?.maxFreezeMs,
      audioFallbackUsed: typeof audioFallbackUsed === 'boolean'
        ? audioFallbackUsed
        : (call.networkDiagnostics?.audioFallbackUsed || false),
    };

    if (['host', 'srflx', 'relay'].includes(iceSelectedCandidateType)) {
      call.iceSelectedCandidateType = iceSelectedCandidateType;
    }

    await call.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('quality upload error:', err.message);
    res.status(500).json({ error: 'Failed to save quality metrics' });
  }
});

module.exports = router;
