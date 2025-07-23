const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');
const { authenticateToken } = require('../middleware/auth');

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const result = await stripeService.getAccountStatus(req.user.userId);
    
    if (result.success) {
      res.json({
        connected: result.connected,
        accountId: result.accountId,
        chargesEnabled: result.chargesEnabled,
        payoutsEnabled: result.payoutsEnabled
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await stripeService.getPaymentHistory(req.user.userId, page, limit);
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

router.post('/connect-account', authenticateToken, async (req, res) => {
  try {
    const result = await stripeService.createConnectedAccount(req.user.userId);
    
    if (result.success) {
      res.json({
        accountId: result.accountId,
        onboardingUrl: result.onboardingUrl
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error creating connected account:', error);
    res.status(500).json({ error: 'Failed to create connected account' });
  }
});

router.post('/fund-escrow', authenticateToken, async (req, res) => {
  try {
    const { jobId, amount } = req.body;
    
    if (!jobId || !amount) {
      return res.status(400).json({ error: 'Job ID and amount are required' });
    }
    
    const result = await stripeService.fundEscrow(jobId, amount, req.user.userId);
    
    if (result.success) {
      const User = require('../models/User');
      const Job = require('../models/Job');
      
      const job = await Job.findById(jobId).populate('freelancer');
      const client = await User.findById(req.user.userId);
      
      if (job && job.freelancer && client) {
        await emailService.sendPaymentNotification(job.freelancer, {
          type: 'escrow_funded',
          amount: amount,
          job: job
        });
      }
      
      res.json({
        message: 'Escrow funded successfully',
        paymentIntent: result.paymentIntent
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error funding escrow:', error);
    res.status(500).json({ error: 'Failed to fund escrow' });
  }
});

router.post('/release-escrow', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }
    
    const result = await stripeService.releaseEscrow(jobId, req.user.userId);
    
    if (result.success) {
      const User = require('../models/User');
      const Job = require('../models/Job');
      
      const job = await Job.findById(jobId).populate('freelancer');
      
      if (job && job.freelancer) {
        await emailService.sendPaymentNotification(job.freelancer, {
          type: 'payment_released',
          amount: result.transfer.amount / 100,
          job: job
        });
      }
      
      res.json({
        message: 'Escrow released successfully',
        transfer: result.transfer
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error releasing escrow:', error);
    res.status(500).json({ error: 'Failed to release escrow' });
  }
});

router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    const result = await stripeService.handleWebhook(req.body, req.headers['stripe-signature']);
    
    if (result.success) {
      res.json({ received: true });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

module.exports = router;
