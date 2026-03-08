const express = require('express');
const router = express.Router();
const BackgroundCheck = require('../models/BackgroundCheck');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');

const CHECK_TIERS = {
  basic:    { price: 999,  label: 'Basic Check',    description: 'Identity verification + sex offender registry' },
  standard: { price: 1999, label: 'Standard Check', description: 'Basic + criminal records + county court search' },
  enhanced: { price: 2999, label: 'Enhanced Check', description: 'Standard + federal records + credit + education' },
};

// GET /api/background-checks/options — list available check types
router.get('/options', authenticateToken, (req, res) => {
  const options = Object.entries(CHECK_TIERS).map(([key, val]) => ({
    id: key, price: val.price / 100, ...val
  }));
  res.json({ options });
});

// GET /api/background-checks/me — get current user's check status
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const check = await BackgroundCheck.findOne({ user: req.user._id })
      .sort({ createdAt: -1 });

    if (!check) return res.json({ hasCheck: false });

    const isValid = check.status === 'completed' && check.validUntil && new Date(check.validUntil) > new Date();

    res.json({
      hasCheck: true,
      check: {
        id: check._id,
        type: check.type,
        status: check.status,
        overall: check.results?.overall || null,
        isValid,
        validUntil: check.validUntil,
        completedAt: check.results?.completedAt,
        createdAt: check.createdAt,
      }
    });
  } catch (error) {
    console.error('Error fetching background check:', error);
    res.status(500).json({ error: 'Failed to fetch background check status' });
  }
});

// POST /api/background-checks — initiate a background check
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { type } = req.body;
    const tier = CHECK_TIERS[type];
    if (!tier) return res.status(400).json({ error: 'Invalid check type. Options: basic, standard, enhanced' });

    // Check if user already has a pending/processing check
    const existing = await BackgroundCheck.findOne({
      user: req.user._id,
      status: { $in: ['pending_payment', 'pending_consent', 'processing'] }
    });
    if (existing) {
      return res.status(400).json({ error: 'You already have a background check in progress', checkId: existing._id });
    }

    // Check if user has a valid completed check
    const valid = await BackgroundCheck.findOne({
      user: req.user._id,
      status: 'completed',
      validUntil: { $gt: new Date() },
      'results.overall': 'clear'
    });
    if (valid) {
      return res.status(400).json({
        error: 'You already have a valid background check',
        validUntil: valid.validUntil
      });
    }

    // Create Stripe PaymentIntent
    let paymentIntent = null;
    try {
      const stripeService = require('../services/stripeService');
      paymentIntent = await stripeService.chargeForJob(tier.price / 100, 'usd', {
        type: 'background_check',
        checkType: type,
        userId: String(req.user._id),
      });
    } catch (err) {
      console.warn('Stripe not available for background check:', err.message);
    }

    const check = new BackgroundCheck({
      user: req.user._id,
      type,
      amount: tier.price / 100,
      paymentIntentId: paymentIntent?.id || null,
      status: paymentIntent ? 'pending_payment' : 'pending_consent',
      paid: !paymentIntent, // If no Stripe, skip payment
    });

    await check.save();

    res.status(201).json({
      check: { id: check._id, type: check.type, status: check.status, amount: check.amount },
      clientSecret: paymentIntent?.client_secret || null,
    });
  } catch (error) {
    console.error('Error initiating background check:', error);
    res.status(500).json({ error: 'Failed to initiate background check' });
  }
});

