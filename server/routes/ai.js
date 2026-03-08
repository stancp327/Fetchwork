/**
 * AI routes — job description generation + smart freelancer matching.
 * All AI calls degrade gracefully when OPENAI_API_KEY is not set.
 */
const express  = require('express');
const router   = express.Router();
const rateLimit = require('express-rate-limit');

const { authenticateToken } = require('../middleware/auth');
const { validateMongoId }   = require('../middleware/validation');
const User = require('../models/User');
const Job  = require('../models/Job');
const { generateJobDescription, aiRankFreelancers, hasAI } = require('../services/aiService');
const { hasFeature, FEATURES } = require('../services/entitlementEngine');

// Tight rate limit for AI endpoints (they cost $)
const aiLimiter = rateLimit({
  windowMs: 60_000,
  max:      10,
  message:  { error: 'Too many AI requests — try again in a minute' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── POST /api/ai/generate-description ─────────────────────────────────────
router.post('/generate-description', authenticateToken, aiLimiter, async (req, res) => {
  try {
    // Feature gate — Plus and above
    const allowed = await hasFeature(req.user.id, FEATURES.AI_JOB_DESCRIPTION);
    if (!allowed) {
      return res.status(403).json({
        error:   'upgrade_required',
        feature: 'ai_job_description',
        message: 'AI job descriptions are available on Plus and above. Upgrade to unlock.',
      });
    }

    const { title, category, skills, budgetType, budgetAmount, duration, experienceLevel } = req.body;

    if (!title || !category) {
      return res.status(400).json({ error: 'title and category are required' });
    }

    let description = null;

    // Try AI first
    description = await generateJobDescription({
      title, category,
      skills:          Array.isArray(skills) ? skills : (skills || '').split(',').map(s => s.trim()).filter(Boolean),
      budgetType:      budgetType || 'fixed',
      budgetAmount,
      duration,
      experienceLevel,
    });

    // Fallback: template-based description
    if (!description) {
      const skillList = Array.isArray(skills) && skills.length
        ? skills.join(', ')
        : (skills || '').split(',').map(s => s.trim()).filter(Boolean).join(', ') || 'relevant skills';

      description = [
        `We are looking for a skilled professional to help with ${title}.`,
        ``,
        `This is a ${category} project requiring expertise in ${skillList}. The ideal candidate will have a strong track record in similar work, excellent communication skills, and the ability to deliver quality results on time.`,
        ``,
        `Responsibilities include understanding project requirements, delivering high-quality work, and maintaining clear communication throughout the project.`,
        ``,
        `Please include relevant examples of past work in your proposal. We look forward to working with you!`,
      ].join('\n');
    }

    return res.json({ description, aiGenerated: hasAI() });
  } catch (err) {
    console.error('[AI] generate-description error:', err.message);
    return res.status(500).json({ error: 'Failed to generate description' });
  }
});

// ── GET /api/ai/match-freelancers/:id ─────────────────────────────────────
router.get('/match-freelancers/:id', authenticateToken, validateMongoId, aiLimiter, async (req, res) => {
  try {
    // Feature gate — Pro and above
    const allowed = await hasFeature(req.user.id, FEATURES.AI_MATCHING);
    if (!allowed) {
      return res.status(403).json({
        error:   'upgrade_required',
        feature: 'ai_matching',
        message: 'AI freelancer matching is available on Pro and above. Upgrade to unlock.',
      });
    }

    const job = await Job.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Only the job owner (or admin) can fetch matches
    const isOwner = job.client.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // ── Algorithmic scoring ───────────────────────────────────────────────
    const jobSkills = (job.skills || []).map(s => s.toLowerCase());
    const jobCategory = (job.category || '').toLowerCase();
    const experienceLevel = job.experienceLevel || 'intermediate';

    const EXPERIENCE_THRESHOLDS = {
      entry:        [0, 5],
      intermediate: [3, 30],
      expert:       [15, Infinity],
    };
    const [expMin, expMax] = EXPERIENCE_THRESHOLDS[experienceLevel] || [0, Infinity];

    const VERIFICATION_SCORES = { full: 5, identity: 4, phone: 3, email: 2, none: 0 };

    const freelancers = await User.find({
      isActive:    true,
      isSuspended: { $ne: true },
      accountType: { $in: ['freelancer', 'both'] },
      _id:         { $ne: job.client },
    })
      .select('firstName lastName profilePicture bio skills rating totalReviews completedJobs hourlyRate verificationLevel avgResponseTime location')
      .lean();

    const scored = freelancers.map(f => {
      const fSkills = (f.skills || []).map(s => s.toLowerCase());

      // Skills overlap — up to 40 pts
      const skillScore = jobSkills.length > 0
        ? (jobSkills.filter(s => fSkills.some(fs => fs.includes(s) || s.includes(fs))).length / jobSkills.length) * 40
        : 20; // no required skills = neutral

      // Rating — up to 15 pts
      const ratingScore = ((f.rating || 0) / 5) * 15;

      // Experience level match — up to 10 pts
      const jobs = f.completedJobs || 0;
      const expScore = jobs >= expMin && jobs <= expMax ? 10 : jobs >= expMin * 0.5 ? 5 : 0;

      // Bio/name contains category keyword — up to 20 pts
      const bioText = ((f.bio || '') + ' ' + fSkills.join(' ')).toLowerCase();
      const catWords = jobCategory.split(/[\s_-]+/).filter(w => w.length > 3);
      const catScore = catWords.some(w => bioText.includes(w)) ? 20 : 0;

      // Verification — up to 5 pts
      const verScore = VERIFICATION_SCORES[f.verificationLevel || 'none'] || 0;

      // Completed jobs bonus — up to 5 pts (normalized at 50)
      const jobsScore = Math.min(jobs / 50, 1) * 5;

      // Response time bonus — up to 5 pts
      const respScore = f.avgResponseTime
        ? f.avgResponseTime <= 1 ? 5 : f.avgResponseTime <= 4 ? 3 : f.avgResponseTime <= 12 ? 1 : 0
        : 0;

      const total = Math.round(skillScore + ratingScore + expScore + catScore + verScore + jobsScore + respScore);

      return {
        userId:       f._id.toString(),
        name:         `${f.firstName} ${f.lastName}`,
        profilePicture: f.profilePicture || '',
        skills:       f.skills || [],
        bio:          f.bio || '',
        rating:       f.rating || 0,
        totalReviews: f.totalReviews || 0,
        completedJobs: f.completedJobs || 0,
        hourlyRate:   f.hourlyRate || 0,
        verificationLevel: f.verificationLevel || 'none',
        algorithmicScore: total,
        matchReason: null,
        aiScore:     null,
      };
    });

    // Sort by algorithmic score, take top 20 candidates
    scored.sort((a, b) => b.algorithmicScore - a.algorithmicScore);
    const top20 = scored.slice(0, 20);

    // ── AI re-ranking (optional) ──────────────────────────────────────────
    let aiResults = null;
    try {
      aiResults = await aiRankFreelancers(job, top20);
    } catch { /* non-fatal */ }

    let finalResults;
    if (aiResults && Array.isArray(aiResults) && aiResults.length > 0) {
      // Merge AI scores + reasons onto candidate objects
      const aiMap = new Map(aiResults.map(r => [r.userId, r]));
      finalResults = top20.map(c => ({
        ...c,
        matchReason: aiMap.get(c.userId)?.matchReason || null,
        aiScore:     aiMap.get(c.userId)?.aiScore     || c.algorithmicScore,
      }));
      finalResults.sort((a, b) => b.aiScore - a.aiScore);
    } else {
      // Algorithmic only — generate a simple match reason
      finalResults = top20.map(c => {
        const overlap = (job.skills || []).filter(s =>
          c.skills.some(fs => fs.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(fs.toLowerCase()))
        );
        const reason = overlap.length > 0
          ? `Matches ${overlap.slice(0, 3).join(', ')} skills` + (c.rating >= 4 ? ` · ${c.rating.toFixed(1)}★ rating` : '')
          : c.rating >= 4
            ? `${c.rating.toFixed(1)}★ rated with ${c.completedJobs} completed jobs`
            : `${c.completedJobs} completed jobs in ${job.category}`;

        return { ...c, matchReason: reason, aiScore: c.algorithmicScore };
      });
    }

    return res.json({
      matches:     finalResults.slice(0, 10),
      total:       freelancers.length,
      aiPowered:   hasAI() && !!aiResults,
    });
  } catch (err) {
    console.error('[AI] match-freelancers error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// ── POST /api/ai/support-chat ──────────────────────────────────────────────
// Public-ish endpoint (no auth required — support chat is for everyone).
// Rate-limited to prevent abuse.
const supportChatLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: { error: 'Too many messages — slow down a bit!' },
  standardHeaders: true,
  legacyHeaders: false,
});

const SUPPORT_SYSTEM_PROMPT = `You are the Fetchwork support assistant — friendly, concise, and helpful.
Fetchwork is a freelance marketplace that connects clients with skilled freelancers across categories like web development, design, writing, photography, fitness coaching, tutoring, cooking, and more.

Key platform facts:
- Clients post jobs or browse services; freelancers apply with proposals or offer services directly
- Plans: Freelancer Free / Plus+ / Pro | Client Free / Plus+ / Business
- Payments handled via Stripe; freelancers need Stripe Connect to receive payouts
- Services support one-time bookings, recurring subscriptions, and prepaid bundles
- Video/audio calls, messaging, contracts, and dispute resolution all built-in
- Boosts let freelancers promote their services/jobs for more visibility
- Booking calendar with availability management available on Plus+ and above

How to respond:
- Keep answers short and practical
- If you don't know something specific, say so and suggest contacting support@fetchwork.net
- Never make up pricing, policies, or features you're unsure about
- For billing/payment issues, direct to the Billing section in their account settings
- Be warm but efficient — freelancers and clients are busy people`;

router.post('/support-chat', supportChatLimiter, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }

    // Cap history to last 10 messages to keep costs low
    const history = messages.slice(-10).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content).slice(0, 1000), // cap per message
    }));

    // Use the same internal client pattern as the rest of aiService
    const { hasAI } = require('../services/aiService');
    if (!hasAI()) {
      return res.json({
        reply: "I'm not available right now. For help, please email support@fetchwork.net and we'll get back to you shortly.",
      });
    }
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    if (!openai) {
      return res.json({
        reply: "I'm not available right now. For help, please email support@fetchwork.net and we'll get back to you shortly.",
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SUPPORT_SYSTEM_PROMPT },
        ...history,
      ],
      max_tokens: 400,
      temperature: 0.5,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "I'm not sure about that — please email support@fetchwork.net for help.";
    return res.json({ reply });
  } catch (err) {
    console.error('[AI] support-chat error:', err.message);
    return res.json({
      reply: "I'm having trouble right now. Please email support@fetchwork.net and we'll help you out.",
    });
  }
});

