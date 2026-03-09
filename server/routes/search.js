const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const User = require('../models/User');
const { trackEvent } = require('../middleware/analytics');
const rateLimit = require('express-rate-limit');
const searchLimiter = rateLimit({ windowMs: 60_000, max: 30, message: { error: 'Too many search requests, please try again later' }, standardHeaders: true, legacyHeaders: false });

// Backward-compatible search root endpoint
// GET /api/search?q=design&limit=10
router.get('/', searchLimiter, async (req, res) => {
  trackEvent('searches');
  try {
    const q = (req.query.q || req.query.query || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    if (!q || q.length < 2) {
      return res.json({ jobs: [], total: 0 });
    }

    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'i');

    const filters = {
      isActive: true,
      status: 'open',
      $or: [
        { title: regex },
        { description: regex },
        { skills: { $in: [regex] } },
        { category: regex },
      ],
    };

    const jobs = await Job.find(filters)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('title description category skills budget location createdAt proposalCount isUrgent')
      .lean();

    const total = await Job.countDocuments(filters);
    res.json({ jobs, total });
  } catch (error) {
    console.error('Error searching jobs:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/suggestions', async (req, res) => {
  trackEvent('searches');
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = [];
    const safeQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safeQ, 'i');

    const jobTitles = await Job.distinct('title', {
      title: regex,
      isActive: true,
      status: 'open'
    });
    jobTitles.slice(0, 3).forEach(title => {
      suggestions.push({ text: title, type: 'job' });
    });

    const skills = await Job.distinct('skills', {
      skills: regex,
      isActive: true,
      status: 'open'
    });
    skills.slice(0, 3).forEach(skill => {
      suggestions.push({ text: skill, type: 'skill' });
    });

    const categories = await Job.distinct('category', {
      category: regex,
      isActive: true,
      status: 'open'
    });
    categories.slice(0, 2).forEach(category => {
      const formattedCategory = category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      suggestions.push({ text: formattedCategory, type: 'category' });
    });

    const cities = await Job.distinct('location.city', {
      'location.city': regex,
      isActive: true,
      status: 'open'
    });
    cities.filter(c => c).slice(0, 2).forEach(city => {
      suggestions.push({ text: city, type: 'location' });
    });

    res.json({ suggestions: suggestions.slice(0, 10) });
  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

module.exports = router;
