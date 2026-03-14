const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const User    = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const calendarService = require('../services/calendarService');

// ── POST /api/calendar/google/connect ─────────────────────────────────────
// Also accept /google/auth as alias for backward compat
router.post('/google/auth', authenticateToken, async (req, res, next) => {
  req.url = '/google/connect';
  next('route');
});

router.post('/google/connect', authenticateToken, async (req, res) => {
  try {
    if (!process.env.GOOGLE_CAL_CLIENT_ID || !process.env.GOOGLE_CAL_CLIENT_SECRET) {
      return res.status(503).json({
        error: 'Google Calendar is not configured on this server yet.',
        setupRequired: true,
      });
    }
    const authUrl = calendarService.getAuthUrl(req.user.userId);
    res.json({ authUrl });
  } catch (err) {
    console.error('google connect error:', err);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// ── GET /api/calendar/google/callback ─────────────────────────────────────
// Google redirects here after user grants permission
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state: userId, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.CLIENT_URL}/profile?tab=verification&calendar=denied`);
    }
    if (!code || !userId) {
      return res.redirect(`${process.env.CLIENT_URL}/profile?tab=verification&calendar=error`);
    }

    await calendarService.handleCallback(code, userId);
    // Avoid redirect if already on profile with success
    if (req.headers.referer && req.headers.referer.includes('/profile?tab=verification')) {
      res.json({ success: true });
    } else {
      res.redirect(`${process.env.CLIENT_URL}/profile?tab=verification&calendar=connected`);
    }
  } catch (err) {
    console.error('google callback error:', err);
    // Avoid redirect if already on profile with error
    if (req.headers.referer && req.headers.referer.includes('/profile?tab=verification')) {
      res.json({ success: false, error: err.message });
    } else {
      res.redirect(`${process.env.CLIENT_URL}/profile?tab=verification&calendar=error`);
    }
  }
});

// ── DELETE /api/calendar/google/disconnect ────────────────────────────────
router.delete('/google/disconnect', authenticateToken, async (req, res) => {
  try {
    await calendarService.disconnect(req.user.userId);
    res.json({ success: true });
  } catch (err) {
    console.error('google disconnect error:', err);
    res.status(500).json({ error: 'Failed to disconnect Google Calendar' });
  }
});

// ── GET /api/calendar/google/status ──────────────────────────────────────
router.get('/google/status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('googleCalConnected googleCalTokenExpiry');
    res.json({
      connected:   user?.googleCalConnected ?? false,
      expiresAt:   user?.googleCalTokenExpiry ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get calendar status' });
  }
});

// Alias: /ical/url → /ical-url
router.get('/ical/url', (req, res, next) => { req.url = '/ical-url'; next('route'); });

// ── GET /api/calendar/ical-url ────────────────────────────────────────────
// Returns the iCal subscription URL for the authenticated user
router.get('/ical-url', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('+icalSecret');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate icalSecret if missing
    if (!user.icalSecret) {
      user.icalSecret = crypto.randomUUID();
      await user.save();
    }

    const feedUrl = `${process.env.API_URL || process.env.SERVER_URL}/api/bookings/feed/${user.icalSecret}.ics`;
    res.json({ feedUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get iCal URL' });
  }
});

// ── POST /api/calendar/ical-rotate ───────────────────────────────────────
// Rotates the iCal secret (invalidates old subscription URL)
router.post('/ical-rotate', authenticateToken, async (req, res) => {
  try {
    const newSecret = crypto.randomUUID();
    await User.findByIdAndUpdate(req.user.userId, { icalSecret: newSecret });

    const feedUrl = `${process.env.API_URL || process.env.SERVER_URL}/api/bookings/feed/${newSecret}.ics`;
    res.json({ feedUrl, message: 'iCal URL rotated. Re-add the new URL to your calendar app.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to rotate iCal URL' });
  }
});

module.exports = router;
