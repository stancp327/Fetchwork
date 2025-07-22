const express = require('express');
const User = require('../models/User');
const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const { 
      search, 
      skills, 
      location, 
      userType = 'freelancer',
      minRate,
      maxRate,
      page = 1, 
      limit = 10 
    } = req.query;

    const query = { userType };

    if (search) {
      query.$or = [
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } },
        { 'profile.bio': { $regex: search, $options: 'i' } },
        { 'profile.title': { $regex: search, $options: 'i' } }
      ];
    }

    if (skills) {
      const skillsArray = skills.split(',').map(skill => skill.trim());
      query['profile.skills'] = { $in: skillsArray.map(skill => new RegExp(skill, 'i')) };
    }

    if (location) {
      query['profile.location'] = { $regex: location, $options: 'i' };
    }

    if (minRate || maxRate) {
      query['profile.hourlyRate'] = {};
      if (minRate) query['profile.hourlyRate'].$gte = parseFloat(minRate);
      if (maxRate) query['profile.hourlyRate'].$lte = parseFloat(maxRate);
    }

    const users = await User.find(query)
      .select('email userType profile.firstName profile.lastName profile.bio profile.skills profile.hourlyRate profile.location profile.title profile.avatar')
      .sort({ 'profile.hourlyRate': -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('email userType profile createdAt');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
