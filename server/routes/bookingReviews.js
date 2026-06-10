/**
 * bookingReviews.js — Post-session ratings and reviews for SQL bookings.
 * Clients and freelancers each submit one review per booking after it completes.
 */

const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');

function getPrisma() {
  return require('../booking-sql/db/client').getPrisma();
}

// ── POST /api/booking-reviews — submit a review ───────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const prisma   = getPrisma();
    const reviewerId = (req.user._id || req.user.userId).toString();

    const {
      bookingId,
      rating,
      comment,
      punctualityRating,
      communicationRating,
      qualityRating,
      isPublic,
    } = req.body;

    if (!bookingId || rating == null) {
      return res.status(400).json({ error: 'bookingId and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { currentState: true, clientId: true, freelancerId: true },
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.currentState !== 'completed')
      return res.status(409).json({ error: 'Can only review completed bookings', code: 'BOOKING_NOT_COMPLETED' });

    const isClient     = booking.clientId     === reviewerId;
    const isFreelancer = booking.freelancerId  === reviewerId;
    if (!isClient && !isFreelancer)
      return res.status(403).json({ error: 'Not a participant in this booking' });

    const role      = isClient ? 'client' : 'freelancer';
    const revieweeId = isClient ? booking.freelancerId : booking.clientId;

    // Dedupe: @@unique([bookingId, reviewerId])
    const existing = await prisma.bookingReview.findUnique({
      where: { bookingId_reviewerId: { bookingId, reviewerId } },
    });
    if (existing) return res.status(409).json({ error: 'You have already reviewed this booking', code: 'ALREADY_REVIEWED' });

    const review = await prisma.bookingReview.create({
      data: {
        bookingId,
        reviewerId,
        revieweeId,
        role,
        rating:              parseInt(rating),
        comment:             comment     || null,
        punctualityRating:   punctualityRating   != null ? parseInt(punctualityRating)   : null,
        communicationRating: communicationRating != null ? parseInt(communicationRating) : null,
        qualityRating:       qualityRating       != null ? parseInt(qualityRating)       : null,
        isPublic:            isPublic !== false,
      },
    });

    res.status(201).json({ message: 'Review submitted', review });
  } catch (err) {
    console.error('[bookingReviews] POST error:', err.message);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// ── GET /api/booking-reviews/stats/:userId — aggregate stats for a user ───────
router.get('/stats/:userId', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { userId } = req.params;
    const { role } = req.query;

    const where = {
      revieweeId: userId,
      isPublic:   true,
      ...(role && { role }),
    };

    const reviews = await prisma.bookingReview.findMany({ where });
    if (!reviews.length) {
      return res.json({
        averageRating:     0,
        totalReviews:      0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        avgPunctuality:    null,
        avgCommunication:  null,
        avgQuality:        null,
      });
    }

    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0, puncSum = 0, commSum = 0, qualSum = 0;
    let puncCount = 0, commCount = 0, qualCount = 0;

    for (const r of reviews) {
      totalRating += r.rating;
      dist[r.rating] = (dist[r.rating] || 0) + 1;
      if (r.punctualityRating   != null) { puncSum += r.punctualityRating;   puncCount++; }
      if (r.communicationRating != null) { commSum += r.communicationRating; commCount++; }
      if (r.qualityRating       != null) { qualSum += r.qualityRating;       qualCount++; }
    }

    res.json({
      averageRating:     Math.round((totalRating / reviews.length) * 10) / 10,
      totalReviews:      reviews.length,
      ratingDistribution: dist,
      avgPunctuality:    puncCount   ? Math.round((puncSum / puncCount)   * 10) / 10 : null,
      avgCommunication:  commCount   ? Math.round((commSum / commCount)   * 10) / 10 : null,
      avgQuality:        qualCount   ? Math.round((qualSum / qualCount)   * 10) / 10 : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ── GET /api/booking-reviews/booking/:bookingId — reviews for a specific booking
router.get('/booking/:bookingId', authenticateToken, async (req, res) => {
  try {
    const prisma   = getPrisma();
    const actorId  = (req.user._id || req.user.userId).toString();
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { clientId: true, freelancerId: true },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== actorId && booking.freelancerId !== actorId)
      return res.status(403).json({ error: 'Not a participant' });

    const reviews = await prisma.bookingReview.findMany({
      where:   { bookingId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load booking reviews' });
  }
});

// ── GET /api/booking-reviews/:userId — public reviews for a user ──────────────
router.get('/:userId', async (req, res) => {
  try {
    const prisma = getPrisma();
    const { role, limit = '20', offset = '0' } = req.query;

    const where = {
      revieweeId: req.params.userId,
      isPublic:   true,
      ...(role && { role }),
    };

    const [reviews, total] = await Promise.all([
      prisma.bookingReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:    Math.min(parseInt(limit), 50),
        skip:    parseInt(offset),
      }),
      prisma.bookingReview.count({ where }),
    ]);

    res.json({ reviews, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

module.exports = router;
