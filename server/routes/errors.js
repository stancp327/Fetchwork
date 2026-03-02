const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');

// In-memory error buffer (last 100 errors) — no external dependency needed
const MAX_ERRORS = 100;
const errorBuffer = [];

// POST /api/errors — client reports a frontend error
router.post('/', (req, res) => {
  try {
    const { message, stack, component, url, userAgent, userId, timestamp } = req.body;

    if (!message) return res.status(400).json({ error: 'message required' });

    const entry = {
      message: String(message).substring(0, 500),
      stack: stack ? String(stack).substring(0, 2000) : null,
      component: component ? String(component).substring(0, 100) : null,
      url: url ? String(url).substring(0, 500) : null,
      userAgent: userAgent ? String(userAgent).substring(0, 300) : null,
      userId: userId || null,
      timestamp: timestamp || new Date().toISOString(),
      ip: req.ip,
    };

    errorBuffer.unshift(entry);
    if (errorBuffer.length > MAX_ERRORS) errorBuffer.length = MAX_ERRORS;

    console.error(`[CLIENT ERROR] ${entry.component || 'unknown'}: ${entry.message}`);

    res.status(201).json({ received: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log error' });
  }
});

// GET /api/errors — admin retrieves recent errors
router.get('/', authenticateAdmin, (req, res) => {
  res.json({ errors: errorBuffer, count: errorBuffer.length });
});

module.exports = router;
