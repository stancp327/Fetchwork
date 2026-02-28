/**
 * Billing routes — subscription management.
 * Stage 2 of monetization.
 *
 * Routes:
 *   GET    /api/billing/status          — current plan + subscription details
 *   GET    /api/billing/plans           — all active plans (for pricing page)
 *   POST   /api/billing/subscribe       — create Stripe Checkout session
 *   POST   /api/billing/portal         — create Stripe Billing Portal session
 *   POST   /api/billing/cancel          — cancel subscription at period end
 *   POST   /api/billing/webhook         — Stripe subscription webhooks
 *   POST   /api/billing/sync-plans      — (admin) sync plans → Stripe Products/Prices
 */
const express        = require('express');
const router         = express.Router();
const stripeService  = require('../services/stripeService');
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin } = require('../middleware/adminAuth');
const User             = require('../models/User');
const Plan             = require('../models/Plan');
const UserSubscription = require('../models/UserSubscription');
const BillingAuditLog  = require('../models/BillingAuditLog');
const Notification     = require('../models/Notification');
const { assignDefaultPlan, logBillingAction } = require('../utils/billingUtils');
const { CLIENT_URL }   = require('../config/env');
const BillingCredit    = require('../models/BillingCredit');
const { getPlanLimits } = require('../middleware/entitlements');

const BILLING_WEBHOOK_SECRET = process.env.STRIPE_BILLING_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

// ── GET /api/billing/plans ──────────────────────────────────────
// Public — returns all active plans for pricing page
router.get('/plans', async (req, res) => {
  try {
    const { audience } = req.query; // optional filter: 'freelancer' | 'client'
    const query = { active: true };
    if (audience) query.audience = audience;
    const plans = await Plan.find(query).sort('sortOrder').lean();
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// ── GET /api/billing/status ─────────────────────────────────────
// Returns current user's plan + subscription details
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const sub = await UserSubscription
      .findOne({ user: req.user.userId, status: { $in: ['active', 'trialing', 'past_due'] } })
      .populate('plan')
      .lean();

    if (!sub) {
      // No subscription record — return free plan info
      const user = await User.findById(req.user.userId).select('role accountType').lean();
      const audience = user?.accountType === 'client' ? 'client' : 'freelancer';
      const freePlan = await Plan.findOne({ audience, tier: 'free', active: true }).lean();
      const limits = await getPlanLimits(req.user.userId);
      return res.json({ plan: freePlan, subscription: null, isDefault: true, planLimits: limits });
    }

    const limits = await getPlanLimits(req.user.userId);
    res.json({
      plan:         sub.plan,
      subscription: {
        status:            sub.status,
        currentPeriodEnd:  sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        grandfathered:     sub.grandfathered,
        source:            sub.source,
        customPrice:       sub.customPrice,
      },
      isDefault:  sub.source === 'default',
      planLimits: limits,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch billing status' });
  }
});

// ── POST /api/billing/subscribe ─────────────────────────────────
// Creates a Stripe Checkout session to upgrade to a paid plan
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const { planSlug } = req.body;
    if (!planSlug) return res.status(400).json({ error: 'planSlug is required' });

    const plan = await Plan.findOne({ slug: planSlug, active: true });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.tier === 'free') return res.status(400).json({ error: 'Cannot subscribe to free plan' });
    if (!plan.stripePriceId) {
      return res.status(400).json({ error: 'This plan is not yet available for purchase. Contact support.' });
    }

    const user = await User.findById(req.user.userId).select('email firstName lastName stripeCustomerId');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Ensure Stripe Customer exists
    if (!user.stripeCustomerId) {
      const customerId = await stripeService.ensureCustomer(user);
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const successUrl = `${CLIENT_URL}/billing?subscription=success&plan=${planSlug}`;
    const cancelUrl  = `${CLIENT_URL}/pricing?subscription=cancelled`;

    const session = await stripeService.createCheckoutSession(
      user.stripeCustomerId,
      plan.stripePriceId,
      successUrl,
      cancelUrl,
      { userId: String(user._id), planSlug: plan.slug, planId: String(plan._id) }
    );

    res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ── POST /api/billing/portal ────────────────────────────────────
// Opens Stripe Customer Portal to manage/cancel subscription
router.post('/portal', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('stripeCustomerId email firstName lastName');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.stripeCustomerId) {
      const customerId = await stripeService.ensureCustomer(user);
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const returnUrl = `${CLIENT_URL}/billing`;
    const session   = await stripeService.createBillingPortalSession(user.stripeCustomerId, returnUrl);
    res.json({ portalUrl: session.url });
  } catch (err) {
    console.error('Portal error:', err.message);
    res.status(500).json({ error: 'Failed to open billing portal' });
  }
});

