const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const User = require('../models/User');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.post('/test', requireAdmin, async (req, res) => {
  try {
    const { email, type = 'welcome' } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let result;
    switch (type) {
      case 'welcome':
        result = await emailService.sendWelcomeEmail(user);
        break;
      case 'verification':
        result = await emailService.sendEmailVerification(user, 'test-token');
        break;
      case 'password-reset':
        result = await emailService.sendPasswordResetEmail(user, 'test-token');
        break;
      default:
        return res.status(400).json({ error: 'Invalid email type' });
    }

    if (result.success) {
      res.json({ message: 'Test email sent successfully', data: result.data });
    } else {
      res.status(500).json({ error: 'Failed to send test email', details: result.error });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

router.post('/broadcast', requireAdmin, async (req, res) => {
  try {
    const { subject, message, userType = 'all' } = req.body;
    
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    let query = {};
    if (userType === 'freelancers') {
      query.role = 'freelancer';
    } else if (userType === 'clients') {
      query.role = 'client';
    }

    const users = await User.find(query, 'email');
    const recipients = users.map(user => user.email);

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients found' });
    }

    const result = await emailService.sendAdminBroadcast(recipients, subject, message);

    if (result.success) {
      res.json({
        message: 'Broadcast sent successfully',
        sent: result.sent,
        failed: result.failed,
        total: result.total
      });
    } else {
      res.status(500).json({ error: 'Failed to send broadcast', details: result.error });
    }
  } catch (error) {
    console.error('Error sending broadcast email:', error);
    res.status(500).json({ error: 'Failed to send broadcast email' });
  }
});

router.get('/status', requireAdmin, async (req, res) => {
  try {
    const hasApiKey = !!process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || 'noreply@fetchwork.com';
    
    res.json({
      configured: hasApiKey,
      fromEmail,
      service: 'Resend'
    });
  } catch (error) {
    console.error('Error getting email service status:', error);
    res.status(500).json({ error: 'Failed to get email service status' });
  }
});

module.exports = router;
