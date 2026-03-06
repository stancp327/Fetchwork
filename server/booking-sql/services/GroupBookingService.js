/**
 * GroupBookingService — Group/class booking with waitlist
 * 
 * Features:
 * - Create group slots with capacity
 * - Book seats (with hold expiry)
 * - Waitlist management with auto-promotion
 * - Seat cancellation triggers waitlist promotion
 */

const { getPrisma } = require('../db/client');

const HOLD_EXPIRY_MINUTES = 10; // Hold expires after 10 minutes
const PROMOTION_EXPIRY_HOURS = 24; // Promoted users have 24h to confirm

class GroupBookingService {
  constructor(deps = {}) {
    this.prisma = deps.prisma || null;
  }

  _getPrisma() {
    if (this.prisma) return this.prisma;
    return getPrisma();
  }

  async _withTx(fn) {
    const prisma = this._getPrisma();
    if (prisma.$transaction) {
      return prisma.$transaction(fn);
    }
    // For mocked prisma without $transaction
    return fn(prisma);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SLOT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a group booking slot (class/session).
   */
  async createSlot({
    serviceId,
    freelancerId,
    date,
    startTime,
    endTime,
    timezone,
    totalCapacity,
    pricePerPersonCents,
  }) {
    const prisma = this._getPrisma();

    const startAtUtc = new Date(`${date}T${startTime}:00Z`);
    const endAtUtc = new Date(`${date}T${endTime}:00Z`);

    return prisma.groupBookingSlot.create({
      data: {
        serviceId,
        freelancerId,
        date,
        startTime,
        endTime,
        startAtUtc,
        endAtUtc,
        timezone: timezone || 'America/Los_Angeles',
        totalCapacity: totalCapacity || 10,
        pricePerPersonCents: pricePerPersonCents || 0,
      },
    });
  }

  /**
   * Get slot by ID with participants and waitlist.
   */
  async getSlot(slotId) {
    const prisma = this._getPrisma();

    return prisma.groupBookingSlot.findUnique({
      where: { id: slotId },
      include: {
        participants: { orderBy: { createdAt: 'asc' } },
        waitlistEntries: { orderBy: { position: 'asc' } },
      },
    });
  }

  /**
   * Get available slots for a service.
   */
  async getAvailableSlots({ serviceId, fromDate, toDate }) {
    const prisma = this._getPrisma();

    return prisma.groupBookingSlot.findMany({
      where: {
        serviceId,
        date: { gte: fromDate, lte: toDate },
        isActive: true,
        isFull: false,
      },
      orderBy: { startAtUtc: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEAT BOOKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Book seats in a group slot.
   * Returns hold if payment pending, confirmed if paid.
   */
  async bookSeats({ slotId, clientId, seatCount = 1, paid = false }) {
    const prisma = this._getPrisma();

    return this._withTx(async (tx) => {
      // Get slot with lock
      const slot = await tx.groupBookingSlot.findUnique({
        where: { id: slotId },
        include: {
          participants: { where: { status: { in: ['held', 'confirmed'] } } },
        },
      });

      if (!slot) {
        return { error: 'Slot not found', code: 'SLOT_NOT_FOUND' };
      }

      if (!slot.isActive) {
        return { error: 'Slot is not active', code: 'SLOT_INACTIVE' };
      }

      // Check existing participation
      const existing = slot.participants.find(p => p.clientId === clientId);
      if (existing) {
        return { error: 'Already booked in this slot', code: 'ALREADY_BOOKED' };
      }

      // Calculate available seats
      const bookedSeats = slot.participants.reduce((sum, p) => sum + p.seatCount, 0);
      const availableSeats = slot.totalCapacity - bookedSeats;

      if (seatCount > availableSeats) {
        return { 
          error: `Only ${availableSeats} seats available`, 
          code: 'INSUFFICIENT_SEATS',
          availableSeats,
        };
      }

      // Create participant
      const holdExpiresAt = paid ? null : new Date(Date.now() + HOLD_EXPIRY_MINUTES * 60 * 1000);
      const status = paid ? 'confirmed' : 'held';

      const participant = await tx.groupParticipant.create({
        data: {
          slotId,
          clientId,
          seatCount,
          status,
          holdExpiresAt,
          paidAmountCents: paid ? slot.pricePerPersonCents * seatCount : 0,
        },
      });

      // Update slot counts
      const newBookedCount = bookedSeats + seatCount;
      const isFull = newBookedCount >= slot.totalCapacity;

      await tx.groupBookingSlot.update({
        where: { id: slotId },
        data: { 
          bookedCount: newBookedCount,
          isFull,
        },
      });

      return {
        success: true,
        participantId: participant.id,
        status: participant.status,
        seatCount,
        holdExpiresAt: participant.holdExpiresAt,
        totalPrice: slot.pricePerPersonCents * seatCount,
        spotsRemaining: slot.totalCapacity - newBookedCount,
      };
    });
  }

  /**
   * Confirm a held booking (after payment).
   */
  async confirmBooking({ participantId, paidAmountCents }) {
    const prisma = this._getPrisma();

    const participant = await prisma.groupParticipant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      return { error: 'Participant not found', code: 'NOT_FOUND' };
    }

    if (participant.status !== 'held') {
      return { error: `Cannot confirm ${participant.status} booking`, code: 'INVALID_STATE' };
    }

    if (participant.holdExpiresAt && new Date() > participant.holdExpiresAt) {
      return { error: 'Hold has expired', code: 'HOLD_EXPIRED' };
    }

    await prisma.groupParticipant.update({
      where: { id: participantId },
      data: {
        status: 'confirmed',
        holdExpiresAt: null,
        paidAmountCents,
      },
    });

    return { success: true, status: 'confirmed' };
  }

  /**
   * Cancel a booking and trigger waitlist promotion.
   */
  async cancelBooking({ participantId, reason = '' }) {
    const prisma = this._getPrisma();

    return this._withTx(async (tx) => {
      const participant = await tx.groupParticipant.findUnique({
        where: { id: participantId },
        include: { slot: true },
      });

      if (!participant) {
        return { error: 'Participant not found', code: 'NOT_FOUND' };
      }

      if (participant.status === 'cancelled') {
        return { error: 'Already cancelled', code: 'ALREADY_CANCELLED' };
      }

      const freedSeats = participant.seatCount;

      // Cancel the participant
      await tx.groupParticipant.update({
        where: { id: participantId },
        data: { status: 'cancelled' },
      });

      // Update slot counts
      const newBookedCount = Math.max(0, participant.slot.bookedCount - freedSeats);
      await tx.groupBookingSlot.update({
        where: { id: participant.slotId },
        data: {
          bookedCount: newBookedCount,
          isFull: false,
        },
      });

      // Trigger waitlist promotion
      const promoted = await this._promoteFromWaitlist(tx, participant.slotId, freedSeats);

      return {
        success: true,
        freedSeats,
        refundEligible: participant.status === 'confirmed',
        paidAmountCents: participant.paidAmountCents,
        waitlistPromoted: promoted.length,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WAITLIST
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Join the waitlist for a full slot.
   */
  async joinWaitlist({ slotId, clientId, seatCount = 1 }) {
    const prisma = this._getPrisma();

    return this._withTx(async (tx) => {
      const slot = await tx.groupBookingSlot.findUnique({
        where: { id: slotId },
      });

      if (!slot) {
        return { error: 'Slot not found', code: 'SLOT_NOT_FOUND' };
      }

      // Check if already on waitlist
      const existing = await tx.waitlistEntry.findUnique({
        where: { slotId_clientId: { slotId, clientId } },
      });

      if (existing) {
        return { error: 'Already on waitlist', code: 'ALREADY_WAITLISTED' };
      }

      // Check if already booked
      const booked = await tx.groupParticipant.findUnique({
        where: { slotId_clientId: { slotId, clientId } },
      });

      if (booked && booked.status !== 'cancelled') {
        return { error: 'Already booked in this slot', code: 'ALREADY_BOOKED' };
      }

      // Get next position
      const lastEntry = await tx.waitlistEntry.findFirst({
        where: { slotId },
        orderBy: { position: 'desc' },
      });
      const position = (lastEntry?.position || 0) + 1;

      const entry = await tx.waitlistEntry.create({
        data: {
          slotId,
          clientId,
          seatCount,
          position,
        },
      });

      return {
        success: true,
        waitlistId: entry.id,
        position,
        seatCount,
      };
    });
  }

  /**
   * Leave the waitlist.
   */
  async leaveWaitlist({ slotId, clientId }) {
    const prisma = this._getPrisma();

    const entry = await prisma.waitlistEntry.findUnique({
      where: { slotId_clientId: { slotId, clientId } },
    });

    if (!entry) {
      return { error: 'Not on waitlist', code: 'NOT_FOUND' };
    }

    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'cancelled' },
    });

    return { success: true };
  }

  /**
   * Get waitlist position for a client.
   */
  async getWaitlistPosition({ slotId, clientId }) {
    const prisma = this._getPrisma();

    const entry = await prisma.waitlistEntry.findUnique({
      where: { slotId_clientId: { slotId, clientId } },
    });

    if (!entry || entry.status !== 'waiting') {
      return null;
    }

    // Count how many are ahead
    const ahead = await prisma.waitlistEntry.count({
      where: {
        slotId,
        status: 'waiting',
        position: { lt: entry.position },
      },
    });

    return {
      position: ahead + 1,
      seatCount: entry.seatCount,
      joinedAt: entry.joinedAt,
    };
  }

  /**
   * Promote waitlisted users when seats become available.
   * Called internally after cancellation.
   */
  async _promoteFromWaitlist(tx, slotId, availableSeats) {
    const promoted = [];

    // Get waiting entries in order
    const waiting = await tx.waitlistEntry.findMany({
      where: { slotId, status: 'waiting' },
      orderBy: { position: 'asc' },
    });

    let seatsToFill = availableSeats;

    for (const entry of waiting) {
      if (seatsToFill <= 0) break;
      if (entry.seatCount > seatsToFill) continue; // Can't fit this person

      // Promote this entry
      const expiresAt = new Date(Date.now() + PROMOTION_EXPIRY_HOURS * 60 * 60 * 1000);

      await tx.waitlistEntry.update({
        where: { id: entry.id },
        data: {
          status: 'promoted',
          promotedAt: new Date(),
          promotionExpiresAt: expiresAt,
        },
      });

      promoted.push({
        clientId: entry.clientId,
        seatCount: entry.seatCount,
        promotionExpiresAt: expiresAt,
      });

      seatsToFill -= entry.seatCount;
    }

    return promoted;
  }

  /**
   * Accept a waitlist promotion (book the seats).
   */
  async acceptPromotion({ waitlistId, paid = false }) {
    const prisma = this._getPrisma();

    return this._withTx(async (tx) => {
      const entry = await tx.waitlistEntry.findUnique({
        where: { id: waitlistId },
      });

      if (!entry) {
        return { error: 'Waitlist entry not found', code: 'NOT_FOUND' };
      }

      if (entry.status !== 'promoted') {
        return { error: 'Not promoted', code: 'NOT_PROMOTED' };
      }

      if (entry.promotionExpiresAt && new Date() > entry.promotionExpiresAt) {
        await tx.waitlistEntry.update({
          where: { id: waitlistId },
          data: { status: 'expired' },
        });
        return { error: 'Promotion has expired', code: 'PROMOTION_EXPIRED' };
      }

      // Book the seats
      const bookResult = await this.bookSeats({
        slotId: entry.slotId,
        clientId: entry.clientId,
        seatCount: entry.seatCount,
        paid,
      });

      if (bookResult.error) {
        return bookResult;
      }

      // Mark waitlist entry as complete
      await tx.waitlistEntry.update({
        where: { id: waitlistId },
        data: { status: 'promoted' }, // Already promoted, booking succeeded
      });

      return bookResult;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Expire held bookings that have passed their expiry time.
   * Called by cron job.
   */
  async expireHeldBookings() {
    const prisma = this._getPrisma();
    const now = new Date();

    const expired = await prisma.groupParticipant.findMany({
      where: {
        status: 'held',
        holdExpiresAt: { lt: now },
      },
      include: { slot: true },
    });

    const results = [];

    for (const participant of expired) {
      const result = await this.cancelBooking({
        participantId: participant.id,
        reason: 'Hold expired',
      });
      results.push({ participantId: participant.id, ...result });
    }

    return { expired: results.length, results };
  }

  /**
   * Expire waitlist promotions that weren't accepted.
   */
  async expirePromotions() {
    const prisma = this._getPrisma();
    const now = new Date();

    const result = await prisma.waitlistEntry.updateMany({
      where: {
        status: 'promoted',
        promotionExpiresAt: { lt: now },
      },
      data: { status: 'expired' },
    });

    return { expired: result.count };
  }
}

module.exports = { GroupBookingService, HOLD_EXPIRY_MINUTES, PROMOTION_EXPIRY_HOURS };