// ── POST /api/billing/cancel ────────────────────────────────────
// Cancel subscription at period end
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const sub = await UserSubscription.findOne({
      user:   req.user.userId,
      status: 'active',
    });
    if (!sub?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    await stripeService.cancelSubscriptionAtPeriodEnd(sub.stripeSubscriptionId);
    sub.cancelAtPeriodEnd = true;
    await sub.save();

    await logBillingAction({
      userId: req.user.userId,
      action: 'subscription_cancelled',
      before: { status: 'active', cancelAtPeriodEnd: false },
      after:  { status: 'active', cancelAtPeriodEnd: true },
      note:   'User requested cancellation at period end',
    });

    res.json({ message: 'Subscription will cancel at end of billing period', cancelAtPeriodEnd: true });
  } catch (err) {
    console.error('Cancel error:', err.message);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// (webhook handler exported below — mounted raw in index.js before express.json())

// ── Webhook handlers ────────────────────────────────────────────

async function handleSubscriptionActivated(stripeSubId, metadata) {
  if (!metadata?.userId || !metadata?.planId) return;
  const plan = await Plan.findById(metadata.planId);
  if (!plan) return;
  const stripeSub = await stripeService.retrieveSubscription(stripeSubId);
  await activateSubscription(metadata.userId, plan, stripeSub);
}

async function handleSubscriptionUpdated(stripeSub) {
  const customerId = stripeSub.customer;
  const user = await User.findOne({ stripeCustomerId: customerId }).select('_id').lean();
  if (!user) return;

  // Find which plan this price belongs to
  const priceId = stripeSub.items?.data?.[0]?.price?.id;
  const plan    = priceId ? await Plan.findOne({ stripePriceId: priceId }) : null;
  if (!plan) return;

  const existing = await UserSubscription.findOne({ user: user._id });
  const before   = existing ? { status: existing.status, planSlug: existing.plan } : null;

  await UserSubscription.findOneAndUpdate(
    { user: user._id },
    {
      plan:                  plan._id,
      stripeSubscriptionId:  stripeSub.id,
      stripeCustomerId:      customerId,
      stripePriceId:         priceId,
      status:                mapStripeStatus(stripeSub.status),
      currentPeriodStart:    new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd:      new Date(stripeSub.current_period_end * 1000),
      cancelAtPeriodEnd:     stripeSub.cancel_at_period_end,
      source:                'stripe',
    },
    { upsert: true, new: true }
  );

  await logBillingAction({
    userId: user._id,
    action: 'subscription_updated',
    before,
    after:  { status: stripeSub.status, planSlug: plan.slug },
    note:   `Stripe subscription ${stripeSub.id} updated`,
    metadata: { stripeSubId: stripeSub.id },
  });
}

async function handleSubscriptionDeleted(stripeSub) {
  const sub = await UserSubscription.findOne({ stripeSubscriptionId: stripeSub.id });
  if (!sub) return;

  const userId = sub.user;
  const before = { status: sub.status };

  // Downgrade to free plan
  const user      = await User.findById(userId).select('accountType').lean();
  const audience  = user?.accountType === 'client' ? 'client' : 'freelancer';
  const freePlan  = await Plan.findOne({ audience, tier: 'free', active: true });

  await UserSubscription.findOneAndUpdate(
    { _id: sub._id },
    {
      plan:                 freePlan?._id || sub.plan,
      status:               'cancelled',
      cancelAtPeriodEnd:    false,
      stripeSubscriptionId: null,
      source:               'default',
    }
  );

  await logBillingAction({
    userId,
    action: 'plan_downgraded',
    before,
    after:  { status: 'cancelled', planSlug: freePlan?.slug || 'free' },
    note:   'Subscription deleted — downgraded to free',
    metadata: { stripeSubId: stripeSub.id },
  });

  // Notify user
  await Notification.create({
    recipient: userId,
    type:      'system',
    title:     'Subscription ended',
    content:   'Your subscription has ended and you\'ve been moved to the Free plan. Upgrade anytime to restore your benefits.',
    metadata:  { type: 'subscription_ended' },
  });
}

async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  const user = await User.findOne({ stripeCustomerId: customerId }).select('_id').lean();
  if (!user) return;

  await UserSubscription.findOneAndUpdate(
    { user: user._id, stripeSubscriptionId: invoice.subscription },
    { status: 'past_due' }
  );

  await logBillingAction({
    userId: user._id,
    action: 'payment_failed',
    before: { status: 'active' },
    after:  { status: 'past_due' },
    note:   `Invoice ${invoice.id} payment failed`,
    metadata: { invoiceId: invoice.id },
  });

  // Notify user
  await Notification.create({
    recipient: user._id,
    type:      'system',
    title:     'Payment failed',
    content:   'We couldn\'t process your subscription payment. Please update your payment method to keep your plan benefits.',
    metadata:  { type: 'payment_failed', invoiceId: invoice.id },
  });
}

