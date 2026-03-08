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

// ── POST /api/ai/optimize-profile ─────────────────────────────────────────
// Freelancer: analyze their profile and return actionable improvement suggestions.
// Free (limited) — upsell hook; result nudges upgrade.
router.post('/optimize-profile', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const { bio, headline, skills, hourlyRate, category, completionScore } = req.body;
    if (!hasAI()) return res.status(503).json({ error: 'AI not available' });
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = [
      `Analyze this freelancer profile on Fetchwork and give 4-5 specific, actionable improvement suggestions.`,
      bio        ? `Bio: "${bio.slice(0, 600)}"` : 'Bio: (empty)',
      headline   ? `Headline: "${headline}"` : 'Headline: (empty)',
      skills?.length ? `Skills: ${skills.slice(0, 15).join(', ')}` : 'Skills: (none listed)',
      hourlyRate ? `Hourly rate: $${hourlyRate}/hr` : 'Rate: not set',
      category   ? `Category: ${category}` : '',
      completionScore != null ? `Profile completion: ${completionScore}%` : '',
      ``,
      `Format your response as a JSON array of objects: [{ "title": "...", "suggestion": "...", "impact": "high|medium|low" }]`,
      `Be specific — reference their actual content. No generic tips.`,
      `Focus on: missing info, weak bio, vague headline, pricing signals, skill gaps.`,
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.5,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '[]';
    let suggestions;
    try {
      const jsonStr = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      suggestions = JSON.parse(jsonStr);
    } catch { suggestions = []; }

    return res.json({ suggestions });
  } catch (err) {
    console.error('[AI] optimize-profile error:', err.message);
    return res.status(500).json({ error: 'Failed to analyze profile' });
  }
});

// ── GET /api/ai/summarize-reviews/:userId ──────────────────────────────────
// Public: summarize a freelancer's reviews for clients browsing their profile.
// Free — makes the platform feel smarter for everyone.
const reviewSummaryLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/summarize-reviews/:userId', reviewSummaryLimiter, validateMongoId, async (req, res) => {
  try {
    if (!hasAI()) return res.status(503).json({ error: 'AI not available' });
    const Review = require('../models/Review');
    const reviews = await Review.find({ reviewedId: req.params.userId, rating: { $gte: 1 } })
      .select('rating comment')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    if (reviews.length < 3) return res.json({ summary: null }); // not enough data

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const avgRating = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
    const reviewText = reviews.map((r, i) =>
      `${i + 1}. [${r.rating}★] "${(r.comment || '').slice(0, 200)}"`
    ).join('\n');

    const prompt = [
      `Summarize these ${reviews.length} client reviews for a freelancer (avg rating: ${avgRating}★).`,
      ``,
      reviewText,
      ``,
      `Write 2-3 sentences max. Highlight recurring strengths, any consistent praise, and one note of caution if relevant.`,
      `Start with "Clients consistently..." or similar. Be honest and specific.`,
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 120,
      temperature: 0.4,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || null;
    return res.json({ summary, reviewCount: reviews.length, avgRating: parseFloat(avgRating) });
  } catch (err) {
    console.error('[AI] summarize-reviews error:', err.message);
    return res.status(500).json({ error: 'Failed to summarize reviews' });
  }
});

// ── POST /api/ai/draft-response ────────────────────────────────────────────
// Draft a professional reply to a message in context.
// Gated: Plus+ (clients + freelancers).
router.post('/draft-response', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_JOB_DESCRIPTION);
    if (!allowed) return res.status(403).json({ error: 'upgrade_required', plan: 'Plus+' });

    const { lastMessage, senderName, context } = req.body;
    if (!lastMessage) return res.status(400).json({ error: 'lastMessage required' });

    if (!hasAI()) return res.status(503).json({ error: 'AI not available' });
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = [
      `Draft a brief, professional reply to this message on Fetchwork (a freelance marketplace).`,
      senderName ? `Message from: ${senderName}` : '',
      context    ? `Context: ${context.slice(0, 200)}` : '',
      ``,
      `Their message: "${lastMessage.slice(0, 600)}"`,
      ``,
      `Write 2-4 sentences. Sound human, not corporate. Don't start with "I hope this message finds you well."`,
      `Don't include a subject line or sign-off — just the reply body.`,
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    });

    const draft = completion.choices[0]?.message?.content?.trim() || '';
    return res.json({ draft });
  } catch (err) {
    console.error('[AI] draft-response error:', err.message);
    return res.status(500).json({ error: 'Failed to draft response' });
  }
});

