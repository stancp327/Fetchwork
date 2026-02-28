const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');
const emailService  = require('../services/emailService');
const { authenticateToken } = require('../middleware/auth');
const User    = require('../models/User');
const Job     = require('../models/Job');
const Payment = require('../models/Payment');

// ── Helper: calculate platform fee ─────────────────────────────
function calcPlatformFee(amount) {
  // 10% remote commission — will be plan-aware once monetization is built
  return Math.round(amount * 0.10 * 100) / 100;
}

// ── GET /api/payments/status ────────────────────────────────────
// Returns freelancer's Stripe Connect account status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('stripeAccountId');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.stripeAccountId) {
      return res.json({ connected: false, chargesEnabled: false, payoutsEnabled: false });
    }

    const account = await stripeService.getAccountStatus(user.stripeAccountId);
    res.json({
      connected:      true,
      accountId:      account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements:   account.requirements
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

// ── POST /api/payments/connect-account ─────────────────────────
// Creates or resumes a Stripe Connect Express onboarding session
router.post('/connect-account', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('email stripeAccountId firstName lastName');
    if (!user) return res.status(404).json({ error: 'User not found' });

    let accountId = user.stripeAccountId;

    // Create account if doesn't exist yet
    if (!accountId) {
      const account = await stripeService.createConnectAccount(user.email);
      accountId = account.id;
      await User.findByIdAndUpdate(req.user.userId, { stripeAccountId: accountId });
    }

    // Create onboarding link
    const baseUrl    = process.env.CLIENT_URL || 'https://www.fetchwork.net';
    const accountLink = await stripeService.createAccountLink(
      accountId,
      `${baseUrl}/profile?stripe=refresh`,  // refresh URL (expired link)
      `${baseUrl}/profile?stripe=success`   // return URL (completed)
    );

    res.json({ accountId, onboardingUrl: accountLink.url });
  } catch (error) {
    console.error('Error creating connected account:', error);
    res.status(500).json({ error: 'Failed to start Stripe onboarding' });
  }
});

// ── GET /api/payments/history ───────────────────────────────────
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query = {
      $or: [{ client: req.user.userId }, { freelancer: req.user.userId }]
    };

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('job', 'title')
        .populate('client', 'firstName lastName')
        .populate('freelancer', 'firstName lastName'),
      Payment.countDocuments(query)
    ]);

    res.json({ payments, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// ── POST /api/payments/fund-escrow ─────────────────────────────
// Client funds escrow when accepting a proposal.
// Creates a manual-capture PaymentIntent — money is held but not charged yet.
router.post('/fund-escrow', authenticateToken, async (req, res) => {
  try {
    const { jobId, amount } = req.body;
    if (!jobId || !amount) {
      return res.status(400).json({ error: 'jobId and amount are required' });
    }

    const job = await Job.findById(jobId).populate('freelancer');
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.client) !== String(req.user.userId)) {
      return res.status(403).json({ error: 'Only the client can fund escrow' });
    }
    if (job.escrowAmount > 0) {
      return res.status(400).json({ error: 'Secure Payment already active for this job' });
    }

    const platformFee = calcPlatformFee(amount);

    // Create manual-capture PaymentIntent (hold funds, don't charge yet)
    const paymentIntent = await stripeService.holdFundsInEscrow(amount, 'usd', {
      jobId:     jobId,
      clientId:  String(req.user.userId),
      freelancerId: String(job.freelancer?._id || job.freelancer),
      platformFee: String(platformFee)
    });

    // Record in Payment model
    const payment = await Payment.create({
      job:           jobId,
      client:        req.user.userId,
      freelancer:    job.freelancer?._id || job.freelancer,
      amount:        amount,
      type:          'escrow',
      status:        'processing',
      paymentMethod: 'stripe',
      stripePaymentIntentId: paymentIntent.id,
      transactionId: paymentIntent.id,
      platformFee:   platformFee
    });

    // Update job escrow amount
    await Job.findByIdAndUpdate(jobId, {
      escrowAmount: amount,
      stripePaymentIntentId: paymentIntent.id
    });

    // Notify freelancer
    if (job.freelancer) {
      const emailWorkflowService = require('../services/emailWorkflowService');
      const freelancerId = job.freelancer?._id || job.freelancer;
      if (await emailWorkflowService.canSendEmail(freelancerId, 'payment', 'escrow_funded')) {
        const freelancer = await User.findById(freelancerId);
        if (freelancer) {
          await emailService.sendPaymentNotification(freelancer, {
            type: 'escrow_funded', amount, job
          });
        }
      }
    }

    res.json({
      message:         'Secure Payment active — funds held until you approve the work',
      paymentIntentId: paymentIntent.id,
      clientSecret:    paymentIntent.client_secret,
      paymentId:       payment._id
    });
  } catch (error) {
    console.error('Error funding escrow:', error);
    res.status(500).json({ error: 'Failed to fund escrow' });
  }
});

