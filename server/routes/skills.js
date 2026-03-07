/**
 * Skills Assessment + Pricing Insights routes
 * POST /api/skills/assess/:category     — submit quiz answers
 * GET  /api/skills/categories           — list available quiz categories
 * GET  /api/skills/my-assessments       — authenticated user's assessments + badges
 * GET  /api/skills/user/:userId         — public badges for a profile
 * GET  /api/skills/pricing-insights     — market pricing data for a category
 * GET  /api/skills/budget-insights      — market budget data for job category
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const SkillAssessment = require('../models/SkillAssessment');
const Service = require('../models/Service');
const Job = require('../models/Job');

const QUESTIONS = require('../data/skillQuestions.json');
const PASS_THRESHOLD = 80; // % to earn badge

// Rate limit quiz submission — 20/hour per user
const quizLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many attempts. Try again in an hour.' },
});

// ─── GET /api/skills/questions/:category ────────────────────────────────────
// Serves questions WITHOUT answers (answers stripped for frontend)
router.get('/questions/:category', (req, res) => {
  const { category } = req.params;
  const data = QUESTIONS[category];
  if (!data) return res.status(404).json({ error: 'Category not found' });
  const questions = data.questions.map(({ id, q, options }) => ({ id, q, options })); // strip answer
  res.json({ category, label: data.label, questions });
});

// ─── GET /api/skills/categories ─────────────────────────────────────────────
// Returns the list of assessable categories (only ones with questions)
router.get('/categories', (req, res) => {
  const categories = Object.entries(QUESTIONS).map(([id, data]) => ({
    id,
    label: data.label,
    questionCount: data.questions.length,
    passMark: PASS_THRESHOLD,
  }));
  res.json({ categories });
});

// ─── GET /api/skills/my-assessments ─────────────────────────────────────────
router.get('/my-assessments', auth, async (req, res) => {
  try {
    const assessments = await SkillAssessment.find({ userId: req.user.id })
      .sort({ completedAt: -1 })
      .lean();
    res.json({ assessments });
  } catch (err) {
    console.error('my-assessments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/skills/user/:userId ────────────────────────────────────────────
// Public: only returns passed (badge-earning) assessments
router.get('/user/:userId', async (req, res) => {
  try {
    const assessments = await SkillAssessment.find({
      userId: req.params.userId,
      passed: true,
    })
      .select('category categoryLabel score badge.tier badge.awardedAt completedAt')
      .sort({ 'badge.awardedAt': -1 })
      .lean();
    res.json({ assessments });
  } catch (err) {
    console.error('user assessments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/skills/assess/:category ──────────────────────────────────────
// Body: { answers: [0, 2, 1, ...] }  (array of selected option indices)
router.post('/assess/:category', auth, quizLimiter, async (req, res) => {
  try {
    const { category } = req.params;
    const { answers } = req.body;

    const categoryData = QUESTIONS[category];
    if (!categoryData) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const questions = categoryData.questions;
    if (!Array.isArray(answers) || answers.length !== questions.length) {
      return res.status(400).json({
        error: `Expected ${questions.length} answers, got ${answers?.length ?? 0}`,
      });
    }

    // Score
    let correct = 0;
    const breakdown = questions.map((q, i) => {
      const isCorrect = answers[i] === q.answer;
      if (isCorrect) correct++;
      return { id: q.id, correct: isCorrect, correctAnswer: q.answer, yourAnswer: answers[i] };
    });

    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= PASS_THRESHOLD;

    // Upsert assessment record
    const existing = await SkillAssessment.findOne({ userId: req.user.id, category });
    let assessment;

    if (existing) {
      // Already have a record — update with latest attempt
      existing.attempts += 1;
      existing.lastAttemptAt = new Date();
      // Only update score/badge if this attempt is better or first pass
      if (!existing.passed && passed) {
        existing.passed = true;
        existing.score = score;
        existing.correctQ = correct;
        existing.badge = { earned: true, tier: 'bronze', awardedAt: new Date() };
      } else if (score > existing.score) {
        existing.score = score;
        existing.correctQ = correct;
        // Upgrade tier if score improves
        if (existing.badge?.earned) {
          existing.badge.tier = score >= 95 ? 'gold' : score >= 88 ? 'silver' : 'bronze';
        } else if (passed) {
          existing.badge = { earned: true, tier: 'bronze', awardedAt: new Date() };
          existing.passed = true;
        }
      }
      assessment = await existing.save();
    } else {
      assessment = await SkillAssessment.create({
        userId: req.user.id,
        category,
        categoryLabel: categoryData.label,
        score,
        passed,
        totalQ: questions.length,
        correctQ: correct,
        badge: passed
          ? { earned: true, tier: score >= 95 ? 'gold' : score >= 88 ? 'silver' : 'bronze', awardedAt: new Date() }
          : { earned: false },
      });
    }

    res.json({
      score,
      passed,
      correct,
      total: questions.length,
      badge: assessment.badge,
      breakdown,
      message: passed
        ? `🏅 You passed! ${categoryData.label} badge earned.`
        : `Score: ${score}%. Need ${PASS_THRESHOLD}% to earn the badge. Try again!`,
    });
  } catch (err) {
    console.error('assess error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/skills/pricing-insights ────────────────────────────────────────
// Query: category, subcategory (optional)
// Returns: min, p25, median, p75, max, count of published services in that category
router.get('/pricing-insights', async (req, res) => {
  try {
    const { category, subcategory } = req.query;
    if (!category) return res.status(400).json({ error: 'category is required' });

    const match = {
      'pricing.base': { $gt: 0 },
      isActive: true,
      category,
    };
    if (subcategory) match.subcategory = subcategory;

    const services = await Service.find(match)
      .select('pricing.base subcategory')
      .lean();

    if (services.length < 3) {
      return res.json({
        count: services.length,
        insufficient: true,
        message: 'Not enough data yet for this category.',
      });
    }

    const prices = services.map((s) => s.pricing?.base || 0).sort((a, b) => a - b);
    const count = prices.length;

    const percentile = (p) => {
      const idx = (p / 100) * (count - 1);
      const lower = Math.floor(idx);
      const frac = idx - lower;
      return Math.round(prices[lower] + frac * (prices[Math.min(lower + 1, count - 1)] - prices[lower]));
    };

    // Grouped distribution for chart (buckets)
    const max = prices[count - 1];
    const bucketSize = Math.max(10, Math.round(max / 8 / 5) * 5);
    const buckets = {};
    prices.forEach((p) => {
      const bucket = Math.floor(p / bucketSize) * bucketSize;
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    });
    const distribution = Object.entries(buckets)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([min, count]) => ({ min: Number(min), max: Number(min) + bucketSize, count }));

    res.json({
      category,
      subcategory: subcategory || null,
      count,
      min: prices[0],
      p25: percentile(25),
      median: percentile(50),
      p75: percentile(75),
      max: prices[count - 1],
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / count),
      distribution,
    });
  } catch (err) {
    console.error('pricing-insights error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/skills/budget-insights ────────────────────────────────────────
// For job posting — shows what clients typically budget for a category
router.get('/budget-insights', async (req, res) => {
  try {
    const { category } = req.query;
    if (!category) return res.status(400).json({ error: 'category is required' });

    const jobs = await Job.find({
      category,
      'budget.min': { $gt: 0 },
      status: { $in: ['open', 'in_progress', 'completed'] },
    })
      .select('budget')
      .lean();

    if (jobs.length < 3) {
      return res.json({
        count: jobs.length,
        insufficient: true,
        message: 'Not enough data yet for this category.',
      });
    }

    // Use midpoint of budget range
    const budgets = jobs
      .map((j) => {
        if (j.budget?.min && j.budget?.max) return (j.budget.min + j.budget.max) / 2;
        return j.budget?.min || 0;
      })
      .filter((b) => b > 0)
      .sort((a, b) => a - b);

    const count = budgets.length;
    const percentile = (p) => {
      const idx = (p / 100) * (count - 1);
      const lower = Math.floor(idx);
      const frac = idx - lower;
      return Math.round(budgets[lower] + frac * (budgets[Math.min(lower + 1, count - 1)] - budgets[lower]));
    };

    res.json({
      category,
      count,
      min: budgets[0],
      p25: percentile(25),
      median: percentile(50),
      p75: percentile(75),
      max: budgets[count - 1],
      avg: Math.round(budgets.reduce((a, b) => a + b, 0) / count),
      label: 'Budget range from posted jobs',
    });
  } catch (err) {
    console.error('budget-insights error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
