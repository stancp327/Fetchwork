const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const {
      name,
      bio,
      skills,
      hourlyRate,
      location,
      phone,
      website,
      workHistory,
      portfolio,
      profilePicture
    } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (bio) user.bio = bio;
    if (skills) user.skills = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim());
    if (hourlyRate) user.hourlyRate = hourlyRate;
    if (location) user.location = location;
    if (phone) user.phone = phone;
    if (website) user.website = website;
    if (workHistory) user.workHistory = workHistory;
    if (portfolio) user.portfolio = portfolio;
    if (profilePicture) user.profilePicture = profilePicture;

    await user.save();

    const updatedUser = await User.findById(req.user.id).select('-password');
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password -email -phone');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
