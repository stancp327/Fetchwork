/**
 * AI Workflow routes — proposal ranker, red flag detector, milestone suggester,
 * contract summarizer, dispute risk checker.
 */
const express  = require('express');
const router   = express.Router();
const rateLimit = require('express-rate-limit');

const { authenticateToken } = require('../middleware/auth');
const { validateMongoId }   = require('../middleware/validation');
const { hasFeature, FEATURES } = require('../services/entitlementEngine');
const { hasAI } = require('../services/aiService');
const Job = require('../models/Job');

const aiLimiter = rateLimit({
  windowMs: 60_000,
  max:      10,
  message:  { error: 'Too many AI requests — try again in a minute' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── POST /api/ai/rank-proposals/:jobId ──────────────────────────────────
router.post('/rank-proposals/:jobId', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_JOB_DESCRIPTION);
    if (!allowed) {
      return res.status(403).json({
        error: 'upgrade_required',
        feature: 'ai_job_description',
        message: 'AI Proposal Ranking is available on Plus and above. Upgrade to unlock.',
      });
    }

    if (!hasAI()) {
      return res.status(503).json({ error: 'AI service is not available right now.' });
    }

    const job = await Job.findById(req.params.jobId).populate('proposals.freelancer', 'firstName lastName skills');
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const clientId = job.client?._id || job.client;
    if (String(clientId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Only the job owner can rank proposals' });
    }

    if (!job.proposals || job.proposals.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 proposals to rank' });
    }

    const proposalData = job.proposals.map(p => ({
      _id: p._id,
      freelancerName: `${p.freelancer?.firstName || ''} ${p.freelancer?.lastName || ''}`.trim(),
      bid: p.proposedBudget,
      coverLetter: (p.coverLetter || '').slice(0, 250),
      skills: p.freelancer?.skills || [],
    }));

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You are a hiring assistant. Score proposals for a job. Return valid JSON only.',
        },
        {
          role: 'user',
          content: `Job: "${job.title}" (${job.category || 'General'})\nBudget: $${job.budget?.min || 0}–$${job.budget?.max || 0}\nSkills needed: ${(job.skills || []).join(', ')}\n\nProposals:\n${proposalData.map((p, i) => `${i + 1}. ID: ${p._id}\n   Freelancer: ${p.freelancerName}\n   Bid: $${p.bid}\n   Skills: ${p.skills.join(', ')}\n   Cover: ${p.coverLetter}`).join('\n\n')}\n\nScore each proposal 1-10. Return JSON: {"rankings":[{"proposalId":"...","score":1-10,"strengths":"...","concerns":"..."}]} sorted by score descending.`,
        },
      ],
    });

    let result;
    try {
      const raw = completion.choices[0].message.content.replace(/```json\n?|```/g, '').trim();
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    return res.json(result);
  } catch (err) {
    console.error('[AI] rank-proposals error:', err.message);
    return res.status(500).json({ error: 'Failed to rank proposals' });
  }
});

// ── POST /api/ai/detect-proposal-redflag ────────────────────────────────
router.post('/detect-proposal-redflag', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_JOB_DESCRIPTION);
    if (!allowed) {
      return res.status(403).json({
        error: 'upgrade_required',
        feature: 'ai_job_description',
        message: 'Red Flag Detection is available on Plus and above. Upgrade to unlock.',
      });
    }

    if (!hasAI()) {
      return res.status(503).json({ error: 'AI service is not available right now.' });
    }

    const { proposalId, coverLetter, proposedBudget, freelancerName, jobBudget } = req.body;
    if (!coverLetter) return res.status(400).json({ error: 'coverLetter is required' });

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are a proposal quality checker. Detect red flags: copy-paste generic text, unrealistic bids, vague responses, mismatched skills. Return valid JSON only.',
        },
        {
          role: 'user',
          content: `Freelancer: ${freelancerName || 'Unknown'}\nProposed Budget: $${proposedBudget || 0}\nJob Budget: $${jobBudget || 0}\nCover Letter:\n${(coverLetter || '').slice(0, 500)}\n\nAnalyze for red flags. Return JSON: {"flagged":true/false,"flags":["..."],"severity":"low"|"medium"|"high","summary":"..."}`,
        },
      ],
    });

    let result;
    try {
      const raw = completion.choices[0].message.content.replace(/```json\n?|```/g, '').trim();
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    return res.json(result);
  } catch (err) {
    console.error('[AI] detect-proposal-redflag error:', err.message);
    return res.status(500).json({ error: 'Failed to check proposal' });
  }
});

