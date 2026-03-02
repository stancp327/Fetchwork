const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');
const emailService         = require('../services/emailService');
const emailWorkflowService = require('../services/emailWorkflowService');
const { authenticateToken } = require('../middleware/auth');
const User    = require('../models/User');
const Job     = require('../models/Job');
const Payment = require('../models/Payment');
const Service = require('../models/Service');
const { Message, Conversation } = require('../models/Message');
const Notification           = require('../models/Notification');
const ProcessedWebhookEvent  = require('../models/ProcessedWebhookEvent');

const { getFee } = require('../services/feeEngine');

// ── Helper: calculate platform fee (plan-aware) ─────────────────
// role: 'client' | 'freelancer'
// jobType derived from job.location.locationType
function resolveJobType(job) {
  const t = job?.location?.locationType;
  return (t === 'remote') ? 'remote' : 'local';
}

async function calcPlatformFee(userId, role, job, amount) {
  try {
    const result = await getFee({ userId, role, jobType: resolveJobType(job), amount });
    return result.fee;
  } catch {
    // Fallback to flat 10% if fee engine errors
    return Math.round(amount * 0.10 * 100) / 100;
  }
}

// ── GET /api/payments/payout-info ────────────────────────────────
// Returns freelancer's payout tier (standard/faster/priority)
router.get('/payout-info', authenticateToken, async (req, res) => {
  try {
    const { getPayoutInfo } = require('../services/payoutScheduler');
    const info = await getPayoutInfo(req.user.userId);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// ── GET /api/payments/verify-intent/:jobId ─────────────────────
// Verifies actual PaymentIntent status from Stripe (used after 3DS redirect).
// Clients must not be trusted to self-report payment success via URL params.
router.get('/verify-intent/:jobId', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId).select('stripePaymentIntentId client escrowAmount');
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.client) !== String(req.user.userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!job.stripePaymentIntentId) {
      return res.json({ status: 'none', funded: false, escrowAmount: 0 });
    }
    const pi = await stripeService.retrievePaymentIntent(job.stripePaymentIntentId);
    res.json({
      status:       pi.status,
      funded:       pi.status === 'succeeded',
      escrowAmount: job.escrowAmount,
    });
  } catch (err) {
    console.error('verify-intent error:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
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

// ── Saved Payment Methods ───────────────────────────────────────
//
// Security notes:
//   - stripeCustomerId is server-only; never returned to frontend
//   - Every PM operation verifies pm.customer === user.stripeCustomerId
//     via stripeService.verifyPMOwnership() (throws if mismatch)
//   - Card data (numbers, CVV) never touches our servers — only
//     Stripe's opaque pm_xxx IDs and brand/last4 for display

/** Helper: get or create Stripe Customer for the requesting user */
async function getOrCreateCustomer(user) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customerId = await stripeService.ensureCustomer(user);
  await User.findByIdAndUpdate(user._id, { stripeCustomerId: customerId });
  user.stripeCustomerId = customerId; // update in-place for this request
  return customerId;
}

// GET /api/payments/methods — list saved cards
router.get('/methods', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.userId);
    if (!user.stripeCustomerId) return res.json({ methods: [] });
    const methods = await stripeService.listPaymentMethods(user.stripeCustomerId);
    res.json({ methods });
  } catch (err) {
    console.error('List payment methods error:', err.message);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// POST /api/payments/methods/setup — create SetupIntent to save a new card
router.post('/methods/setup', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.userId);
    const customerId = await getOrCreateCustomer(user);
    const setupIntent = await stripeService.createSetupIntent(customerId);
    res.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    console.error('SetupIntent error:', err.message);
    res.status(500).json({ error: 'Failed to create setup session' });
  }
});

