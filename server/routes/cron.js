const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const emailWorkflowService = require('../services/emailWorkflowService');

/**
 * POST /api/cron/process-onboarding
 * 
 * Protected endpoint for Render Cron Job (or any external scheduler).
 * Sends pending onboarding emails (steps 2 & 3) for all due users.
 * 
 * Auth: Bearer token via CRON_SECRET env var.
 * Set this same secret as the Authorization header in your Render Cron Job.
 */
router.post('/process-onboarding', async (req, res) => {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error('[cron] CRON_SECRET not set — refusing request');
    return res.status(500).json({ error: 'CRON_SECRET not configured on server' });
  }

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  const tokenBuf = Buffer.from(token.padEnd(secret.length));
  const secretBuf = Buffer.from(secret);
  if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const count = await emailWorkflowService.processPendingOnboarding();
    console.log(`[cron] process-onboarding — sent ${count} emails`);
    return res.json({ ok: true, processed: count });
  } catch (err) {
    console.error('[cron] process-onboarding error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