// ── POST /api/ai/write-proposal ────────────────────────────────────────────
// Freelancer tool: given a job + their profile, draft a cover letter.
// Gated: Plus+ and above.
router.post('/write-proposal', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_JOB_DESCRIPTION); // reuse Plus+ gate
    if (!allowed) return res.status(403).json({ error: 'upgrade_required', plan: 'Plus+' });

    const { jobTitle, jobDescription, jobBudget, jobCategory, userBio, userSkills } = req.body;
    if (!jobTitle || !jobDescription) return res.status(400).json({ error: 'jobTitle and jobDescription required' });

    if (!hasAI()) return res.status(503).json({ error: 'AI not available' });

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = [
      `Write a compelling freelance proposal cover letter for the following job.`,
      ``,
      `JOB TITLE: ${jobTitle}`,
      `JOB DESCRIPTION: ${jobDescription.slice(0, 800)}`,
      jobCategory ? `CATEGORY: ${jobCategory}` : '',
      jobBudget   ? `CLIENT BUDGET: $${jobBudget}` : '',
      ``,
      `FREELANCER BACKGROUND:`,
      userBio    ? `Bio: ${userBio.slice(0, 400)}` : '',
      userSkills ? `Skills: ${Array.isArray(userSkills) ? userSkills.join(', ') : userSkills}` : '',
      ``,
      `Instructions:`,
      `- 150-250 words, professional but warm tone`,
      `- Open with a specific hook related to the job (not generic)`,
      `- Highlight 2-3 relevant skills or experiences`,
      `- Show you understand what the client needs`,
      `- End with a clear call to action`,
      `- Do NOT include a subject line or salutation — just the body`,
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.75,
    });

    const draft = completion.choices[0]?.message?.content?.trim() || '';
    return res.json({ draft });
  } catch (err) {
    console.error('[AI] write-proposal error:', err.message);
    return res.status(500).json({ error: 'Failed to generate proposal' });
  }
});

