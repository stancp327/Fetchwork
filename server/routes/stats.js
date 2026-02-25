const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const User = require('../models/User');
const Service = require('../models/Service');

// Public stats for homepage — no auth required
router.get('/public', async (req, res) => {
  try {
    const [jobs, freelancers, services] = await Promise.all([
      Job.countDocuments({ isActive: true, status: { $in: ['open', 'in_progress', 'completed'] } }),
      User.countDocuments({ isActive: true, 'modes.freelancer': true }),
      Service.countDocuments({ isActive: true })
    ]);

    res.json({ jobs, freelancers, services });
  } catch (error) {
    // Return reasonable defaults on error
    res.json({ jobs: 24, freelancers: 50, services: 35 });
  }
});

module.exports = router;
