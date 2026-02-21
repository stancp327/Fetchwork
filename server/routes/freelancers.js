const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { validateQueryParams } = require('../middleware/validation');
const { geocode, nearSphereQuery } = require('../config/geocoding');

router.get('/', validateQueryParams, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    
    const filters = {
      isActive: true,
      isSuspended: false,
      $or: [
        { accountType: 'freelancer' },
        { accountType: 'both' }
      ]
    };
    
    if (req.query.skills) {
      const skills = req.query.skills.split(',').map(skill => skill.trim());
      filters.skills = { $in: skills.map(skill => new RegExp(skill, 'i')) };
    }
    
    if (req.query.location) {
      const locQuery = req.query.location;
      filters.$or = filters.$or || [];
      filters.$or.push(
        { 'location.address': { $regex: locQuery, $options: 'i' } },
        { 'location.city': { $regex: locQuery, $options: 'i' } },
        { 'location.state': { $regex: locQuery, $options: 'i' } },
        { 'location.zipCode': { $regex: locQuery, $options: 'i' } }
      );
    }

    // Distance-based search: ?near=94520&radius=25
    if (req.query.near && req.query.near.trim() !== '') {
      const radius = parseInt(req.query.radius) || 25;
      const coords = await geocode(req.query.near.trim());
      if (coords) {
        filters['location.coordinates'] = nearSphereQuery(coords, radius);
      }
    }
    
    if (req.query.minRate || req.query.maxRate) {
      filters.hourlyRate = {};
      if (req.query.minRate) {
        filters.hourlyRate.$gte = parseFloat(req.query.minRate);
      }
      if (req.query.maxRate) {
        filters.hourlyRate.$lte = parseFloat(req.query.maxRate);
      }
    }
    
    if (req.query.rating && req.query.rating !== 'all') {
      filters.rating = { $gte: parseFloat(req.query.rating) };
    }
    
    if (req.query.search) {
      const searchTerms = req.query.search.split(' ').filter(term => term.length > 0);
      filters.$and = filters.$and || [];
      
      searchTerms.forEach(term => {
        filters.$and.push({
          $or: [
            { firstName: { $regex: term, $options: 'i' } },
            { lastName: { $regex: term, $options: 'i' } },
            { bio: { $regex: term, $options: 'i' } },
            { skills: { $in: [new RegExp(term, 'i')] } }
          ]
        });
      });
    }
    
    let sortOptions = { rating: -1, totalReviews: -1 };
    if (req.query.sortBy) {
      switch (req.query.sortBy) {
        case 'rate_low':
          sortOptions = { hourlyRate: 1 };
          break;
        case 'rate_high':
          sortOptions = { hourlyRate: -1 };
          break;
        case 'experience':
          sortOptions = { completedJobs: -1 };
          break;
        case 'earnings':
          sortOptions = { totalEarnings: -1 };
          break;
        case 'newest':
          sortOptions = { createdAt: -1 };
          break;
        default:
          sortOptions = { rating: -1, totalReviews: -1 };
      }
    }
    
    const freelancers = await User.find(filters)
      .select('-password -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires -bankAccount -paypalEmail -stripeAccountId')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(filters);
    
    res.json({
      freelancers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching freelancers:', error);
    res.status(500).json({ error: 'Failed to fetch freelancers' });
  }
});

module.exports = router;