// POST /api/payments/methods/:pmId/default — set default payment method
router.post('/methods/:pmId/default', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.userId);
    if (!user.stripeCustomerId) return res.status(400).json({ error: 'No payment methods saved' });
    // verifyPMOwnership is called inside setDefaultPaymentMethod
    await stripeService.setDefaultPaymentMethod(req.params.pmId, user.stripeCustomerId);
    res.json({ message: 'Default payment method updated' });
  } catch (err) {
    console.error('Set default PM error:', err.message);
    const status = err.message.includes('does not belong') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

// DELETE /api/payments/methods/:pmId — remove a saved card
router.delete('/methods/:pmId', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.userId);
    if (!user.stripeCustomerId) return res.status(400).json({ error: 'No payment methods on file' });
    // verifyPMOwnership is called inside detachPaymentMethod
    await stripeService.detachPaymentMethod(req.params.pmId, user.stripeCustomerId);
    res.json({ message: 'Payment method removed' });
  } catch (err) {
    console.error('Detach PM error:', err.message);
    const status = err.message.includes('does not belong') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ── POST /api/payments/fund-escrow ─────────────────────────────
// Client funds escrow when accepting a proposal.
// Creates a manual-capture PaymentIntent — money is held but not charged yet.
router.post('/fund-escrow', authenticateToken, async (req, res) => {
  try {
    const { jobId, amount, paymentMethodId } = req.body;
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

    const platformFee = await calcPlatformFee(req.user.userId, 'client', job, amount);
    const metadata = {
      jobId:        String(jobId),
      clientId:     String(req.user.userId),
      freelancerId: String(job.freelancer?._id || job.freelancer),
      platformFee:  String(platformFee),
    };

    let paymentIntent;

    if (paymentMethodId) {
      // ── Saved card path ─────────────────────────────────────────
      // Ownership is verified inside chargeWithSavedMethod via verifyPMOwnership
      const user = await User.findById(req.user.userId || req.user._id);
      if (!user.stripeCustomerId) {
        return res.status(400).json({ error: 'No saved payment methods on file' });
      }
      paymentIntent = await stripeService.chargeWithSavedMethod(
        amount, user.stripeCustomerId, paymentMethodId, metadata
      );
    } else {
      // ── New card path (frontend confirms via PaymentElement) ─────
      paymentIntent = await stripeService.chargeForJob(amount, 'usd', metadata);
    }

    // Record in Payment model.
    // Saved card path: PI is confirmed immediately → 'processing'.
    // New card path: PI needs frontend confirmation → 'pending' until
    // payment_intent.succeeded webhook upgrades it to 'processing'.
    const payment = await Payment.create({
      job:           jobId,
      client:        req.user.userId,
      freelancer:    job.freelancer?._id || job.freelancer,
      amount:        amount,
      type:          'escrow',
      status:        paymentMethodId ? 'processing' : 'pending',
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
      const freelancerId = job.freelancer?._id || job.freelancer;
      if (await emailWorkflowService.canSendEmail(freelancerId, 'payment', 'escrow_funded')) {
        const freelancer = await User.findById(freelancerId);
        if (freelancer) {
          await emailService.sendPaymentNotification(freelancer, { amount, job }, 'escrow_funded');
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
      .select('stripeAccountId email firstName lastName feeWaiver');
    if (!freelancer?.stripeAccountId) {
      return res.status(400).json({
        error: 'Freelancer has not set up their payment account yet. Ask them to connect Stripe in their profile.'
      });
    }

    const amount    = job.escrowAmount;
    const waived    = freelancer.isFeeWaived();
    const platformFee = waived ? 0 : (escrowPayment?.platformFee || await calcPlatformFee(
      String(job.freelancer?._id || job.freelancer), 'freelancer', job, amount
    ));
    const payoutAmt   = amount - platformFee;

    // Consume one fee-waiver job credit
    if (waived) await freelancer.useFeeWaiverJob();

    // Client's card was already charged when job was funded (immediate capture).
    // Funds are sitting in Fetchwork's Stripe balance.
    // Now transfer net amount to the freelancer's Connect account.
    const transfer = await stripeService.releasePayment(
      payoutAmt,
      freelancer.stripeAccountId,
      job.stripePaymentIntentId   // transfer_group links charge to transfer
    );

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
    if (await emailWorkflowService.canSendEmail(freelancer._id, 'payment', 'payment_received')) {
      await emailService.sendPaymentNotification(freelancer, { amount: payoutAmt, job }, 'payment_received');
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

// ── POST /tip — client sends a bonus tip to freelancer ──────────
router.post('/tip', authenticateToken, async (req, res) => {
  try {
    const { jobId, amount, paymentMethodId } = req.body;
    if (!jobId || !amount) return res.status(400).json({ error: 'jobId and amount required' });
    if (typeof amount !== 'number' || amount < 1 || amount > 5000) {
      return res.status(400).json({ error: 'Tip must be between $1 and $5,000' });
    }

    const job = await Job.findById(jobId).populate('freelancer');
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.client) !== String(req.user.userId)) {
      return res.status(403).json({ error: 'Only the client can send a tip' });
    }
    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Tips can only be sent on completed jobs' });
    }

    const freelancerId = String(job.freelancer?._id || job.freelancer);
    const clientUser   = await User.findById(req.user.userId);
    const freelancer   = await User.findById(freelancerId).select('firstName lastName email stripeAccountId');

    if (!freelancer?.stripeAccountId) {
      return res.status(400).json({ error: 'Freelancer has not connected a bank account yet' });
    }

    const metadata = {
      jobId:        String(jobId),
      clientId:     String(req.user.userId),
      freelancerId,
      type:         'tip',
    };

    let paymentIntent;
    if (paymentMethodId) {
      if (!clientUser.stripeCustomerId) {
        return res.status(400).json({ error: 'No saved payment methods on file' });
      }
      paymentIntent = await stripeService.chargeWithSavedMethod(
        amount, clientUser.stripeCustomerId, paymentMethodId, metadata
      );
    } else {
      paymentIntent = await stripeService.chargeForJob(amount, 'usd', metadata);
    }

    // Record payment
    const payment = await Payment.create({
      job:         jobId,
      client:      req.user.userId,
      freelancer:  freelancerId,
      amount,
      fees:        { platform: 0, payment: 0, total: 0 }, // tips are fee-free
      netAmount:   amount,
      type:        'bonus',
      status:      paymentMethodId ? 'processing' : 'pending',
      paymentMethod: 'stripe',
      stripePaymentIntentId: paymentIntent.id,
      transactionId: paymentIntent.id,
    });

    // If saved card → transfer immediately (PI already confirmed)
    if (paymentMethodId && paymentIntent.status === 'succeeded') {
      await stripeService.releasePayment(amount, freelancer.stripeAccountId, String(jobId));
      await Payment.findByIdAndUpdate(payment._id, { status: 'completed' });
    }

    // Notify freelancer
    const clientName = `${clientUser.firstName || ''} ${clientUser.lastName || ''}`.trim() || 'Your client';
    await Notification.create({
      recipient: freelancerId,
      type:      'payment_received',
      title:     'You received a tip!',
      message:   `🎉 ${clientName} sent you a $${amount} tip for "${job.title}"!`,
      link:      `/projects`,
    });

    res.json({ success: true, paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret || null });
  } catch (err) {
    console.error('Tip error:', err);
    res.status(500).json({ error: 'Failed to process tip' });
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

  // ── Global idempotency guard ────────────────────────────────
  try {
    await ProcessedWebhookEvent.create({ stripeEventId: event.id, type: event.type });
  } catch (dupErr) {
    if (dupErr.code === 11000) {
      console.log(`Payments webhook duplicate skipped: ${event.id}`);
      return res.json({ received: true, skipped: true });
    }
    console.error('ProcessedWebhookEvent insert error:', dupErr.message);
  }

  try {
    switch (event.type) {

      case 'payment_intent.succeeded': {
        const pi = event.data.object;

        // Update Payment record
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { status: 'processing' }
        );

        // ── Boost activation ──
        if (pi.metadata?.type === 'boost') {
          const { activateBoost } = require('./boosts');  // won't work — use inline
          const days = parseInt(pi.metadata.boostDays) || 7;
          const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
          const Model = pi.metadata.targetType === 'service' ? Service : Job;
          await Model.findByIdAndUpdate(pi.metadata.targetId, {
            isBoosted: true,
            boostExpiresAt: expiresAt,
            boostPaymentId: pi.id,
            isFeatured: true,
          });
          // Create analytics record
          const BoostImpression = require('../models/BoostImpression');
          await BoostImpression.create({
            targetType: pi.metadata.targetType,
            targetId: pi.metadata.targetId,
            owner: pi.metadata.userId,
            boostPlan: pi.metadata.boostPlan,
            boostStart: new Date(),
            boostEnd: expiresAt,
            paid: true,
          });
          // Trigger discovery
          const { notifyMatchingUsers } = require('../services/discoveryEngine');
          notifyMatchingUsers(pi.metadata.targetType, pi.metadata.targetId).catch(() => {});
          console.log(`✅ Boost activated: ${pi.metadata.targetType} ${pi.metadata.targetId} for ${days} days`);
          break;
        }

        // ── Failsafe: auto-activate any pending service order tied to this PI ──
        try {
          const service = await Service.findOne({ 'orders.stripePaymentIntentId': pi.id })
            .populate('freelancer', 'firstName lastName');
          if (service) {
            const order = service.orders.find(o => o.stripePaymentIntentId === pi.id);
            if (order && order.status === 'pending') {
              order.status = 'in_progress';
              await service.save();

              // Ensure conversation is linked
              let conv = await Conversation.findOne({ service: service._id, serviceOrderId: order._id });
              if (!conv) {
                conv = new Conversation({
                  participants:   [service.freelancer._id, order.client],
                  service:        service._id,
                  serviceOrderId: order._id,
                });
                await conv.save();
              }

              const pkg = service.pricing?.[order.package] || {};
              const sysMsg = new Message({
                conversation: conv._id,
                sender:       order.client,
                recipient:    service.freelancer._id,
                content:      `✅ Payment confirmed — order is now active!\n\nService: "${service.title}"\nPackage: ${pkg.title || order.package}\nPrice: $${order.price}\nDelivery: ${pkg.deliveryTime || '?'} days`,
                messageType:  'system',
                metadata: { type: 'service_order', serviceId: service._id, orderId: order._id, price: order.price }
              });
              await sysMsg.save();
              conv.lastMessage = sysMsg._id;
              await conv.updateLastActivity();

              // Notify freelancer
              await Notification.create({
                recipient: service.freelancer._id,
                type: 'new_order',
                title: 'New service order',
                message: `You have a new paid order for "${service.title}" (${pkg.title || order.package}).`,
                link: `/messages`,
              });

              console.log('✅ Webhook auto-activated service order:', order._id);
            }
          }
        } catch (svcErr) {
          console.error('Webhook: service order activation failed:', svcErr.message);
        }

        // ── Activate bundle purchase if payment succeeded ────────────
        try {
          if (pi.metadata?.type === 'bundle_purchase') {
            const BundlePurchase = require('../models/BundlePurchase');
            const purchase = await BundlePurchase.findOne({ stripePaymentIntentId: pi.id });
            if (purchase && purchase.status === 'pending') {
              purchase.status      = 'active';
              purchase.activatedAt = new Date();
              await purchase.save();

              await Notification.create({
                recipient: purchase.client,
                title:     'Bundle activated',
                message:   `Your "${purchase.bundleName}" bundle is now active. ${purchase.sessionsTotal} sessions ready to schedule.`,
                link:      `/services/bundles/${purchase._id}`,
              });
              console.log('✅ Bundle activated:', purchase._id);
            }
          }
        } catch (bundleErr) {
          console.error('Webhook: bundle activation failed:', bundleErr.message);
        }

        // ── Notify freelancer when a job's escrow is funded ──
        try {
          const job = await Job.findOne({ stripePaymentIntentId: pi.id })
            .populate('client', 'firstName lastName')
            .populate('freelancer', '_id');
          if (job && job.freelancer) {
            await Notification.create({
              recipient: job.freelancer._id,
              type: 'payment_received',
              title: 'Secure Payment funded',
              message: `${job.client.firstName} ${job.client.lastName} has secured payment for "${job.title}". You're good to start!`,
              relatedJob: job._id,
              link: `/jobs/${job._id}/progress`,
            });
          }
        } catch (jobNotifErr) {
          console.error('Webhook: job funded notification failed:', jobNotifErr.message);
        }

        console.log('✅ payment_intent.succeeded:', pi.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;

        // Mark payment as failed
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { status: 'failed' }
        );

        // Reset job escrowAmount so client can retry (prevents stuck state)
        const failedJob = await Job.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { escrowAmount: 0, stripePaymentIntentId: null }
        ).populate('client', '_id firstName');

        // Notify client
        if (failedJob?.client) {
          try {
            await Notification.create({
              recipient:  failedJob.client._id,
              type:       'payment_failed',
              title:      'Payment not completed',
              message:    `Your payment for "${failedJob.title}" was declined or not completed. Please try again.`,
              relatedJob: failedJob._id,
              link:  `/jobs/${failedJob._id}/progress`,
            });
          } catch (notifErr) {
            console.error('Webhook: failed-payment notification error:', notifErr.message);
          }
        }

        console.log('❌ payment_intent.payment_failed:', pi.id);
        break;
      }

      case 'account.updated': {
        const account = event.data.object;
        if (!account.id) break;

        const fullyEnabled = account.charges_enabled && account.payouts_enabled;
        const pastDue      = account.requirements?.past_due?.length > 0;
        const currentlyDue = account.requirements?.currently_due?.length > 0;

        const user = await User.findOneAndUpdate(
          { stripeAccountId: account.id },
          { stripeConnected: fullyEnabled },
          { new: false } // get old doc to detect state change
        );

        if (user) {
          const wasConnected = user.stripeConnected;

          // Became fully enabled for the first time (or re-enabled)
          if (fullyEnabled && !wasConnected) {
            await Notification.create({
              recipient: user._id,
              type:      'system',
              title:     '🎉 Payout account ready',
              message:   'Your bank account is verified and ready to receive payments. You\'ll be paid automatically when clients approve work.',
              link:      '/payments',
            });
          }

          // Has past-due requirements that could block payouts
          if (pastDue) {
            const fields = account.requirements.past_due.slice(0, 3).join(', ');
            await Notification.create({
              recipient: user._id,
              type:      'system',
              title:     '⚠️ Action needed: payment account',
              message:   `Your payout account needs attention. Missing: ${fields}. Payouts may be paused until resolved.`,
              link:      '/payments',
            });
            // Email for past-due (more urgent)
            try {
              const content = `
                <p>Hi ${user.firstName || 'there'},</p>
                <p>Your Fetchwork payout account requires some information: <strong>${fields}</strong>.</p>
                <p>If not resolved, your payouts may be paused. Please update your account details.</p>
                <p><a href="${process.env.CLIENT_URL}/payments" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Update Payment Account</a></p>
              `;
              await emailService.sendEmail(user.email, 'Action required: Update your payout account', content, 'Your payout account needs attention');
            } catch (emailErr) {
              console.error('account.updated email error (non-fatal):', emailErr.message);
            }
          }
        }

        console.log(`🔄 account.updated: ${account.id} | enabled=${fullyEnabled} | pastDue=${pastDue}`);
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

      // ── Recurring service: invoice paid → payout freelancer ──────
      case 'invoice.paid': {
        try {
          const invoice = event.data.object;
          const stripeSubId = invoice.subscription;
          if (!stripeSubId) break; // not a subscription invoice

          const ServiceSubscription = require('../models/ServiceSubscription');
          const sub = await ServiceSubscription.findOne({ stripeSubscriptionId: stripeSubId });
          if (!sub) break; // not one of our service subs

          const amountPaid = invoice.amount_paid / 100; // cents → dollars

          // Recalculate fee using stored rate (locked at subscribe time)
          const feeRate      = sub.platformFeeRate || 0.10;
          const freelancerFee = Math.round(amountPaid * feeRate * 100) / 100;
          const clientFeeAmt  = sub.platformFeeAmount ? (sub.platformFeeAmount - freelancerFee) : 0;
          const payoutAmt     = Math.round((amountPaid - freelancerFee) * 100) / 100;

          // Transfer payout to freelancer's Connect account
          const freelancer = await User.findById(sub.freelancer).select('stripeAccountId');
          let transferId;
          if (freelancer?.stripeAccountId && payoutAmt > 0) {
            const transfer = await stripeService.transferServicePayout({
              amount:              payoutAmt,
              destinationAccountId: freelancer.stripeAccountId,
              invoiceId:           invoice.id,
              subscriptionId:      stripeSubId,
            });
            transferId = transfer.id;
          }

          // Log invoice on the subscription
          sub.invoices.push({
            stripeInvoiceId: invoice.id,
            amount:          amountPaid,
            platformFee:     sub.platformFeeAmount || freelancerFee + clientFeeAmt,
            freelancerPaid:  payoutAmt,
            paidAt:          new Date(invoice.status_transitions?.paid_at * 1000 || Date.now()),
            status:          'paid',
            stripeTransferId: transferId,
          });
          sub.status          = 'active';
          sub.nextBillingDate = invoice.next_payment_attempt
            ? new Date(invoice.next_payment_attempt * 1000) : null;
          if (!sub.startedAt) sub.startedAt = new Date();
          await sub.save();

          // Notify freelancer
          await Notification.create({
            recipient: sub.freelancer,
            title:     'Recurring payment received',
            message:   `You received $${payoutAmt.toFixed(2)} for a recurring service subscription`,
            link:      `/services/${sub.service}`,
          });

          console.log(`✅ Recurring service payout: $${payoutAmt} → ${freelancer?.stripeAccountId}`);
        } catch (invoiceErr) {
          console.error('Webhook invoice.paid handler error:', invoiceErr.message);
        }
        break;
      }

      // ── Recurring service: payment failed → notify both sides ────
      case 'invoice.payment_failed': {
        try {
          const invoice = event.data.object;
          if (!invoice.subscription) break;
          const ServiceSubscription = require('../models/ServiceSubscription');
          const sub = await ServiceSubscription.findOne({ stripeSubscriptionId: invoice.subscription });
          if (!sub) break;

          sub.status = 'past_due';
          await sub.save();

          await Notification.create({
            recipient: sub.client,
            title:     'Recurring payment failed',
            message:   'Your payment for a recurring service failed. Please update your payment method.',
            link:      '/settings/billing',
          });

          console.log(`⚠️ Recurring service payment failed: sub ${sub._id}`);
        } catch (err) {
          console.error('Webhook invoice.payment_failed error:', err.message);
        }
        break;
      }

      // ── Recurring service: subscription cancelled in Stripe ───────
      case 'customer.subscription.deleted': {
        try {
          const stripeSub = event.data.object;
          const ServiceSubscription = require('../models/ServiceSubscription');
          const sub = await ServiceSubscription.findOne({ stripeSubscriptionId: stripeSub.id });
          if (!sub) break;
          if (!['cancelled', 'completed'].includes(sub.status)) {
            sub.status      = 'cancelled';
            sub.cancelledAt = new Date();
            sub.cancelReason = 'stripe_cancelled';
            await sub.save();
          }
          console.log(`🔴 Service subscription cancelled: ${sub._id}`);
        } catch (err) {
          console.error('Webhook subscription.deleted error:', err.message);
        }
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

// ── POST /api/payments/ephemeral-key — Stripe React Native ──────
router.post('/ephemeral-key', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.userId)
      .select('stripeCustomerId email firstName lastName');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const customerId = await stripeService.ensureCustomer(user);
    if (!user.stripeCustomerId) {
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const ephemeralKey = await stripeService.createEphemeralKey(customerId);
    res.json({ ephemeralKey: ephemeralKey.secret, customerId });
  } catch (err) {
    console.error('Ephemeral key error:', err);
    res.status(500).json({ error: 'Failed to create ephemeral key' });
  }
});

module.exports = router;
