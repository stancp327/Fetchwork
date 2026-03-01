const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const User = require('../models/User');
const Service = require('../models/Service');

const SITE_URL = process.env.CLIENT_URL || 'https://fetchwork.net';

// robots.txt — server-side version (takes precedence over static public/robots.txt in prod)
router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *
Allow: /
Allow: /jobs
Allow: /services
Allow: /freelancers
Allow: /categories
Allow: /pricing

Disallow: /dashboard
Disallow: /messages
Disallow: /projects
Disallow: /profile
Disallow: /settings
Disallow: /admin
Disallow: /billing
Disallow: /wallet
Disallow: /payments
Disallow: /disputes
Disallow: /bookings
Disallow: /post-job
Disallow: /offers
Disallow: /availability
Disallow: /calendar-connect
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`);
});

const CATEGORIES = [
  'web-development', 'mobile-development', 'design', 'writing',
  'marketing', 'video-editing', 'photography', 'music',
  'business', 'finance', 'legal', 'engineering',
  'home-services', 'cleaning', 'moving', 'tutoring', 'fitness',
];

// sitemap.xml
router.get('/sitemap.xml', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=3600');
    const now = new Date().toISOString();

    // Static pages
    const staticPages = [
      { url: '/',            priority: '1.0', changefreq: 'daily'   },
      { url: '/jobs',        priority: '0.9', changefreq: 'hourly'  },
      { url: '/services',    priority: '0.9', changefreq: 'hourly'  },
      { url: '/freelancers', priority: '0.8', changefreq: 'daily'   },
      { url: '/pricing',     priority: '0.7', changefreq: 'monthly' },
      { url: '/register',    priority: '0.6', changefreq: 'monthly' },
    ];

    // Category pages
    CATEGORIES.forEach(slug => {
      staticPages.push({ url: `/categories/${slug}`, priority: '0.6', changefreq: 'weekly' });
    });

    // Active jobs (open, not archived)
    const jobs = await Job.find({
      status: 'open', isActive: true, isArchived: { $ne: true }
    }).select('_id updatedAt').sort({ updatedAt: -1 }).limit(1000);

    // Active freelancers with public profiles
    const freelancers = await User.find({
      accountType: { $in: ['freelancer', 'both'] },
      isActive: true,
      isSuspended: { $ne: true },
    }).select('_id updatedAt').sort({ updatedAt: -1 }).limit(1000);

    // Active services (not archived)
    const services = await Service.find({
      isActive: true, isArchived: { $ne: true }
    }).select('_id updatedAt').sort({ updatedAt: -1 }).limit(1000);

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static
    for (const p of staticPages) {
      xml += `  <url><loc>${SITE_URL}${p.url}</loc><lastmod>${now}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>\n`;
    }

    // Jobs
    for (const j of jobs) {
      xml += `  <url><loc>${SITE_URL}/jobs/${j._id}</loc><lastmod>${j.updatedAt?.toISOString() || now}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>\n`;
    }

    // Freelancers
    for (const f of freelancers) {
      xml += `  <url><loc>${SITE_URL}/freelancers/${f._id}</loc><lastmod>${f.updatedAt?.toISOString() || now}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>\n`;
    }

    // Services
    for (const s of services) {
      xml += `  <url><loc>${SITE_URL}/services/${s._id}</loc><lastmod>${s.updatedAt?.toISOString() || now}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>\n`;
    }

    xml += '</urlset>';
    res.type('application/xml').send(xml);
  } catch (error) {
    console.error('Sitemap error:', error);
    res.status(500).type('text/plain').send('Error generating sitemap');
  }
});

module.exports = router;
