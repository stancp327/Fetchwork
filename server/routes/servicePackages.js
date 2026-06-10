/**
 * servicePackages.js — Session bundle packages for freelancer services.
 * Freelancers create discounted multi-session packages; clients purchase and redeem them.
 */

const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

function getPrisma() {
  return require('../booking-sql/db/client').getPrisma();
}

// ── POST /api/service-packages — freelancer creates a package ─────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    const freelancerId = (req.user._id || req.user.userId).toString();

    const {
      serviceId,
      name,
      description,
      sessionCount,
      pricePerSessionCents,
      totalPriceCents,
      savingsPercent,
      validityDays,
      maxPerClient,
    } = req.body;

    if (!serviceId || !name || !sessionCount || !pricePerSessionCents) {
      return res.status(400).json({ error: 'serviceId, name, sessionCount, and pricePerSessionCents are required' });
    }

    // Verify freelancer owns this service
    const Service = require('../models/Service');
    const svc = await Service.findById(serviceId).select('freelancer').lean();
    if (!svc) return res.status(404).json({ error: 'Service not found' });
    if (svc.freelancer.toString() !== freelancerId)
      return res.status(403).json({ error: 'Not your service' });

    const computed_total = parseInt(pricePerSessionCents) * parseInt(sessionCount);

    const pkg = await prisma.servicePackage.create({
      data: {
        freelancerId,
        serviceId,
        name,
        description:          description || null,
        sessionCount:         parseInt(sessionCount),
        pricePerSessionCents: parseInt(pricePerSessionCents),
        totalPriceCents:      totalPriceCents != null ? parseInt(totalPriceCents) : computed_total,
        savingsPercent:       savingsPercent  != null ? parseFloat(savingsPercent) : 0,
        validityDays:         validityDays    != null ? parseInt(validityDays)     : 365,
        maxPerClient:         maxPerClient    != null ? parseInt(maxPerClient)     : 1,
        isActive:             true,
      },
    });

    res.status(201).json({ message: 'Package created', package: pkg });
  } catch (err) {
    console.error('[servicePackages] POST error:', err.message);
    res.status(500).json({ error: 'Failed to create package' });
  }
});

// ── GET /api/service-packages/purchases/me — client's purchased packages ─────
router.get('/purchases/me', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    const clientId = (req.user._id || req.user.userId).toString();

    const purchases = await prisma.packagePurchase.findMany({
      where:   { clientId, status: { not: 'refunded' } },
      include: { package: { select: { name: true, sessionCount: true, serviceId: true } } },
      orderBy: { purchasedAt: 'desc' },
    });

    const now = new Date();
    const result = purchases.map(p => ({
      ...p,
      sessionsRemaining: p.sessionsTotal - p.sessionsUsed,
      isExpired:         p.expiresAt < now,
    }));

    res.json({ purchases: result });
  } catch (err) {
    console.error('[servicePackages] GET /purchases/me error:', err.message);
    res.status(500).json({ error: 'Failed to load packages' });
  }
});

// ── GET /api/service-packages/purchases/clients — freelancer's client purchases ─
router.get('/purchases/clients', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    const freelancerId = (req.user._id || req.user.userId).toString();

    const purchases = await prisma.packagePurchase.findMany({
      where:   { freelancerId },
      include: { package: { select: { name: true, sessionCount: true } } },
      orderBy: { purchasedAt: 'desc' },
    });

    res.json({ purchases: purchases.map(p => ({ ...p, sessionsRemaining: p.sessionsTotal - p.sessionsUsed })) });
  } catch (err) {
    console.error('[servicePackages] GET /purchases/clients error:', err.message);
    res.status(500).json({ error: 'Failed to load client purchases' });
  }
});

// ── GET /api/service-packages/:serviceId — list active packages for a service ─
router.get('/:serviceId', async (req, res) => {
  try {
    const prisma = getPrisma();
    const packages = await prisma.servicePackage.findMany({
      where: { serviceId: req.params.serviceId, isActive: true },
      orderBy: { totalPriceCents: 'asc' },
    });
    res.json({ packages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load packages' });
  }
});

// ── PUT /api/service-packages/:packageId — update package ────────────────────
router.put('/:packageId', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    const freelancerId = (req.user._id || req.user.userId).toString();

    const existing = await prisma.servicePackage.findUnique({ where: { id: req.params.packageId } });
    if (!existing) return res.status(404).json({ error: 'Package not found' });
    if (existing.freelancerId !== freelancerId) return res.status(403).json({ error: 'Not your package' });

    const { name, description, sessionCount, pricePerSessionCents, totalPriceCents, savingsPercent, validityDays, maxPerClient, isActive } = req.body;

    const updated = await prisma.servicePackage.update({
      where: { id: req.params.packageId },
      data: {
        ...(name                !== undefined && { name }),
        ...(description         !== undefined && { description }),
        ...(sessionCount        !== undefined && { sessionCount:         parseInt(sessionCount) }),
        ...(pricePerSessionCents !== undefined && { pricePerSessionCents: parseInt(pricePerSessionCents) }),
        ...(totalPriceCents      !== undefined && { totalPriceCents:      parseInt(totalPriceCents) }),
        ...(savingsPercent       !== undefined && { savingsPercent:       parseFloat(savingsPercent) }),
        ...(validityDays         !== undefined && { validityDays:         parseInt(validityDays) }),
        ...(maxPerClient         !== undefined && { maxPerClient:         parseInt(maxPerClient) }),
        ...(isActive             !== undefined && { isActive }),
      },
    });

    res.json({ message: 'Package updated', package: updated });
  } catch (err) {
    console.error('[servicePackages] PUT error:', err.message);
    res.status(500).json({ error: 'Failed to update package' });
  }
});