async function activateSubscription(userId, plan, stripeSub) {
  const existing = await UserSubscription.findOne({ user: userId });
  const before   = existing ? { planSlug: String(existing.plan) } : null;

  await UserSubscription.findOneAndUpdate(
    { user: userId },
    {
      plan:                 plan._id,
      stripeSubscriptionId: stripeSub.id,
      stripeCustomerId:     stripeSub.customer,
      stripePriceId:        stripeSub.items?.data?.[0]?.price?.id,
      status:               mapStripeStatus(stripeSub.status),
      currentPeriodStart:   new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd:     new Date(stripeSub.current_period_end * 1000),
      cancelAtPeriodEnd:    false,
      source:               'stripe',
    },
    { upsert: true, new: true }
  );

  await logBillingAction({
    userId,
    action: before ? 'plan_upgraded' : 'plan_assigned',
    before,
    after:  { planSlug: plan.slug },
    note:   `Subscription activated via Stripe Checkout`,
    metadata: { stripeSubId: stripeSub.id },
  });

  // Welcome notification
  await Notification.create({
    recipient: userId,
    type:      'system',
    title:     `${plan.name} activated!`,
    content:   `Welcome to ${plan.name}. Your new benefits are active immediately.`,
    metadata:  { type: 'subscription_activated', planSlug: plan.slug },
  });
}

function mapStripeStatus(stripeStatus) {
  const map = {
    active:             'active',
    trialing:           'trialing',
    past_due:           'past_due',
    canceled:           'cancelled',
    incomplete:         'incomplete',
    incomplete_expired: 'cancelled',
    paused:             'paused',
    unpaid:             'past_due',
  };
  return map[stripeStatus] || 'active';
}

// ── POST /api/billing/sync-plans (admin only) ───────────────────
// Creates Stripe Products + Prices for all paid plans that don't have them yet
router.post('/sync-plans', authenticateAdmin, async (req, res) => {
  try {
    const plans = await Plan.find({ tier: { $ne: 'free' }, active: true });
    const results = [];

    for (const plan of plans) {
      let updated = false;

      if (!plan.stripeProductId) {
        const product = await stripeService.createProduct(plan.name, plan.description);
        plan.stripeProductId = product.id;
        updated = true;
      }

      if (!plan.stripePriceId) {
        const price = await stripeService.createPrice(
          plan.stripeProductId,
          Math.round(plan.price * 100), // cents
          plan.interval === 'year' ? 'year' : 'month'
        );
        plan.stripePriceId = price.id;
        updated = true;
      }

      if (updated) await plan.save();
      results.push({ slug: plan.slug, stripeProductId: plan.stripeProductId, stripePriceId: plan.stripePriceId });
    }

    res.json({ synced: results.length, results });
  } catch (err) {
    console.error('Sync plans error:', err.message);
    res.status(500).json({ error: 'Failed to sync plans to Stripe' });
  }
});

