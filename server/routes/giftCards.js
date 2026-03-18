/**
 * Gift Cards API
 * POST   /api/gift-cards              — purchase (Stripe PaymentIntent)
 * POST   /api/gift-cards/confirm      — confirm payment + activate card
 * POST   /api/gift-cards/redeem       — redeem code → wallet credit
 * GET    /api/gift-cards              — list my purchased cards
 * GET    /api/gift-cards/check/:code  — check code validity (public — no auth needed)
 * DELETE /api/gift-cards/:id/void     — admin void
 */
const express        = require('express');
const router         = express.Router();
const GiftCard       = require('../models/GiftCard');
const BillingCredit  = require('../models/BillingCredit');
const User           = require('../models/User');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const stripeService  = require('../services/stripeService');
const { notify }     = require('../services/notificationService');

const DENOMINATIONS  = [10, 25, 50, 100]; // allowed amounts
const EXPIRY_DAYS    = 365;               // gift cards expire in 1 year

// ── POST /api/gift-cards ── Purchase: create Stripe PaymentIntent
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { amount, message = '', recipientEmail = '' } = req.body;
    if (!DENOMINATIONS.includes(Number(amount))) {
      return res.status(400).json({
        error: `Amount must be one of: ${DENOMINATIONS.map(d => '$' + d).join(', ')}`,
      });
    }
    if (message && message.length > 300) {
      return res.status(400).json({ error: 'Message too long (max 300 chars)' });
    }

    const user = await User.findById(req.user.userId).select('email firstName stripeCustomerId');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const customerId = await stripeService.ensureCustomer(user);

    const paymentIntent = await stripeService.stripe.paymentIntents.create({
      amount:      Math.round(amount * 100),  // cents
      currency:    'usd',
      customer:    customerId,
      description: `Fetchwork gift card — $${amount}`,
      metadata:    { type: 'gift_card', userId: user._id.toString(), amount: String(amount) },
      automatic_payment_methods: { enabled: true },
    });

    // Create card in pending_payment state — activated on confirm
    const card = await GiftCard.create({
      amount,
      message:               message.trim(),
      recipientEmail:        recipientEmail.trim().toLowerCase(),
      purchasedBy:           user._id,
      stripePaymentIntentId: paymentIntent.id,
      expiresAt:             new Date(Date.now() + EXPIRY_DAYS * 86_400_000),
      status:                'pending_payment',
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      giftCardId:   card._id,
    });
  } catch (err) {
    console.error('gift card purchase error:', err);
    res.status(500).json({ error: 'Failed to create gift card' });
  }
});

// ── POST /api/gift-cards/confirm ── Frontend calls after payment succeeds
router.post('/confirm', authenticateToken, async (req, res) => {
  try {
    const { giftCardId, paymentIntentId } = req.body;
    if (!giftCardId || !paymentIntentId) {
      return res.status(400).json({ error: 'giftCardId and paymentIntentId required' });
    }

    // Verify payment with Stripe
    const pi = await stripeService.stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const card = await GiftCard.findOneAndUpdate(
      { _id: giftCardId, purchasedBy: req.user.userId, status: 'pending_payment' },
      { status: 'active' },
      { new: true }
    );
    if (!card) return res.status(404).json({ error: 'Gift card not found or already activated' });

    // Notify purchaser
    await notify({
      userId:  req.user.userId,
      type:    'gift_card_purchased',
      title:   'Gift Card Ready 🎁',
      body:    `Your $${card.amount} Fetchwork gift card is ready. Code: ${card.code}`,
      data:    { code: card.code },
    });

    res.json({ success: true, code: card.code, amount: card.amount });
  } catch (err) {
    console.error('gift card confirm error:', err);
    res.status(500).json({ error: 'Failed to activate gift card' });
  }
});

// ── POST /api/gift-cards/redeem ── Redeem code → BillingCredit
router.post('/redeem', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const card = await GiftCard.findOne({ code: code.trim().toUpperCase() });
    if (!card) return res.status(404).json({ error: 'Invalid gift card code' });

    if (card.status === 'redeemed') {
      return res.status(400).json({ error: 'This gift card has already been used' });
    }
    if (card.status === 'expired') {
      return res.status(400).json({ error: 'This gift card has expired' });
    }
    if (card.status === 'voided') {
      return res.status(400).json({ error: 'This gift card is no longer valid' });
    }
    if (card.status !== 'active') {
      return res.status(400).json({ error: 'Gift card is not active' });
    }
    if (card.expiresAt && card.expiresAt < new Date()) {
      card.status = 'expired';
      await card.save();
      return res.status(400).json({ error: 'This gift card has expired' });
    }
    // Prevent self-redeem to avoid abuse — same user can redeem their own card though (gift to self is fine)

    // Mark card as redeemed
    card.status    = 'redeemed';
    card.usedBy    = req.user.userId;
    card.redeemedAt = new Date();
    await card.save();

    // Create wallet credit
    const credit = await BillingCredit.create({
      user:      req.user.userId,
      amount:    card.amount,
      remaining: card.amount,
      reason:    `Gift card redeemed (${card.code})`,
      status:    'active',
    });

    // Notify recipient
    await notify({
      userId: req.user.userId,
      type:   'gift_card_redeemed',
      title:  '🎁 Gift Card Redeemed!',
      body:   `$${card.amount} has been added to your Fetchwork wallet.`,
      data:   { amount: card.amount, creditId: credit._id },
    });

    res.json({ success: true, amount: card.amount, message: card.message || null });
  } catch (err) {
    console.error('gift card redeem error:', err);
    res.status(500).json({ error: 'Failed to redeem gift card' });
  }
});

// ── GET /api/gift-cards ── List cards I've purchased
router.get('/', authenticateToken, async (req, res) => {
  try {
    const cards = await GiftCard.find({ purchasedBy: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-stripePaymentIntentId')
      .populate('usedBy', 'firstName lastName username')
      .lean();
    res.json({ cards });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch gift cards' });
  }
});

// ── GET /api/gift-cards/check/:code ── Public code check (no auth)
router.get('/check/:code', async (req, res) => {
  try {
    const card = await GiftCard.findOne({ code: req.params.code.trim().toUpperCase() })
      .select('status amount expiresAt message')
      .lean();
    if (!card) return res.status(404).json({ valid: false, error: 'Invalid code' });
    if (card.status !== 'active') return res.json({ valid: false, status: card.status });
    if (card.expiresAt && card.expiresAt < new Date()) return res.json({ valid: false, status: 'expired' });
    res.json({ valid: true, amount: card.amount, expiresAt: card.expiresAt, message: card.message });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check code' });
  }
});

// ── DELETE /api/gift-cards/:id/void ── Admin only
router.delete('/:id/void', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const card = await GiftCard.findByIdAndUpdate(
      req.params.id,
      { status: 'voided' },
      { new: true }
    );
    if (!card) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, card });
  } catch (err) {
    res.status(500).json({ error: 'Failed to void card' });
  }
});

module.exports = router;
