const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const User = require('../models/User');

router.get('/suggestions', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = [];
    const regex = new RegExp(query, 'i');

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

    const locations = await Job.distinct('location', {
      location: regex,
      isActive: true,
      status: 'open'
    });
    locations.slice(0, 2).forEach(location => {
      suggestions.push({ text: location, type: 'location' });
    });

    res.json({ suggestions: suggestions.slice(0, 10) });
  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

module.exports = router;
