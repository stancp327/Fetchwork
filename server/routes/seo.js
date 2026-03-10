const express = require('express');
const router = express.Router();
const SeoPage = require('../models/SeoPage');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');

// Default pages seeded if none exist
const DEFAULT_PAGES = [
  { path: '/',            label: 'Home',                title: 'Fetchwork — Find Local Freelancers & Jobs', description: 'Find local freelancers and jobs near you. Fetchwork connects skilled professionals with clients for both remote and local projects.' },
  { path: '/jobs',        label: 'Browse Jobs',         title: 'Browse Freelance Jobs | Fetchwork',          description: 'Find your next freelance project on Fetchwork. Browse hundreds of local and remote jobs.' },
  { path: '/services',    label: 'Browse Services',     title: 'Browse Services | Fetchwork',                description: 'Find ready-made freelance services. Hire skilled professionals for any task.' },
  { path: '/freelancers', label: 'Discover Freelancers',title: 'Discover Freelancers | Fetchwork',           description: 'Find skilled freelancers for your project. Browse profiles, ratings, and reviews.' },
  { path: '/search',      label: 'Search',              title: 'Search | Fetchwork',                         description: 'Search jobs, services, and freelancers on Fetchwork.' },
  { path: '/contact',     label: 'Contact Us',          title: 'Contact Us | Fetchwork',                     description: 'Get in touch with the Fetchwork team.' },
  { path: '/support',     label: 'Support',             title: 'Support | Fetchwork',                        description: 'Get help with your Fetchwork account.' },
  { path: '/agencies',    label: 'Agency Directory',    title: 'Agency Directory | Fetchwork',               description: 'Browse professional agencies and teams on Fetchwork.' },
];

// ── Public: GET /api/seo/pages — returns all enabled pages + global flag
router.get('/pages', async (req, res) => {
  try {
    const pages = await SeoPage.find({}).lean();

    // Auto-seed defaults if DB is empty
    if (pages.length === 0) {
      const toInsert = [
        { path: '__global__', label: 'Global Toggle', noIndex: false, enabled: true },
        ...DEFAULT_PAGES,
      ];
      await SeoPage.insertMany(toInsert, { ordered: false }).catch(() => {});
      const seeded = await SeoPage.find({}).lean();
      return res.json({ pages: seeded });
    }

    res.json({ pages });
  } catch (err) {
    console.error('[seo:pages]', err.message);
    res.status(500).json({ error: 'Failed to load SEO pages' });
  }
});

// ── Admin: GET /api/seo/admin/pages — same but always returns all
router.get('/admin/pages', authenticateAdmin, async (req, res) => {
  try {
    let pages = await SeoPage.find({}).lean();

    if (pages.length === 0) {
      const toInsert = [
        { path: '__global__', label: 'Global Toggle', noIndex: false, enabled: true },
        ...DEFAULT_PAGES,
      ];
      await SeoPage.insertMany(toInsert, { ordered: false }).catch(() => {});
      pages = await SeoPage.find({}).lean();
    }

    res.json({ pages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load SEO pages' });
  }
});

// ── Admin: PUT /api/seo/admin/pages/:path — upsert a page's SEO
router.put('/admin/pages/:pagePath(*)', authenticateAdmin, async (req, res) => {
  try {
    const path = decodeURIComponent(req.params.pagePath);
    const { title, description, keywords, ogImage, noIndex, enabled, label } = req.body;

    const updated = await SeoPage.findOneAndUpdate(
      { path },
      { $set: { title, description, keywords, ogImage, noIndex, enabled, ...(label ? { label } : {}) } },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ page: updated });
  } catch (err) {
    console.error('[seo:put]', err.message);
    res.status(500).json({ error: 'Failed to update SEO page' });
  }
});

// ── Admin: POST /api/seo/admin/global-toggle — flip global enabled flag
router.post('/admin/global-toggle', authenticateAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    const updated = await SeoPage.findOneAndUpdate(
      { path: '__global__' },
      { $set: { enabled } },
      { upsert: true, new: true }
    );
    res.json({ enabled: updated.enabled });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle SEO' });
  }
});

module.exports = router;