// ── POST /api/ai/summarize-proposals ───────────────────────────────────────
// Client tool: summarize all proposals on a job so client can decide faster.
// Gated: Plus+ and above (client plans).
router.post('/summarize-proposals/:jobId', authenticateToken, validateMongoId, aiLimiter, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_JOB_DESCRIPTION); // reuse Plus+ gate
    if (!allowed) return res.status(403).json({ error: 'upgrade_required', plan: 'Plus+' });

    const job = await Job.findById(req.params.jobId)
      .select('title description clientId proposals')
      .populate('proposals.freelancerId', 'name title skills');
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.clientId) !== String(req.user.id)) return res.status(403).json({ error: 'Not your job' });

    const proposals = (job.proposals || []).filter(p => p.status !== 'withdrawn').slice(0, 15);
    if (proposals.length === 0) return res.json({ summary: 'No proposals to summarize yet.' });

    if (!hasAI()) return res.status(503).json({ error: 'AI not available' });

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const proposalList = proposals.map((p, i) => {
      const name = p.freelancerId?.name || 'Freelancer';
      const skills = p.freelancerId?.skills?.join(', ') || '';
      const letter = (p.coverLetter || '').slice(0, 300);
      const bid = p.proposedBudget ? `$${p.proposedBudget}` : 'no bid';
      return `${i + 1}. ${name} (${bid})${skills ? ` — Skills: ${skills}` : ''}\n   "${letter}"`;
    }).join('\n\n');

    const prompt = [
      `Summarize these ${proposals.length} freelance proposals for the job: "${job.title}"`,
      ``,
      proposalList,
      ``,
      `Provide:`,
      `1. A 2-sentence overall summary of the applicant pool`,
      `2. Top 3 standout candidates with one sentence on why each is notable`,
      `3. Any red flags or patterns to be aware of`,
      `4. A recommended next step`,
      `Keep it concise and actionable — the client is busy.`,
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.4,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || '';
    return res.json({ summary, count: proposals.length });
  } catch (err) {
    console.error('[AI] summarize-proposals error:', err.message);
    return res.status(500).json({ error: 'Failed to summarize proposals' });
  }
});