// ── DELETE /api/service-packages/:packageId — deactivate package ─────────────
router.delete('/:packageId', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    const freelancerId = (req.user._id || req.user.userId).toString();

    const existing = await prisma.servicePackage.findUnique({ where: { id: req.params.packageId } });
    if (!existing) return res.status(404).json({ error: 'Package not found' });
    if (existing.freelancerId !== freelancerId) return res.status(403).json({ error: 'Not your package' });

    await prisma.servicePackage.update({ where: { id: req.params.packageId }, data: { isActive: false } });
    res.json({ message: 'Package deactivated' });
  } catch (err) {
    console.error('[servicePackages] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to deactivate package' });
  }
});

// ── POST /api/service-packages/:packageId/purchase — client purchases a package
router.post('/:packageId/purchase', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    const clientId = (req.user._id || req.user.userId).toString();

    const pkg = await prisma.servicePackage.findUnique({ where: { id: req.params.packageId } });
    if (!pkg || !pkg.isActive) return res.status(404).json({ error: 'Package not found or inactive' });

    // Enforce maxPerClient
    const existingCount = await prisma.packagePurchase.count({
      where: { packageId: pkg.id, clientId, status: { in: ['active', 'exhausted'] } },
    });
    if (existingCount >= pkg.maxPerClient) {
      return res.status(409).json({ error: 'You have already purchased the maximum number of this package', code: 'MAX_PURCHASES_REACHED' });
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   pkg.totalPriceCents,
      currency: 'usd',
      metadata: { packageId: pkg.id, clientId, freelancerId: pkg.freelancerId, type: 'package_purchase' },
    });

    const expiresAt = new Date(Date.now() + pkg.validityDays * 24 * 60 * 60 * 1000);

    const purchase = await prisma.packagePurchase.create({
      data: {
        packageId:            pkg.id,
        clientId,
        freelancerId:         pkg.freelancerId,
        sessionsTotal:        pkg.sessionCount,
        sessionsUsed:         0,
        paidAmountCents:      pkg.totalPriceCents,
        stripePaymentIntentId: paymentIntent.id,
        status:               'active',
        expiresAt,
      },
    });

    res.status(201).json({
      message:      'Package purchase initiated',
      purchase,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error('[servicePackages] POST /:packageId/purchase error:', err.message);
    res.status(500).json({ error: 'Failed to initiate package purchase' });
  }
});

// ── POST /api/service-packages/purchases/:purchaseId/use — decrement session ──
router.post('/purchases/:purchaseId/use', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    const actorId = (req.user._id || req.user.userId).toString();

    const purchase = await prisma.packagePurchase.findUnique({ where: { id: req.params.purchaseId } });
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    if (purchase.clientId !== actorId && purchase.freelancerId !== actorId)
      return res.status(403).json({ error: 'Not authorized' });

    if (purchase.status !== 'active')
      return res.status(409).json({ error: 'Package is not active', code: 'PACKAGE_NOT_ACTIVE' });

    const now = new Date();
    if (purchase.expiresAt < now)
      return res.status(409).json({ error: 'Package has expired', code: 'PACKAGE_EXPIRED' });

    if (purchase.sessionsUsed >= purchase.sessionsTotal)
      return res.status(409).json({ error: 'No sessions remaining', code: 'NO_SESSIONS_REMAINING' });

    const newUsed = purchase.sessionsUsed + 1;
    const newStatus = newUsed >= purchase.sessionsTotal ? 'exhausted' : 'active';

    const updated = await prisma.packagePurchase.update({
      where: { id: req.params.purchaseId },
      data:  { sessionsUsed: newUsed, status: newStatus },
    });

    res.json({
      message:          'Session used',
      sessionsRemaining: updated.sessionsTotal - updated.sessionsUsed,
      purchase:          updated,
    });
  } catch (err) {
    console.error('[servicePackages] POST /purchases/:purchaseId/use error:', err.message);
    res.status(500).json({ error: 'Failed to use session' });
  }
});

module.exports = router;