// ── Billing webhook handler (raw — mounted in index.js before express.json()) ──
async function webhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = await stripeService.constructBillingWebhookEvent(req.body, sig, BILLING_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Billing webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.metadata?.type === 'wallet_topup') {
          await handleWalletTopup(session);
        } else if (session.mode === 'subscription') {
          await handleSubscriptionActivated(session.subscription, session.metadata);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await handleSubscriptionUpdated(event.data.object);
        break;
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object);
        break;
      }

      case 'invoice.payment_failed': {
        await handlePaymentFailed(event.data.object);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await UserSubscription.findOneAndUpdate(
            { stripeSubscriptionId: invoice.subscription },
            { status: 'active' }
          );
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Billing webhook handler error (${event.type}):`, err.message);
    // Return 200 — never let Stripe retry endlessly
  }

  res.json({ received: true });
}

// ── Wallet routes ────────────────────────────────────────────────

// GET /api/billing/wallet — wallet balance + credit history
router.get('/wallet', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Active credits (not expired, not voided, remaining > 0)
    const activeCredits = await BillingCredit.find({
      user:      userId,
      status:    'active',
      remaining: { $gt: 0 },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).sort({ createdAt: 1 }).lean();

    const balance = activeCredits.reduce((sum, c) => sum + (c.remaining || 0), 0);

    // Recent used credits
    const usedCredits = await BillingCredit.find({ user: userId, status: { $in: ['used', 'voided', 'expired'] } })
      .sort({ updatedAt: -1 }).limit(20).lean();

    res.json({
      balance: Math.round(balance * 100) / 100,
      active:  activeCredits,
      history: usedCredits,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// POST /api/billing/wallet/add — Stripe Checkout to prepay wallet funds
// Body: { amount } — dollar amount to add (min $5)
router.post('/wallet/add', authenticateToken, async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount < 5) return res.status(400).json({ error: 'Minimum wallet top-up is $5' });
    if (amount > 500) return res.status(400).json({ error: 'Maximum single top-up is $500' });

    // Check entitlement: wallet requires Plus or Pro
    const limits = await getPlanLimits(req.user.userId);
    const level  = limits.analyticsLevel; // 'basic' = free tier
    // We use analyticsLevel as a proxy for tier; free users have 'basic'
    const sub = await UserSubscription
      .findOne({ user: req.user.userId, status: { $in: ['active', 'trialing'] } })
      .populate('plan').lean();
    const tier = sub?.plan?.tier || 'free';

    if (tier === 'free') {
      return res.status(403).json({
        error:      'Wallet is available on Plus and Pro plans.',
        reason:     'feature_gated',
        feature:    'wallet',
        upgradeUrl: '/pricing',
      });
    }

    const user = await User.findById(req.user.userId).select('email firstName stripeCustomerId');
    if (!user.stripeCustomerId) {
      const customerId = await stripeService.ensureCustomer(user);
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const amountCents = Math.round(amount * 100);

    // One-time payment checkout session
    const session = await stripeService.stripe.checkout.sessions.create({
      customer:    user.stripeCustomerId,
      mode:        'payment',
      line_items:  [{ price_data: {
        currency:    'usd',
        unit_amount: amountCents,
        product_data: { name: `Fetchwork Wallet — $${amount.toFixed(2)} credit` },
      }, quantity: 1 }],
      success_url: `${CLIENT_URL}/wallet?funded=1&amount=${amount}`,
      cancel_url:  `${CLIENT_URL}/wallet?cancelled=1`,
      metadata:    { type: 'wallet_topup', userId: String(req.user.userId), amount: String(amount) },
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error('Wallet add error:', err.message);
    res.status(500).json({ error: 'Could not create checkout session' });
  }
});

// POST /api/billing/wallet/confirm — called by webhook OR manually after return
// Usually triggered by checkout.session.completed webhook for wallet_topup
async function handleWalletTopup(session) {
  try {
    const { userId, amount } = session.metadata;
    if (!userId || !amount) return;
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount) return;

    await BillingCredit.create({
      user:      userId,
      amount:    parsedAmount,
      remaining: parsedAmount,
      reason:    `Wallet top-up via Stripe (session ${session.id})`,
      status:    'active',
    });

    await logBillingAction({
      userId,
      action:   'wallet_topup',
      after:    { amount: parsedAmount, sessionId: session.id },
      note:     `$${parsedAmount} added to wallet`,
    });
  } catch (err) {
    console.error('handleWalletTopup error:', err.message);
  }
}

module.exports = router;
module.exports.webhookHandler = webhookHandler;
module.exports.handleWalletTopup = handleWalletTopup;
