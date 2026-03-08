/**
 * AI Assistant routes — earnings forecast, meeting notes, message translator, fake review detector.
 */
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const { hasFeature, FEATURES } = require('../services/entitlementEngine');
const { hasAI } = require('../services/aiService');

const aiLimiter = rateLimit({ windowMs: 60_000, max: 10, message: { error: 'Too many AI requests' }, standardHeaders: true, legacyHeaders: false });
const freeLimiter = rateLimit({ windowMs: 60_000, max: 30, message: { error: 'Too many requests' }, standardHeaders: true, legacyHeaders: false });

function getOpenAI() {
  if (!hasAI()) return null;
  const { OpenAI } = require('openai');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ── GET /api/ai/earnings-forecast ─────────────────────────────────────────
router.get('/earnings-forecast', aiLimiter, authenticateToken, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_MATCHING);
    if (!allowed) {
      return res.status(403).json({
        error: 'upgrade_required',
        feature: 'ai_matching',
        message: 'Earnings Forecast is a Pro feature. Upgrade to unlock.',
      });
    }

    const openai = getOpenAI();
    if (!openai) return res.status(503).json({ error: 'AI service unavailable' });

    const Payment = require('../models/Payment');
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const payments = await Payment.find({
      freelancer: req.user.id,
      status: 'completed',
      createdAt: { $gte: ninetyDaysAgo },
    }).select('amount netAmount createdAt').lean();

    const last30 = payments.filter(p => new Date(p.createdAt) >= thirtyDaysAgo).reduce((s, p) => s + (p.netAmount || p.amount), 0);
    const last60Only = payments.filter(p => new Date(p.createdAt) >= sixtyDaysAgo && new Date(p.createdAt) < thirtyDaysAgo).reduce((s, p) => s + (p.netAmount || p.amount), 0);
    const last90Only = payments.filter(p => new Date(p.createdAt) < sixtyDaysAgo).reduce((s, p) => s + (p.netAmount || p.amount), 0);

    const monthlyTotals = [last90Only, last60Only, last30];
    const avgMonthly = monthlyTotals.reduce((a, b) => a + b, 0) / 3;
    const trend = last30 > last60Only ? 'up' : last30 < last60Only ? 'down' : 'stable';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a freelance earnings analyst. Return valid JSON only.',
        },
        {
          role: 'user',
          content: `Based on this freelancer earnings data, generate a forecast for next month and 3 actionable tips to increase earnings. Return JSON: {forecastAmount: number, confidence: "low"|"medium"|"high", trend: "up"|"stable"|"down", tips: string[], insight: string}

Earnings data:
- Last 30 days: $${last30.toFixed(2)}
- Previous 30 days (30-60): $${last60Only.toFixed(2)}
- Previous 30 days (60-90): $${last90Only.toFixed(2)}
- Average monthly: $${avgMonthly.toFixed(2)}
- Trend: ${trend}
- Total payments in 90 days: ${payments.length}`,
        },
      ],
    });

    const forecast = JSON.parse(completion.choices[0].message.content);

    return res.json({
      forecast,
      historical: {
        last30: Math.round(last30 * 100) / 100,
        last60: Math.round(last60Only * 100) / 100,
        last90: Math.round(last90Only * 100) / 100,
      },
    });
  } catch (err) {
    console.error('[AI] earnings-forecast error:', err.message);
    return res.status(500).json({ error: 'Failed to generate earnings forecast' });
  }
});

// ── POST /api/ai/meeting-notes ────────────────────────────────────────────
router.post('/meeting-notes', aiLimiter, authenticateToken, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_MATCHING);
    if (!allowed) {
      return res.status(403).json({
        error: 'upgrade_required',
        feature: 'ai_matching',
        message: 'Meeting Notes is a Pro feature. Upgrade to unlock.',
      });
    }

    const openai = getOpenAI();
    if (!openai) return res.status(503).json({ error: 'AI service unavailable' });

    const { callDurationSeconds, otherPartyName, jobTitle, conversationContext } = req.body;
    if (!callDurationSeconds) return res.status(400).json({ error: 'callDurationSeconds is required' });

    const durationMin = Math.round(callDurationSeconds / 60);
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a professional meeting notes assistant. Return valid JSON only.',
        },
        {
          role: 'user',
          content: `Given a video call context, generate professional meeting notes. Return JSON: {notes: string, actionItems: string[], followUpSuggested: string}

Notes should include sections: Date, Duration, Participants, Discussion Points (template based on context), Key Takeaways, Action Items, Next Steps.

Call details:
- Date: ${today}
- Duration: ${durationMin} minutes (${callDurationSeconds} seconds)
- Participants: You and ${otherPartyName || 'Other party'}
- Job/Project: ${jobTitle || 'General discussion'}
${conversationContext ? `- Additional context: ${conversationContext}` : ''}`,
        },
      ],
    });

    const result = JSON.parse(completion.choices[0].message.content);

    return res.json(result);
  } catch (err) {
    console.error('[AI] meeting-notes error:', err.message);
    return res.status(500).json({ error: 'Failed to generate meeting notes' });
  }
});

// ── POST /api/ai/translate-message ────────────────────────────────────────
router.post('/translate-message', freeLimiter, authenticateToken, async (req, res) => {
  try {
    const openai = getOpenAI();
    if (!openai) return res.status(503).json({ error: 'AI service unavailable' });

    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: 'text and targetLanguage are required' });

    const langMap = {
      es: 'Spanish', fr: 'French', de: 'German', zh: 'Chinese',
      ja: 'Japanese', pt: 'Portuguese', ar: 'Arabic', hi: 'Hindi',
    };
    const targetName = langMap[targetLanguage] || targetLanguage;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Return valid JSON only.',
        },
        {
          role: 'user',
          content: `Detect the source language and translate the following text to ${targetName}. Return JSON: {translated: string, detectedLanguage: string, targetLanguage: string}

Text: "${text}"`,
        },
      ],
    });

    const result = JSON.parse(completion.choices[0].message.content);

    return res.json(result);
  } catch (err) {
    console.error('[AI] translate-message error:', err.message);
    return res.status(500).json({ error: 'Failed to translate message' });
  }
});

// ── POST /api/ai/detect-fake-review ───────────────────────────────────────
router.post('/detect-fake-review', aiLimiter, authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const openai = getOpenAI();
    if (!openai) return res.status(503).json({ error: 'AI service unavailable' });

    const { reviewText, rating, reviewerHistory } = req.body;
    if (!reviewText) return res.status(400).json({ error: 'reviewText is required' });

    const history = reviewerHistory || {};

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a review authenticity analyst. Analyze reviews for suspicious patterns. Return valid JSON only.',
        },
        {
          role: 'user',
          content: `Analyze this review for authenticity. Check for: generic language, sentiment vs rating mismatch, suspicious patterns, overly promotional tone, lack of specifics. Return JSON: {isSuspicious: boolean, confidence: "low"|"medium"|"high", flags: string[], recommendation: "approve"|"investigate"|"remove"}

Review text: "${reviewText}"
Rating: ${rating || 'N/A'}/5
Reviewer history:
- Total reviews: ${history.totalReviews ?? 'unknown'}
- Average rating given: ${history.avgRating ?? 'unknown'}
- Account age: ${history.accountAgeDays ?? 'unknown'} days`,
        },
      ],
    });

    const result = JSON.parse(completion.choices[0].message.content);

    return res.json(result);
  } catch (err) {
    console.error('[AI] detect-fake-review error:', err.message);
    return res.status(500).json({ error: 'Failed to analyze review' });
  }
});

module.exports = router;