// ── POST /api/ai/suggest-milestones ─────────────────────────────────────
router.post('/suggest-milestones', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_MATCHING);
    if (!allowed) {
      return res.status(403).json({
        error: 'upgrade_required',
        feature: 'ai_matching',
        message: 'AI Milestone Suggestions is a Pro feature. Upgrade to unlock.',
      });
    }

    if (!hasAI()) {
      return res.status(503).json({ error: 'AI service is not available right now.' });
    }

    const { title, description, budget, duration, category } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: 'You are a project planning assistant. Generate realistic milestones for freelance projects. Return valid JSON only.',
        },
        {
          role: 'user',
          content: `Project: "${title}"\nCategory: ${category || 'General'}\nDescription: ${(description || '').slice(0, 500)}\nBudget: $${budget || 0}\nDuration: ${duration || 'Not specified'}\n\nGenerate 3-6 milestones with payment percentages that sum to 100%. Return JSON: {"milestones":[{"title":"...","description":"...","percentage":25,"estimatedDays":7}]}`,
        },
      ],
    });

    let result;
    try {
      const raw = completion.choices[0].message.content.replace(/```json\n?|```/g, '').trim();
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    return res.json(result);
  } catch (err) {
    console.error('[AI] suggest-milestones error:', err.message);
    return res.status(500).json({ error: 'Failed to suggest milestones' });
  }
});

// ── POST /api/ai/summarize-contract ─────────────────────────────────────
router.post('/summarize-contract', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_MATCHING);
    if (!allowed) {
      return res.status(403).json({
        error: 'upgrade_required',
        feature: 'ai_matching',
        message: 'Contract Summary is a Pro feature. Upgrade to unlock.',
      });
    }

    if (!hasAI()) {
      return res.status(503).json({ error: 'AI service is not available right now.' });
    }

    const { terms, scope, totalAmount, deliverables } = req.body;

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You are a contract analyst. Summarize contracts in plain English and flag unusual clauses. Return valid JSON only.',
        },
        {
          role: 'user',
          content: `Contract details:\nTerms: ${terms || 'Not specified'}\nScope: ${(scope || '').slice(0, 500)}\nTotal Amount: $${totalAmount || 0}\nDeliverables: ${deliverables || 'Not specified'}\n\nProvide a plain English summary, key points, and any warnings about unusual clauses. Return JSON: {"summary":"...","keyPoints":["..."],"warnings":["..."]}`,
        },
      ],
    });

    let result;
    try {
      const raw = completion.choices[0].message.content.replace(/```json\n?|```/g, '').trim();
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    return res.json(result);
  } catch (err) {
    console.error('[AI] summarize-contract error:', err.message);
    return res.status(500).json({ error: 'Failed to summarize contract' });
  }
});

// ── POST /api/ai/check-dispute-risk ─────────────────────────────────────
router.post('/check-dispute-risk', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_MATCHING);
    if (!allowed) {
      return res.status(403).json({
        error: 'upgrade_required',
        feature: 'ai_matching',
        message: 'Dispute Risk Check is a Pro feature. Upgrade to unlock.',
      });
    }

    if (!hasAI()) {
      return res.status(503).json({ error: 'AI service is not available right now.' });
    }

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const last20 = messages.slice(-20);

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are a dispute prevention analyst. Analyze conversation tone, detect escalation patterns, scope creep, and missed expectations. Return valid JSON only.',
        },
        {
          role: 'user',
          content: `Analyze these recent messages for dispute risk:\n\n${last20.map(m => `[${m.role || 'user'}]: ${(m.content || '').slice(0, 200)}`).join('\n')}\n\nReturn JSON: {"riskLevel":"low"|"medium"|"high","indicators":["..."],"recommendation":"..."}`,
        },
      ],
    });

    let result;
    try {
      const raw = completion.choices[0].message.content.replace(/```json\n?|```/g, '').trim();
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    return res.json(result);
  } catch (err) {
    console.error('[AI] check-dispute-risk error:', err.message);
    return res.status(500).json({ error: 'Failed to check dispute risk' });
  }
});

module.exports = router;
