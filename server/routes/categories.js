const express = require('express');
const router = express.Router();
const { CATEGORIES, getRemoteCategories, getLocalCategories, getCategoryById } = require('../config/categories');
const Job     = require('../models/Job');
const Service = require('../models/Service');
const User    = require('../models/User');

// GET /api/categories — all categories
router.get('/', (req, res) => {
  // Optional filter: ?type=remote or ?type=local
  if (req.query.type === 'remote') {
    return res.json({ categories: getRemoteCategories() });
  }
  if (req.query.type === 'local') {
    return res.json({ categories: getLocalCategories() });
  }
  res.json({ categories: CATEGORIES });
});

// GET /api/categories/:id — single category with subcategories
router.get('/:id', (req, res) => {
  const category = getCategoryById(req.params.id);
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }
  res.json({ category });
});

// GET /api/categories/:id/overview — SEO landing page data
// Returns: top jobs, top services, top freelancers, stats for this category
router.get('/:id/overview', async (req, res) => {
  try {
    const catId = req.params.id;
    const category = getCategoryById(catId);

    // Use a regex for partial-match on open-ended categories too
    // Escape user-supplied input to prevent ReDoS
    const escapedCatId = catId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const catFilter = { $regex: new RegExp(`^${escapedCatId}$`, 'i') };

    const [jobs, services, freelancers, jobCount, serviceCount] = await Promise.all([
      // Latest 6 open jobs in this category
      Job.find({ category: catFilter, status: 'open', isActive: true })
        .sort({ createdAt: -1 })
        .limit(6)
        .select('title budget status createdAt views proposalCount location')
        .lean(),

      // Top 6 active services by rating
      Service.find({ category: catFilter, status: 'active', isActive: true })
        .sort({ rating: -1, totalReviews: -1 })
        .limit(6)
        .select('title pricing rating totalReviews gallery freelancer')
        .populate('freelancer', 'firstName lastName profilePicture location')
        .lean(),

      // Top 6 freelancers who have skills or services in this category
      User.find({
        isActive: true,
        'modes.freelancer': true,
        $or: [
          { skills: { $regex: new RegExp(escapedCatId.replace(/_/g, '\\.'), 'i') } },
          { 'profile.title': { $regex: new RegExp(escapedCatId.replace(/_/g, ' '), 'i') } },
        ]
      })
        .sort({ rating: -1 })
        .limit(6)
        .select('firstName lastName profilePicture rating totalJobs skills location badges')
        .lean(),

      Job.countDocuments({ category: catFilter, isActive: true }),
      Service.countDocuments({ category: catFilter, isActive: true, status: 'active' }),
    ]);

    res.json({
      category: category || { id: catId, label: catId.replace(/_/g, ' '), icon: '📋' },
      stats: { jobCount, serviceCount },
      jobs,
      services,
      freelancers,
    });
  } catch (err) {
    console.error('Category overview error:', err);
    res.status(500).json({ error: 'Failed to load category overview' });
  }
});

module.exports = router;
