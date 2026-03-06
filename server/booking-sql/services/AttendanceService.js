/**
 * AttendanceService — Track check-in/check-out for bookings
 * Uses AttendanceRecord model (already in schema)
 */

const { getPrisma } = require('../db/client');

class AttendanceService {
  constructor(deps = {}) {
    this.prisma = deps.prisma || null;
  }

  _getPrisma() {
    if (this.prisma) return this.prisma;
    return getPrisma();
  }

  /**
   * Client checks in to a booking.
   */
  async clientCheckin({ occurrenceId, meta = {} }) {
    const prisma = this._getPrisma();

    const record = await prisma.attendanceRecord.upsert({
      where: { occurrenceId },
      create: {
        occurrenceId,
        status: 'client_arrived',
        clientCheckinAt: new Date(),
        clientCheckinMeta: meta,
      },
      update: {
        clientCheckinAt: new Date(),
        clientCheckinMeta: meta,
        status: 'client_arrived',
      },
    });

    return { success: true, status: record.status, checkinAt: record.clientCheckinAt };
  }

  /**
   * Freelancer checks in (confirms client arrival or starts session).
   */
  async freelancerCheckin({ occurrenceId, meta = {} }) {
    const prisma = this._getPrisma();

    const existing = await prisma.attendanceRecord.findUnique({
      where: { occurrenceId },
    });

    const newStatus = existing?.clientCheckinAt ? 'in_progress' : 'freelancer_ready';

    const record = await prisma.attendanceRecord.upsert({
      where: { occurrenceId },
      create: {
        occurrenceId,
        status: newStatus,
        freelancerCheckinAt: new Date(),
        freelancerCheckinMeta: meta,
      },
      update: {
        freelancerCheckinAt: new Date(),
        freelancerCheckinMeta: meta,
        status: newStatus,
      },
    });

    return { success: true, status: record.status };
  }

  /**
   * Client checks out (leaves/ends session).
   */
  async clientCheckout({ occurrenceId }) {
    const prisma = this._getPrisma();

    const record = await prisma.attendanceRecord.update({
      where: { occurrenceId },
      data: {
        clientCheckoutAt: new Date(),
        status: 'client_left',
      },
    });

    return { success: true, checkoutAt: record.clientCheckoutAt };
  }

  /**
   * Freelancer checks out (ends session officially).
   */
  async freelancerCheckout({ occurrenceId }) {
    const prisma = this._getPrisma();

    const record = await prisma.attendanceRecord.update({
      where: { occurrenceId },
      data: {
        freelancerCheckoutAt: new Date(),
        status: 'completed',
      },
    });

    return { success: true, status: 'completed' };
  }

  /**
   * Mark as no-show (client or freelancer).
   */
  async markNoShow({ occurrenceId, noShowParty }) {
    const prisma = this._getPrisma();

    const status = noShowParty === 'client' ? 'no_show_client' : 'no_show_freelancer';

    await prisma.attendanceRecord.upsert({
      where: { occurrenceId },
      create: { occurrenceId, status, disputeFlag: true },
      update: { status, disputeFlag: true },
    });

    // Also update the occurrence status
    await prisma.bookingOccurrence.update({
      where: { id: occurrenceId },
      data: { status },
    });

    return { success: true, status };
  }

  /**
   * Flag for dispute (attendance disagreement).
   */
  async flagDispute({ occurrenceId, reason }) {
    const prisma = this._getPrisma();

    await prisma.attendanceRecord.update({
      where: { occurrenceId },
      data: {
        disputeFlag: true,
        adminAdjustmentJson: { disputeReason: reason, flaggedAt: new Date() },
      },
    });

    return { success: true };
  }

  /**
   * Get attendance record for an occurrence.
   */
  async getRecord(occurrenceId) {
    const prisma = this._getPrisma();
    return prisma.attendanceRecord.findUnique({ where: { occurrenceId } });
  }

  /**
   * Admin: resolve dispute with adjustment.
   */
  async adminResolve({ occurrenceId, resolution, adminId }) {
    const prisma = this._getPrisma();

    const record = await prisma.attendanceRecord.update({
      where: { occurrenceId },
      data: {
        disputeFlag: false,
        status: resolution.status || 'resolved',
        adminAdjustmentJson: {
          resolvedBy: adminId,
          resolvedAt: new Date(),
          resolution,
        },
      },
    });

    return { success: true, record };
  }
}

module.exports = { AttendanceService };
