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

module.exports = router;
