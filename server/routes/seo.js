const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const User = require('../models/User');
const Service = require('../models/Service');

const SITE_URL = process.env.CLIENT_URL || 'https://fetchwork.net';

// robots.txt
router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /settings
Disallow: /api/
Disallow: /messages

Sitemap: ${SITE_URL}/sitemap.xml
`);
});

// sitemap.xml
router.get('/sitemap.xml', async (req, res) => {
  try {
    const now = new Date().toISOString();

    // Static pages
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/browse-jobs', priority: '0.9', changefreq: 'hourly' },
      { url: '/browse-services', priority: '0.9', changefreq: 'hourly' },
      { url: '/login', priority: '0.5', changefreq: 'monthly' },
      { url: '/register', priority: '0.6', changefreq: 'monthly' },
    ];

    // Active jobs (open, not expired)
    const jobs = await Job.find({
      status: 'open', isActive: true, expiresAt: { $gt: new Date() }
    }).select('_id updatedAt').sort({ updatedAt: -1 }).limit(500);

    // Active freelancers with public profiles
    const freelancers = await User.find({
      accountType: { $in: ['freelancer', 'both'] },
      isActive: true,
      'privacySettings.profileVisibility': { $ne: 'private' }
    }).select('_id updatedAt').sort({ updatedAt: -1 }).limit(500);

    // Active services
    const services = await Service.find({ isActive: true })
      .select('_id updatedAt').sort({ updatedAt: -1 }).limit(500);

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
