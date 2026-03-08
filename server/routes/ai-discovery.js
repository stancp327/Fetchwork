/**
 * AI Discovery routes — semantic search, skill suggestions, category
 * classification, SEO optimizer, portfolio writer.
 * All AI calls degrade gracefully when OPENAI_API_KEY is not set.
 */
const express    = require('express');
const router     = express.Router();
const rateLimit  = require('express-rate-limit');
const { OpenAI } = require('openai');

const { authenticateToken }    = require('../middleware/auth');
const { hasAI }                = require('../services/aiService');
const { hasFeature, FEATURES } = require('../services/entitlementEngine');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Rate limiters ────────────────────────────────────────────────
const publicLimiter = rateLimit({
  windowMs: 60_000,
  max:      20,
  message:  { error: 'Too many requests — try again in a minute' },
  standardHeaders: true,
  legacyHeaders:   false,
});

const gatedLimiter = rateLimit({
  windowMs: 60_000,
  max:      10,
  message:  { error: 'Too many AI requests — try again in a minute' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── 1. POST /api/ai/semantic-search ──────────────────────────────
router.post('/semantic-search', publicLimiter, async (req, res) => {
  try {
    const { query, results } = req.body;
    if (!query || !results?.length) {
      return res.status(400).json({ error: 'query and results are required' });
    }

    const items = results.slice(0, 20);

    if (!hasAI()) {
      return res.json({
        ranked: items.map((r, i) => ({ _id: r._id, score: 100 - i, reason: 'Default order' })),
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a search relevance ranker. Given a search query and a list of results, re-rank them by relevance.
Return ONLY valid JSON: {"ranked":[{"_id":"...","score":0-100,"reason":"..."}]}
Score 100 = perfect match, 0 = irrelevant. Include all provided items.`,
        },
        {
          role: 'user',
          content: `Query: "${query}"\n\nResults:\n${JSON.stringify(items.map(r => ({ _id: r._id, title: r.title, name: r.name, bio: r.bio, skills: r.skills, category: r.category })))}`,
        },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const text = completion.choices[0].message.content.trim();
    const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''));
    return res.json({ ranked: parsed.ranked });
  } catch (err) {
    console.error('semantic-search error:', err);
    const items = (req.body.results || []).slice(0, 20);
    return res.json({
      ranked: items.map((r, i) => ({ _id: r._id, score: 100 - i, reason: 'Fallback order' })),
    });
  }
});

// ── 2. POST /api/ai/suggest-skills ───────────────────────────────
router.post('/suggest-skills', publicLimiter, async (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (!title && !description) {
      return res.status(400).json({ error: 'title or description is required' });
    }

    if (!hasAI()) {
      return res.status(503).json({ error: 'AI not available' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You suggest specific, relevant skills for job postings. Return ONLY valid JSON: {"skills":["skill1","skill2",...]}
Return 6-10 specific skills appropriate for the job type. Be practical and industry-standard.`,
        },
        {
          role: 'user',
          content: `Title: ${title || 'N/A'}\nDescription: ${(description || '').slice(0, 500)}\nCategory: ${category || 'N/A'}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.5,
    });

    const text = completion.choices[0].message.content.trim();
    const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''));
    return res.json({ skills: parsed.skills });
  } catch (err) {
    console.error('suggest-skills error:', err);
    return res.status(500).json({ error: 'Failed to suggest skills' });
  }
});

// ── 3. POST /api/ai/classify-category ────────────────────────────
router.post('/classify-category', publicLimiter, async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    if (!hasAI()) {
      return res.status(503).json({ error: 'AI not available' });
    }

    const categories = 'web_dev, mobile, design, writing, marketing, photography, fitness, tutoring, cooking, cleaning, music, business, legal, finance, translation, video, audio, data, ai_ml, other';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You classify jobs into categories. Available categories: ${categories}
Return ONLY valid JSON: {"category":"...","subcategory":"...","confidence":0.0-1.0,"reason":"..."}
confidence should reflect how certain you are. subcategory should be a specific area within the category.`,
        },
        {
          role: 'user',
          content: `Title: ${title}\nDescription: ${(description || '').slice(0, 500)}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const text = completion.choices[0].message.content.trim();
    const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''));
    return res.json(parsed);
  } catch (err) {
    console.error('classify-category error:', err);
    return res.status(500).json({ error: 'Failed to classify category' });
  }
});

// ── 4. POST /api/ai/optimize-service-seo ─────────────────────────
router.post('/optimize-service-seo', authenticateToken, gatedLimiter, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_JOB_DESCRIPTION);
    if (!allowed) {
      return res.status(403).json({
        error:   'upgrade_required',
        feature: 'ai_job_description',
        message: 'SEO optimization is available on Plus and above. Upgrade to unlock.',
      });
    }

    if (!hasAI()) {
      return res.status(503).json({ error: 'AI not available' });
    }

    const { title, description, category, skills } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an SEO specialist for service listings on a freelance marketplace.
Analyze the service listing and provide optimization tips.
Return ONLY valid JSON: {"keywords":["..."],"titleSuggestion":"...","descriptionTips":["..."],"tagSuggestions":["..."]}
- keywords: 5-8 high-value search terms clients would use
- titleSuggestion: an improved, SEO-friendly title
- descriptionTips: 3-5 actionable tips to improve the description
- tagSuggestions: 5-8 relevant tags/skills to add`,
        },
        {
          role: 'user',
          content: `Title: ${title}\nDescription: ${(description || '').slice(0, 1000)}\nCategory: ${category || 'N/A'}\nSkills: ${skills || 'N/A'}`,
        },
      ],
      max_tokens: 600,
      temperature: 0.5,
    });

    const text = completion.choices[0].message.content.trim();
    const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''));
    return res.json(parsed);
  } catch (err) {
    console.error('optimize-service-seo error:', err);
    return res.status(500).json({ error: 'Failed to generate SEO tips' });
  }
});

// ── 5. POST /api/ai/write-portfolio-description ──────────────────
router.post('/write-portfolio-description', authenticateToken, gatedLimiter, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_JOB_DESCRIPTION);
    if (!allowed) {
      return res.status(403).json({
        error:   'upgrade_required',
        feature: 'ai_job_description',
        message: 'AI portfolio writer is available on Plus and above. Upgrade to unlock.',
      });
    }

    if (!hasAI()) {
      return res.status(503).json({ error: 'AI not available' });
    }

    const { title, category, skills, projectContext } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You write compelling portfolio project descriptions for freelancers.
Write a 100-150 word description that highlights the project's impact, the freelancer's role, and key achievements.
Return ONLY valid JSON: {"description":"..."}
Keep it professional, engaging, and specific. Use active voice.`,
        },
        {
          role: 'user',
          content: `Project Title: ${title}\nCategory: ${category || 'N/A'}\nSkills Used: ${skills || 'N/A'}\nContext: ${(projectContext || '').slice(0, 500)}`,
        },
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    const text = completion.choices[0].message.content.trim();
    const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''));
    return res.json({ description: parsed.description });
  } catch (err) {
    console.error('write-portfolio-description error:', err);
    return res.status(500).json({ error: 'Failed to generate description' });
  }
});

module.exports = router;
