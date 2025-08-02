const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('preferences');
    res.json({ preferences: user.preferences });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

router.put('/', authenticateToken, async (req, res) => {
  try {
    const { preferences } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { preferences },
      { new: true, runValidators: true }
    ).select('preferences');
    
    res.json({ 
      message: 'Preferences updated successfully',
      preferences: user.preferences 
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    const { email, type = 'all' } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (type === 'all') {
      user.preferences.emailNotifications = {
        jobAlerts: false,
        proposalUpdates: false,
        paymentNotifications: true,
        systemUpdates: false,
        marketingEmails: false,
        weeklyDigest: false
      };
    } else {
      user.preferences.emailNotifications[type] = false;
    }

    await user.save();
    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

module.exports = router;