// ── GET /api/ai/budget-estimate ────────────────────────────────────────────
// Free tool: helps clients understand what a job should cost.
// No auth required — convert more users.
const budgetEstimateLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  message: { error: 'Too many requests — try again in a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/budget-estimate', budgetEstimateLimiter, async (req, res) => {
  try {
    const { category, description } = req.query;
    if (!category && !description) return res.status(400).json({ error: 'category or description required' });

    if (!hasAI()) return res.json({
      estimate: null,
      message: 'AI estimate unavailable — check market rates on similar job listings.',
    });

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = [
      `A client is posting a freelance job on Fetchwork. Estimate a reasonable budget range.`,
      category    ? `Category: ${category}` : '',
      description ? `Job description: ${description.slice(0, 500)}` : '',
      ``,
      `Respond with ONLY valid JSON in this exact format (no markdown):`,
      `{`,
      `  "low": <number>,`,
      `  "mid": <number>,`,
      `  "high": <number>,`,
      `  "type": "fixed" or "hourly",`,
      `  "rationale": "<one sentence explaining the range>"`,
      `}`,
      `Base estimates on typical US freelance market rates.`,
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    let estimate;
    try { estimate = JSON.parse(raw); } catch { estimate = null; }

    return res.json({ estimate });
  } catch (err) {
    console.error('[AI] budget-estimate error:', err.message);
    return res.status(500).json({ error: 'Failed to generate estimate' });
  }
});

module.exports = router;