// ── POST /api/payments/release-escrow ──────────────────────────
// Client releases escrow on job completion.
// Captures the PaymentIntent and transfers net amount to freelancer.
router.post('/release-escrow', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ error: 'jobId is required' });

    const job = await Job.findById(jobId).populate('freelancer');
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.client) !== String(req.user.userId)) {
      return res.status(403).json({ error: 'Only the client can release escrow' });
    }
    if (!job.stripePaymentIntentId) {
      return res.status(400).json({ error: 'No Secure Payment found for this job' });
    }

    // Find the escrow Payment record
    const escrowPayment = await Payment.findOne({
      job: jobId,
      type: 'escrow',
      stripePaymentIntentId: job.stripePaymentIntentId
    });

    // Look up freelancer's Stripe account
    const freelancer = await User.findById(job.freelancer?._id || job.freelancer)
      .select('stripeAccountId email firstName lastName');
    if (!freelancer?.stripeAccountId) {
      return res.status(400).json({
        error: 'Freelancer has not set up their payment account yet. Ask them to connect Stripe in their profile.'
      });
    }

    const amount      = job.escrowAmount;
    const platformFee = escrowPayment?.platformFee || calcPlatformFee(amount);
    const payoutAmt   = amount - platformFee;

    // 1. Capture the PaymentIntent (charge the client's card)
    await stripeService.releaseFundsFromEscrow(job.stripePaymentIntentId);

    // 2. Transfer net amount to freelancer's Connect account
    const transfer = await stripeService.createTransfer(payoutAmt, freelancer.stripeAccountId);

    // 3. Update Payment record
    if (escrowPayment) {
      escrowPayment.status = 'completed';
      await escrowPayment.save();
    }

    // 4. Create a 'release' Payment record
    await Payment.create({
      job:           jobId,
      client:        req.user.userId,
      freelancer:    freelancer._id,
      amount:        payoutAmt,
      type:          'release',
      status:        'completed',
      paymentMethod: 'stripe',
      transactionId: transfer.id,
      platformFee:   platformFee
    });

    // 5. Update job
    await Job.findByIdAndUpdate(jobId, {
      escrowAmount: 0,
      totalPaid:    (job.totalPaid || 0) + payoutAmt,
      status:       'completed'
    });

    // 6. Notify freelancer
    const emailWorkflowService = require('../services/emailWorkflowService');
    if (await emailWorkflowService.canSendEmail(freelancer._id, 'payment', 'payment_released')) {
      await emailService.sendPaymentNotification(freelancer, {
        type: 'payment_released', amount: payoutAmt, job
      });
    }

    res.json({
      message:    'Payment released to freelancer',
      payoutAmt,
      platformFee,
      transferId: transfer.id
    });
  } catch (error) {
    console.error('Error releasing escrow:', error);
    res.status(500).json({ error: 'Failed to release escrow' });
  }
});

// ── Webhook handler (mounted in index.js before express.json) ──
router.webhookHandler = async (req, res) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });

  let event;
  try {
    event = stripeService.constructWebhookEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    switch (event.type) {

      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { status: 'completed' }
        );
        console.log('✅ payment_intent.succeeded:', pi.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { status: 'failed' }
        );
        // TODO: notify client of failed payment
        console.log('❌ payment_intent.payment_failed:', pi.id);
        break;
      }

      case 'account.updated': {
        // Freelancer updated their Connect account
        const account = event.data.object;
        if (account.id) {
          await User.findOneAndUpdate(
            { stripeAccountId: account.id },
            {
              'stripeConnected': account.charges_enabled && account.payouts_enabled
            }
          );
          console.log('🔄 account.updated:', account.id,
            '| charges:', account.charges_enabled,
            '| payouts:', account.payouts_enabled);
        }
        break;
      }

      case 'transfer.created': {
        console.log('💸 transfer.created:', event.data.object.id);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: charge.payment_intent },
          { status: 'failed' }  // mark as refunded/failed
        );
        console.log('↩️ charge.refunded:', charge.id);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

module.exports = router;
