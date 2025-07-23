const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Job = require('../models/Job');
const User = require('../models/User');
const stripeService = require('../services/stripeService');
const { authenticateToken } = require('../middleware/auth');

router.get('/account-status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user.stripeAccountId) {
      return res.json({ connected: false });
    }

    const account = await stripeService.getAccountStatus(user.stripeAccountId);
    
    res.json({
      connected: true,
      accountId: user.stripeAccountId,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled
    });
  } catch (error) {
    console.error('Error fetching account status:', error);
    res.status(500).json({ error: 'Failed to fetch account status' });
  }
});

router.get('/my-payments', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type || 'all';

    let query = {
      $or: [
        { client: req.user.userId },
        { freelancer: req.user.userId }
      ]
    };

    if (type !== 'all') {
      query.type = type;
    }

    const payments = await Payment.find(query)
      .populate('job', 'title')
      .populate('client', 'firstName lastName')
      .populate('freelancer', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.json({
      payments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

router.post('/connect-account', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (user.stripeAccountId) {
      return res.status(400).json({ error: 'Stripe account already connected' });
    }

    const account = await stripeService.createConnectedAccount(user);
    user.stripeAccountId = account.id;
    await user.save();

    const clientUrl = process.env.NODE_ENV === 'production' 
      ? 'https://fetchwork-dusky.vercel.app' 
      : 'http://localhost:3000';

    const accountLink = await stripeService.createAccountLink(
      account.id,
      `${clientUrl}/payments/connect/refresh`,
      `${clientUrl}/payments/connect/success`
    );

    res.json({ accountLink: accountLink.url });
  } catch (error) {
    console.error('Error creating connected account:', error);
    res.status(500).json({ error: 'Failed to create connected account' });
  }
});

router.post('/jobs/:jobId/fund-escrow', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId).populate('freelancer');
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.client.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (job.status !== 'in_progress') {
      return res.status(400).json({ error: 'Job must be in progress to fund escrow' });
    }

    const existingEscrow = await Payment.findOne({
      job: job._id,
      type: 'escrow',
      status: { $in: ['pending', 'completed'] }
    });

    if (existingEscrow) {
      return res.status(400).json({ error: 'Escrow already funded for this job' });
    }

    const paymentIntent = await stripeService.createEscrowPayment(
      job.budget.amount,
      job.client,
      job.freelancer._id,
      job._id
    );

    const payment = new Payment({
      job: job._id,
      client: job.client,
      freelancer: job.freelancer._id,
      amount: job.budget.amount,
      type: 'escrow',
      paymentMethod: 'stripe',
      stripePaymentIntentId: paymentIntent.id,
      description: `Escrow funding for job: ${job.title}`
    });

    payment.calculateFees();
    await payment.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      payment
    });
  } catch (error) {
    console.error('Error funding escrow:', error);
    res.status(500).json({ error: 'Failed to fund escrow' });
  }
});

router.post('/jobs/:jobId/release-escrow', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId).populate('freelancer');
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.client.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Job must be completed to release escrow' });
    }

    const escrowPayment = await Payment.findOne({
      job: job._id,
      type: 'escrow',
      status: 'completed'
    });

    if (!escrowPayment) {
      return res.status(404).json({ error: 'No escrow payment found' });
    }

    if (!job.freelancer.stripeAccountId) {
      return res.status(400).json({ error: 'Freelancer must connect Stripe account first' });
    }

    await stripeService.releaseEscrowPayment(
      escrowPayment.stripePaymentIntentId,
      job.freelancer.stripeAccountId
    );

    const releasePayment = new Payment({
      job: job._id,
      client: job.client,
      freelancer: job.freelancer._id,
      amount: escrowPayment.netAmount,
      type: 'release',
      paymentMethod: 'stripe',
      description: `Payment release for job: ${job.title}`
    });

    await releasePayment.completePayment();
    
    job.totalPaid += releasePayment.amount;
    job.escrowAmount = 0; // Clear escrow amount
    await job.save();

    res.json({
      message: 'Escrow payment released successfully',
      payment: releasePayment
    });
  } catch (error) {
    console.error('Error releasing escrow:', error);
    res.status(500).json({ error: 'Failed to release escrow payment' });
  }
});

router.post('/jobs/:jobId/milestones/:milestoneId/fund', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    const milestone = job.milestones.id(req.params.milestoneId);
    
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (job.client.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const existingPayment = await Payment.findOne({
      job: job._id,
      milestone: milestone._id,
      type: 'escrow',
      status: { $in: ['pending', 'completed'] }
    });

    if (existingPayment) {
      return res.status(400).json({ error: 'Milestone already funded' });
    }

    const paymentIntent = await stripeService.createEscrowPayment(
      milestone.amount,
      job.client,
      job.freelancer,
      job._id
    );

    const payment = new Payment({
      job: job._id,
      client: job.client,
      freelancer: job.freelancer,
      amount: milestone.amount,
      type: 'escrow',
      paymentMethod: 'stripe',
      stripePaymentIntentId: paymentIntent.id,
      milestone: milestone._id,
      description: `Milestone funding: ${milestone.title}`
    });

    payment.calculateFees();
    await payment.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      payment
    });
  } catch (error) {
    console.error('Error funding milestone:', error);
    res.status(500).json({ error: 'Failed to fund milestone' });
  }
});

router.post('/jobs/:jobId/milestones/:milestoneId/release', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId).populate('freelancer');
    const milestone = job.milestones.id(req.params.milestoneId);
    
    if (!milestone || milestone.status !== 'approved') {
      return res.status(400).json({ error: 'Milestone must be approved first' });
    }

    if (job.client.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const escrowPayment = await Payment.findOne({
      job: job._id,
      milestone: milestone._id,
      type: 'escrow',
      status: 'completed'
    });

    if (!escrowPayment) {
      return res.status(404).json({ error: 'No escrow payment found for milestone' });
    }

    if (!job.freelancer.stripeAccountId) {
      return res.status(400).json({ error: 'Freelancer must connect Stripe account first' });
    }

    await stripeService.releaseEscrowPayment(
      escrowPayment.stripePaymentIntentId,
      job.freelancer.stripeAccountId
    );

    const releasePayment = new Payment({
      job: job._id,
      client: job.client,
      freelancer: job.freelancer._id,
      amount: escrowPayment.netAmount,
      type: 'release',
      paymentMethod: 'stripe',
      milestone: milestone._id,
      description: `Milestone payment: ${milestone.title}`
    });

    await releasePayment.completePayment();
    
    job.totalPaid += releasePayment.amount;
    await job.save();

    res.json({
      message: 'Milestone payment released successfully',
      payment: releasePayment
    });
  } catch (error) {
    console.error('Error releasing milestone payment:', error);
    res.status(500).json({ error: 'Failed to release milestone payment' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeService.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: paymentIntent.id },
          { status: 'completed' }
        );
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: failedPayment.id },
          { status: 'failed' }
        );
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