// ── POST /api/ai/rate-advice ───────────────────────────────────────────────
// Tell a freelancer if their rate is above/below market and what to charge.
// Gated: Plus+.
router.post('/rate-advice', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_JOB_DESCRIPTION);
    if (!allowed) return res.status(403).json({ error: 'upgrade_required', plan: 'Plus+' });

    const { hourlyRate, skills, category, bio, location } = req.body;
    if (!category && !skills?.length) return res.status(400).json({ error: 'category or skills required' });

    if (!hasAI()) return res.status(503).json({ error: 'AI not available' });
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = [
      `A freelancer on Fetchwork wants rate advice. Analyze their profile and tell them if they're priced right.`,
      hourlyRate ? `Current rate: $${hourlyRate}/hr` : 'Current rate: not set',
      category   ? `Category: ${category}` : '',
      skills?.length ? `Skills: ${skills.slice(0, 10).join(', ')}` : '',
      location   ? `Location: ${location}` : '',
      bio        ? `Bio excerpt: "${bio.slice(0, 300)}"` : '',
      ``,
      `Respond as JSON: { "marketLow": <num>, "marketMid": <num>, "marketHigh": <num>, "verdict": "underpriced|fair|overpriced", "advice": "<2-3 sentence specific advice>", "positioning": "<one sentence on how to justify the rate>" }`,
      `Base on US freelance market rates. Be honest — if they're underpricing, say so clearly.`,
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 250,
      temperature: 0.4,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    let advice;
    try {
      const jsonStr = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      advice = JSON.parse(jsonStr);
    } catch { advice = null; }

    return res.json({ advice });
  } catch (err) {
    console.error('[AI] rate-advice error:', err.message);
    return res.status(500).json({ error: 'Failed to generate rate advice' });
  }
});

// ── POST /api/ai/fix-job-title ─────────────────────────────────────────────
// Improve a vague job title so it attracts better applicants.
// Free — helps job quality on the platform.
router.post('/fix-job-title', budgetEstimateLimiter, async (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    if (!hasAI()) return res.status(503).json({ error: 'AI not available' });
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = [
      `Improve this freelance job title so it attracts more relevant applicants on Fetchwork.`,
      `Current title: "${title}"`,
      category    ? `Category: ${category}` : '',
      description ? `Description excerpt: "${description.slice(0, 300)}"` : '',
      ``,
      `Respond as JSON: { "improved": "<better title>", "reason": "<one sentence why it's better>" }`,
      `Rules: under 70 chars, specific, searchable, no hype words like "ninja" or "rockstar".`,
      `If the title is already good, return the original with reason "Title looks good already."`,
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 120,
      temperature: 0.5,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    let result;
    try {
      const jsonStr = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      result = JSON.parse(jsonStr);
    } catch { result = { improved: title, reason: '' }; }

    return res.json(result);
  } catch (err) {
    console.error('[AI] fix-job-title error:', err.message);
    return res.status(500).json({ error: 'Failed to improve title' });
  }
});

// ── POST /api/ai/expand-scope ──────────────────────────────────────────────
// Turn a short job description into a full detailed scope.
// Free — improves job quality for the whole platform.
router.post('/expand-scope', budgetEstimateLimiter, async (req, res) => {
  try {
    const { description, title, category } = req.body;
    if (!description) return res.status(400).json({ error: 'description required' });

    if (!hasAI()) return res.status(503).json({ error: 'AI not available' });
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = [
      `Expand this brief job description into a well-structured, detailed scope document for a freelance project on Fetchwork.`,
      title       ? `Job title: "${title}"` : '',
      category    ? `Category: ${category}` : '',
      `Current description: "${description.slice(0, 600)}"`,
      ``,
      `Write 150-250 words. Include: overview, key deliverables (bullet list), what freelancer needs to know, preferred timeline note.`,
      `Write it as if the client wrote it themselves — first person "I need..." or "We're looking for..."`,
      `Do NOT add requirements the client didn't mention. Expand what's there, don't invent scope.`,
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.6,
    });

    const expanded = completion.choices[0]?.message?.content?.trim() || '';
    return res.json({ expanded });
  } catch (err) {
    console.error('[AI] expand-scope error:', err.message);
    return res.status(500).json({ error: 'Failed to expand scope' });
  }
});

// ── POST /api/ai/dispute-assistant ────────────────────────────────────────
// Help a user write a clear, compelling dispute description.
// Gated: Pro.
router.post('/dispute-assistant', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const allowed = await hasFeature(req.user.id, FEATURES.AI_MATCHING);
    if (!allowed) return res.status(403).json({ error: 'upgrade_required', plan: 'Pro' });

    const { reason, description, role } = req.body; // role: 'client' | 'freelancer'
    if (!reason || !description) return res.status(400).json({ error: 'reason and description required' });

    if (!hasAI()) return res.status(503).json({ error: 'AI not available' });
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = [
      `A ${role || 'user'} is filing a dispute on Fetchwork (a freelance marketplace). Help them write a clear, professional, factual dispute description.`,
      `Dispute reason: ${reason}`,
      `Their current description: "${description.slice(0, 800)}"`,
      ``,
      `Rewrite it to be more compelling and clear. Include:`,
      `- What was agreed upon (infer from their text)`,
      `- What actually happened`,
      `- The specific harm or issue`,
      `- What resolution they're seeking`,
      `Keep it factual, not emotional. 150-200 words.`,
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 350,
      temperature: 0.5,
    });

    const improved = completion.choices[0]?.message?.content?.trim() || '';
    return res.json({ improved });
  } catch (err) {
    console.error('[AI] dispute-assistant error:', err.message);
    return res.status(500).json({ error: 'Failed to improve dispute description' });
  }
});

module.exports = router;
