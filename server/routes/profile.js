const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.userId = user.userId;
    next();
  });
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        userType: user.userType,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, bio, skills, location, hourlyRate, experience, profilePicture } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (firstName !== undefined) user.profile.firstName = firstName;
    if (lastName !== undefined) user.profile.lastName = lastName;
    if (bio !== undefined) user.profile.bio = bio;
    if (location !== undefined) user.profile.location = location;
    if (profilePicture !== undefined) user.profile.profilePicture = profilePicture;

    if (skills !== undefined) {
      if (typeof skills === 'string') {
        user.profile.skills = skills.split(',').map(skill => skill.trim()).filter(skill => skill.length > 0);
      } else if (Array.isArray(skills)) {
        user.profile.skills = skills;
      }
    }

    if (user.userType === 'freelancer') {
      if (hourlyRate !== undefined) user.profile.hourlyRate = hourlyRate;
      if (experience !== undefined) user.profile.experience = experience;
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        userType: user.userType,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/upload-picture', authenticateToken, async (req, res) => {
  try {
    res.status(501).json({ message: 'Profile picture upload not yet implemented' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
