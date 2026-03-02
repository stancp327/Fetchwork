const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Job = require('../models/Job');
const Service = require('../models/Service');
const BoostCredit = require('../models/BoostCredit');
const BoostImpression = require('../models/BoostImpression');
const { notifyMatchingUsers } = require('../services/discoveryEngine');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Boost config
const BOOST_OPTIONS = {
  '7day':  { price: 499,  days: 7,  label: '7-day boost ($4.99)' },
  '14day': { price: 899,  days: 14, label: '14-day boost ($8.99)' },
  '30day': { price: 1499, days: 30, label: '30-day boost ($14.99)' },
};

// Monthly free boost credits by plan (7-day boosts only)
const PLAN_BOOST_CREDITS = {
  'freelancer_free':    0,
  'client_free':        0,
  'freelancer_plus':    1,
  'client_plus':        1,
  'freelancer_pro':     3,
  'client_business':    2,
};

// ── Helper: get or create this month's credit record
async function getMonthlyCredits(userId) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Get user's plan to determine credits
  const { getUserSubscription } = require('../utils/billingUtils');
  const sub = await getUserSubscription(userId);
  const planSlug = sub?.plan?.slug || 'freelancer_free';
  const totalCredits = PLAN_BOOST_CREDITS[planSlug] || 0;

  let record = await BoostCredit.findOne({ user: userId, monthKey });
  if (!record) {
    record = await BoostCredit.create({
      user: userId,
      monthKey,
      creditsTotal: totalCredits,
      creditsUsed: 0,
    });
  } else if (record.creditsTotal !== totalCredits) {
    // Plan changed mid-month — update total (never reduce below used)
    record.creditsTotal = Math.max(totalCredits, record.creditsUsed);
    await record.save();
  }

  return record;
}

// ── Helper: activate a boost on a target
async function activateBoost(targetType, targetId, days, paymentId, ownerId, plan, usedCredit) {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const Model = targetType === 'service' ? Service : Job;
  await Model.findByIdAndUpdate(targetId, {
    isBoosted: true,
    boostExpiresAt: expiresAt,
    boostPaymentId: paymentId || 'credit',
    isFeatured: true,
  });

  // Create analytics record
  if (ownerId) {
    await BoostImpression.create({
      targetType,
      targetId,
      owner: ownerId,
      boostPlan: plan || '7day',
      boostStart: new Date(),
      boostEnd: expiresAt,
      paid: !usedCredit,
    });
  }

  // Trigger discovery notifications (async, don't block response)
  notifyMatchingUsers(targetType, targetId).catch(err =>
    console.error('Discovery notify error:', err.message)
  );

  return expiresAt;
}

// ── POST /api/boosts/job/:id
router.post('/job/:id', authenticateToken, async (req, res) => {
  try {
    const { plan = '7day', useCredit = false } = req.body;
    const option = BOOST_OPTIONS[plan];
    if (!option) return res.status(400).json({ error: 'Invalid boost plan' });

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.client.toString() !== req.user.userId.toString())
      return res.status(403).json({ error: 'Not your job' });
    if (job.status !== 'open')
      return res.status(400).json({ error: 'Only open jobs can be boosted' });

    // Try free credit (7-day only)
    if (useCredit && plan === '7day') {
      const credits = await getMonthlyCredits(req.user.userId);
      if (credits.creditsUsed < credits.creditsTotal) {
        credits.creditsUsed += 1;
        await credits.save();
        const expiresAt = await activateBoost('job', job._id, 7, 'credit', req.user.userId, '7day', true);
        return res.json({
          boosted: true,
          usedCredit: true,
          expiresAt,
          creditsRemaining: credits.creditsTotal - credits.creditsUsed,
        });
      }
      // No credits left — fall through to paid
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: option.price,
      currency: 'usd',
      metadata: {
        type: 'boost',
        targetType: 'job',
        targetId: job._id.toString(),
        userId: req.user.userId.toString(),
        boostPlan: plan,
        boostDays: option.days.toString(),
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: option.price,
      plan: option.label,
    });
  } catch (err) {
    console.error('Boost payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/boosts/service/:id
router.post('/service/:id', authenticateToken, async (req, res) => {
  try {
    const { plan = '7day', useCredit = false } = req.body;
    const option = BOOST_OPTIONS[plan];
    if (!option) return res.status(400).json({ error: 'Invalid boost plan' });

    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    if (service.freelancer.toString() !== req.user.userId.toString())
      return res.status(403).json({ error: 'Not your service' });

    // Try free credit (7-day only)
    if (useCredit && plan === '7day') {
      const credits = await getMonthlyCredits(req.user.userId);
      if (credits.creditsUsed < credits.creditsTotal) {
        credits.creditsUsed += 1;
        await credits.save();
        const expiresAt = await activateBoost('service', service._id, 7, 'credit', req.user.userId, '7day', true);
        return res.json({
          boosted: true,
          usedCredit: true,
          expiresAt,
          creditsRemaining: credits.creditsTotal - credits.creditsUsed,
        });
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: option.price,
      currency: 'usd',
      metadata: {
        type: 'boost',
        targetType: 'service',
        targetId: service._id.toString(),
        userId: req.user.userId.toString(),
        boostPlan: plan,
        boostDays: option.days.toString(),
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: option.price,
      plan: option.label,
    });
  } catch (err) {
    console.error('Boost payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/boosts/credits — Check remaining boost credits
router.get('/credits', authenticateToken, async (req, res) => {
  try {
    const credits = await getMonthlyCredits(req.user.userId);
    res.json({
      total: credits.creditsTotal,
      used: credits.creditsUsed,
      remaining: credits.creditsTotal - credits.creditsUsed,
      month: credits.monthKey,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/boosts/track/impression — Record impression
router.post('/track/impression', async (req, res) => {
  try {
    const { targetType, targetId } = req.body;
    if (!targetType || !targetId) return res.status(400).json({ error: 'Missing fields' });
    await BoostImpression.findOneAndUpdate(
      { targetType, targetId },
      { $inc: { impressions: 1 } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/boosts/track/click — Record click
router.post('/track/click', async (req, res) => {
  try {
    const { targetType, targetId } = req.body;
    if (!targetType || !targetId) return res.status(400).json({ error: 'Missing fields' });
    await BoostImpression.findOneAndUpdate(
      { targetType, targetId },
      { $inc: { clicks: 1 } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/boosts/analytics — Get boost performance for the user
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const analytics = await BoostImpression.find({ owner: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ analytics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/boosts/options
router.get('/options', (req, res) => {
  const options = Object.entries(BOOST_OPTIONS).map(([key, val]) => ({
    id: key, ...val, price: val.price / 100,
  }));
  res.json({ options, planCredits: PLAN_BOOST_CREDITS });
});

// ── GET /api/boosts/algorithm-status — Check if algorithm is on
router.get('/algorithm-status', (req, res) => {
  const { isAlgorithmEnabled } = require('../services/discoveryEngine');
  res.json({ enabled: isAlgorithmEnabled() });
});

module.exports = router;
