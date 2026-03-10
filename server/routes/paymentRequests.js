const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { Conversation } = require('../models/Message');
const PaymentRequest = require('../models/PaymentRequest');
const stripeService = require('../services/stripeService');

const router = express.Router();

const getEntityId = (v) => (v && typeof v === 'object' ? (v._id || v.id || v.toString?.()) : v);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function resolveConvoAccess(conversationId, userId) {
  const convo = await Conversation.findById(conversationId).lean();
  if (!convo) return { convo: null, error: 'Conversation not found' };
  const ids = (convo.participants || []).map(p => String(getEntityId(p)));
  if (!ids.includes(String(userId))) return { convo: null, error: 'Not a participant in this conversation' };
  return { convo, ids };
}

// ── POST /api/payment-requests ───────────────────────────────────────────────
// Freelancer (or client) sends a payment request.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { conversationId, amount, description, type, jobId, serviceId } = req.body || {};
    const userId = req.user._id;

    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
    if (!amount || isNaN(Number(amount)) || Number(amount) < 1)
      return res.status(400).json({ error: 'amount must be at least $1' });
    if (!description || !String(description).trim())
      return res.status(400).json({ error: 'description required' });
    if (!['service_rendered', 'additional_funds'].includes(type))
      return res.status(400).json({ error: 'type must be service_rendered or additional_funds' });

    const { convo, ids, error } = await resolveConvoAccess(conversationId, userId);
    if (error) return res.status(convo === null ? 404 : 403).json({ error });

    const requestedFromId = ids.find(id => id !== String(userId));
    if (!requestedFromId) return res.status(400).json({ error: 'Could not determine payment recipient' });

    const pr = await PaymentRequest.create({
      conversationId,
      requestedById: userId,
      requestedFromId,
      jobId: jobId || null,
      serviceId: serviceId || null,
      amount: parseFloat(Number(amount).toFixed(2)),
      description: String(description).trim().slice(0, 1000),
      type,
    });

    return res.status(201).json({ paymentRequest: pr });
  } catch (err) {
    console.error('Create payment request error:', err);
    return res.status(500).json({ error: 'Failed to create payment request' });
  }
});

// ── GET /api/payment-requests?conversationId=... ─────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.query;
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });

    const { convo, error } = await resolveConvoAccess(conversationId, req.user._id);
    if (error) return res.status(convo === null ? 404 : 403).json({ error });

    const list = await PaymentRequest.find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ paymentRequests: list });
  } catch (err) {
    console.error('List payment requests error:', err);
    return res.status(500).json({ error: 'Failed to list payment requests' });
  }
});

// ── POST /api/payment-requests/:id/pay ──────────────────────────────────────
// Returns a Stripe clientSecret so the frontend can confirm payment.
router.post('/:id/pay', authenticateToken, async (req, res) => {
  try {
    const pr = await PaymentRequest.findById(req.params.id);
    if (!pr) return res.status(404).json({ error: 'Payment request not found' });
    if (pr.status !== 'pending') return res.status(400).json({ error: `Already ${pr.status}` });

    const { convo, error } = await resolveConvoAccess(pr.conversationId, req.user._id);
    if (error) return res.status(convo === null ? 404 : 403).json({ error });

    if (String(getEntityId(pr.requestedById)) === String(req.user._id))
      return res.status(400).json({ error: 'Requester cannot pay their own request' });

    // Create or reuse Stripe PaymentIntent
    let clientSecret = pr.stripeClientSecret;
    if (!clientSecret) {
      const pi = await stripeService.chargeForJob(pr.amount, pr.currency, {
        paymentRequestId: String(pr._id),
        conversationId: String(pr.conversationId),
        type: pr.type,
      });
      pr.stripePaymentIntentId = pi.id;
      pr.stripeClientSecret = pi.client_secret;
      await pr.save();
      clientSecret = pi.client_secret;
    }

    return res.json({ clientSecret, paymentRequest: pr });
  } catch (err) {
    console.error('Pay payment request error:', err);
    return res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// ── POST /api/payment-requests/:id/confirm ───────────────────────────────────
// Called after Stripe payment confirmed (frontend redirect/callback).
router.post('/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const pr = await PaymentRequest.findById(req.params.id);
    if (!pr) return res.status(404).json({ error: 'Payment request not found' });
    if (pr.status === 'paid') return res.json({ paymentRequest: pr }); // idempotent

    pr.status = 'paid';
    pr.paidAt = new Date();
    await pr.save();

    return res.json({ paymentRequest: pr });
  } catch (err) {
    console.error('Confirm payment request error:', err);
    return res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// ── POST /api/payment-requests/:id/cancel ────────────────────────────────────
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const pr = await PaymentRequest.findById(req.params.id);
    if (!pr) return res.status(404).json({ error: 'Payment request not found' });
    if (pr.status !== 'pending') return res.status(400).json({ error: `Cannot cancel: already ${pr.status}` });

    const { convo, error } = await resolveConvoAccess(pr.conversationId, req.user._id);
    if (error) return res.status(convo === null ? 404 : 403).json({ error });

    pr.status = 'cancelled';
    pr.cancelledAt = new Date();
    await pr.save();

    return res.json({ paymentRequest: pr });
  } catch (err) {
    console.error('Cancel payment request error:', err);
    return res.status(500).json({ error: 'Failed to cancel payment request' });
  }
});

module.exports = router;