// POST /api/background-checks/:id/consent — user gives consent
router.post('/:id/consent', authenticateToken, async (req, res) => {
  try {
    const check = await BackgroundCheck.findById(req.params.id);
    if (!check) return res.status(404).json({ error: 'Background check not found' });
    if (check.user.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Not authorized' });
    if (check.consentGiven) return res.status(400).json({ error: 'Consent already given' });

    check.consentGiven = true;
    check.consentAt = new Date();
    check.consentIp = req.ip;
    check.status = 'processing';
    await check.save();

    // In production, this would trigger the Checkr API
    // For now, simulate processing with a delayed completion
    setTimeout(async () => {
      try {
        const bgCheck = await BackgroundCheck.findById(check._id);
        if (!bgCheck || bgCheck.status !== 'processing') return;

        bgCheck.results = {
          overall: 'clear',
          checks: [
            { name: 'Identity Verification', status: 'clear', notes: 'Verified' },
            ...(bgCheck.type !== 'basic' ? [
              { name: 'Criminal Records', status: 'clear', notes: 'No records found' },
              { name: 'County Court Search', status: 'clear', notes: 'No records found' },
            ] : []),
            ...(bgCheck.type === 'enhanced' ? [
              { name: 'Federal Records', status: 'clear', notes: 'No records found' },
              { name: 'Education Verification', status: 'clear', notes: 'Verified' },
            ] : []),
            { name: 'Sex Offender Registry', status: 'clear', notes: 'No records found' },
          ],
          completedAt: new Date(),
        };
        bgCheck.status = 'completed';
        bgCheck.validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

        await bgCheck.save();

        // Update user model with verification badge
        await User.findByIdAndUpdate(bgCheck.user, {
          $set: {
            'verification.backgroundCheck': true,
            'verification.backgroundCheckDate': new Date(),
            'verification.backgroundCheckType': bgCheck.type,
          }
        });

        // Notify user
        await Notification.create({
          recipient: bgCheck.user,
          type: 'verification',
          title: 'Background check complete! ✅',
          message: 'Your background check has been completed and your profile now shows a verified badge.',
          link: '/profile',
        });
      } catch (err) {
        console.error('Error completing simulated background check:', err);
      }
    }, 5000); // 5 second simulation delay

    res.json({ message: 'Consent recorded. Background check is now processing.', check });
  } catch (error) {
    console.error('Error recording consent:', error);
    res.status(500).json({ error: 'Failed to record consent' });
  }
});

// POST /api/background-checks/:id/payment-confirm — confirm payment
router.post('/:id/payment-confirm', authenticateToken, async (req, res) => {
  try {
    const check = await BackgroundCheck.findById(req.params.id);
    if (!check) return res.status(404).json({ error: 'Background check not found' });
    if (check.user.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Not authorized' });

    check.paid = true;
    check.paidAt = new Date();
    check.status = 'pending_consent';
    await check.save();

    res.json({ message: 'Payment confirmed. Please provide consent to proceed.', check });
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// GET /api/background-checks/:userId/status — check if a user is verified (public)
router.get('/:userId/status', async (req, res) => {
  try {
    const check = await BackgroundCheck.findOne({
      user: req.params.userId,
      status: 'completed',
      'results.overall': 'clear',
      validUntil: { $gt: new Date() },
    }).select('type results.overall validUntil');

    res.json({
      verified: !!check,
      type: check?.type || null,
      validUntil: check?.validUntil || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check verification status' });
  }
});

// ── Admin routes ────────────────────────────────────────────────

// GET /api/background-checks/admin/pending — list checks needing review
router.get('/admin/pending', authenticateAdmin, async (req, res) => {

  try {
    const checks = await BackgroundCheck.find({ status: { $in: ['processing', 'completed'] } })
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ checks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch checks' });
  }
});

// PUT /api/background-checks/admin/:id/review — admin reviews a check
router.put('/admin/:id/review', authenticateAdmin, async (req, res) => {

  try {
    const { overall, notes } = req.body;
    const check = await BackgroundCheck.findById(req.params.id);
    if (!check) return res.status(404).json({ error: 'Check not found' });

    if (overall) check.results.overall = overall;
    check.reviewedBy = req.user._id;
    check.reviewNotes = notes || '';
    await check.save();

    // Update user verification based on result
    if (overall === 'clear') {
      await User.findByIdAndUpdate(check.user, {
        $set: { 'verification.backgroundCheck': true, 'verification.backgroundCheckDate': new Date() }
      });
    } else if (overall === 'alert') {
      await User.findByIdAndUpdate(check.user, {
        $set: { 'verification.backgroundCheck': false }
      });
    }

    res.json({ message: 'Review saved', check });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save review' });
  }
});

module.exports = router;
