const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/:username', async (req, res) => {
  try {
    const username = String(req.params.username || '').trim().toLowerCase();
    const user = await User.findOne({ username }).lean();
    if (!user) return res.status(404).json({ error: 'Not found' });
    const safe = {
      firstName: user.firstName,
      lastName: user.lastName,
      headline: user.headline || '',
      tagline: user.tagline || '',
      skills: user.skills || [],
      languages: user.languages || [],
      bio: user.bio || '',
      experience: user.experience || [],
      education: user.education || [],
      certifications: user.certifications || [],
      profilePicture: user.profilePicture ? `/${String(user.profilePicture).replace(/^\/+/, '')}` : '',
      bannerUrl: user.bannerUrl ? `/${String(user.bannerUrl).replace(/^\/+/, '')}` : '',
      socialLinks: {
        github: user.socialLinks?.github || '',
        linkedin: user.socialLinks?.linkedin || '',
        portfolio: user.socialLinks?.portfolio || '',
        twitter: user.socialLinks?.twitter || '',
        behance: user.socialLinksExtended?.behance || '',
        dribbble: user.socialLinksExtended?.dribbble || ''
      },
      portfolio: Array.isArray(user.portfolio) ? user.portfolio.map(p => ({
        title: p.title,
        description: p.description,
        mediaUrls: (p.mediaUrls || []).map(u => (String(u).startsWith('/') ? u : `/${u}`)),
        mediaType: p.mediaType,
        links: p.links || [],
        watermarked: !!p.watermarked
      })) : [],
      rating: user.rating || 0,
      totalReviews: user.totalReviews || 0,
      completedJobs: user.completedJobs || 0,
      badges: user.badges || [],
      username: user.username
    };
    return res.json(safe);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load profile' });
  }
});

module.exports = router;
