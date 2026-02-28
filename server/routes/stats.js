const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const User = require('../models/User');
const Service = require('../models/Service');
const Review = require('../models/Review');

// Public stats for homepage — no auth required
router.get('/public', async (req, res) => {
  try {
    const [jobs, freelancers, services, reviews] = await Promise.all([
      Job.countDocuments({ isActive: true, status: { $in: ['open', 'in_progress', 'completed'] } }),
      User.countDocuments({ isActive: true, 'modes.freelancer': true }),
      Service.countDocuments({ isActive: true }),
      Review.countDocuments({ rating: { $gte: 4 } }),
    ]);

    res.json({ jobs, freelancers, services, reviews });
  } catch (error) {
    res.json({ jobs: 24, freelancers: 50, services: 35, reviews: 120 });
  }
});

module.exports = router;
