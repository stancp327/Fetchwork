/**
 * aiSettings.js — Admin + User AI feature toggle endpoints
 *
 * Admin routes:
 *   GET  /api/ai-settings/platform          — get platform-wide toggles
 *   PUT  /api/ai-settings/platform          — update platform-wide toggles
 *   GET  /api/ai-settings/registry          — get full feature registry (public metadata)
 *
 * User routes:
 *   GET  /api/ai-settings/me                — get my AI preferences
 *   PUT  /api/ai-settings/me                — update my AI preferences
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const SystemConfig = require('../models/SystemConfig');
const User = require('../models/User');
const { AI_FEATURES, DEFAULT_PLATFORM_STATE } = require('../services/aiFeatureRegistry');

// ── Helper: require admin ────────────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ── GET /api/ai-settings/registry — public feature list ─────────────────────
router.get('/registry', (req, res) => {
  res.json({ features: AI_FEATURES });
});

// ── GET /api/ai-settings/platform — admin: get platform toggles ──────────────
router.get('/platform', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const config = await SystemConfig.findOne({ namespace: 'ai_features' }).lean();
    const platformState = config?.data || DEFAULT_PLATFORM_STATE;
    // Fill in any missing keys with true
    const full = { ...DEFAULT_PLATFORM_STATE, ...platformState };
    res.json({ platformState: full, features: AI_FEATURES });
  } catch (err) {
    console.error('[aiSettings] platform GET error:', err.message);
    res.status(500).json({ error: 'Failed to load AI settings' });
  }
});

// ── PUT /api/ai-settings/platform — admin: update platform toggles ───────────
router.put('/platform', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { platformState } = req.body;
    if (!platformState || typeof platformState !== 'object') {
      return res.status(400).json({ error: 'platformState object required' });
    }

    // Only allow valid keys from registry
    const validKeys = new Set(AI_FEATURES.map(f => f.key));
    const sanitized = {};
    for (const [key, val] of Object.entries(platformState)) {
      if (validKeys.has(key)) sanitized[key] = Boolean(val);
    }

    await SystemConfig.findOneAndUpdate(
      { namespace: 'ai_features' },
      { data: sanitized, updatedBy: req.user._id || req.user.userId },
      { upsert: true, new: true }
    );

    res.json({ message: 'AI feature settings saved', platformState: sanitized });
  } catch (err) {
    console.error('[aiSettings] platform PUT error:', err.message);
    res.status(500).json({ error: 'Failed to save AI settings' });
  }
});

// ── GET /api/ai-settings/me — user: get my AI preferences ────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.userId)
      .select('preferences.aiFeatures').lean();
    const aiFeatures = user?.preferences?.aiFeatures || {};
    // Fill in defaults (true for all not explicitly set)
    const full = Object.fromEntries(AI_FEATURES.map(f => [f.key, aiFeatures[f.key] !== false]));
    res.json({ aiFeatures: full, features: AI_FEATURES });
  } catch (err) {
    console.error('[aiSettings] me GET error:', err.message);
    res.status(500).json({ error: 'Failed to load AI preferences' });
  }
});

// ── PUT /api/ai-settings/me — user: update my AI preferences ─────────────────
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { aiFeatures } = req.body;
    if (!aiFeatures || typeof aiFeatures !== 'object') {
      return res.status(400).json({ error: 'aiFeatures object required' });
    }

    const validKeys = new Set(AI_FEATURES.map(f => f.key));
    const sanitized = {};
    for (const [key, val] of Object.entries(aiFeatures)) {
      if (validKeys.has(key)) sanitized[key] = Boolean(val);
    }

    await User.findByIdAndUpdate(
      req.user._id || req.user.userId,
      { 'preferences.aiFeatures': sanitized }
    );

    res.json({ message: 'AI preferences saved', aiFeatures: sanitized });
  } catch (err) {
    console.error('[aiSettings] me PUT error:', err.message);
    res.status(500).json({ error: 'Failed to save AI preferences' });
  }
});

module.exports = router;
