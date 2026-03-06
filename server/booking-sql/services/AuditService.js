/**
 * AuditService — Admin timeline replay and audit trail management
 * 
 * Features:
 * - Full booking timeline with all events
 * - Event filtering by type, actor, date range
 * - Admin override actions with audit trail
 * - Dispute evidence packaging
 */

const { getPrisma } = require('../db/client');
const crypto = require('crypto');

class AuditService {
  constructor(deps = {}) {
    this.prisma = deps.prisma || null;
  }

  _getPrisma() {
    if (this.prisma) return this.prisma;
    return getPrisma();
  }

  /**
   * Get full timeline for a booking (all audit events).
   * Used for admin dispute resolution and timeline replay.
   */
  async getBookingTimeline({ bookingId, includePayload = true }) {
    const prisma = this._getPrisma();

    const events = await prisma.auditEvent.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
    });

    return events.map(e => ({
      id: e.id.toString(),
      eventType: e.eventType,
      actorType: e.actorType,
      actorId: e.actorId,
      occurrenceId: e.occurrenceId,
      createdAt: e.createdAt,
      payload: includePayload ? e.payloadJson : undefined,
      payloadHash: e.payloadHash,
    }));
  }

  /**
   * Get timeline with human-readable descriptions.
   */
  async getBookingTimelineFormatted({ bookingId }) {
    const timeline = await this.getBookingTimeline({ bookingId, includePayload: true });

    return timeline.map(event => ({
      ...event,
      description: this._formatEventDescription(event),
      icon: this._getEventIcon(event.eventType),
      severity: this._getEventSeverity(event.eventType),
    }));
  }

  _formatEventDescription(event) {
    const actorLabel = event.actorType === 'system' 
      ? 'System' 
      : `${event.actorType} (${event.actorId})`;

    const descriptions = {
      'booking.created': `${actorLabel} created the booking`,
      'booking.confirmed': `${actorLabel} confirmed the booking`,
      'booking.cancelled': `${actorLabel} cancelled the booking`,
      'booking.rescheduled': `${actorLabel} rescheduled the booking`,
      'booking.completed': `${actorLabel} marked the booking complete`,
      'booking.disputed': `${actorLabel} opened a dispute`,
      'booking.resolved': `${actorLabel} resolved the dispute`,
      'admin.override': `Admin override by ${event.actorId}`,
      'payment.authorized': 'Payment authorized',
      'payment.captured': 'Payment captured',
      'payment.refunded': 'Payment refunded',
      'reminder.sent': 'Reminder sent',
      'attendance.checkin': `${actorLabel} checked in`,
      'attendance.checkout': `${actorLabel} checked out`,
    };

    return descriptions[event.eventType] || `${event.eventType} by ${actorLabel}`;
  }

  _getEventIcon(eventType) {
    const icons = {
      'booking.created': '📝',
      'booking.confirmed': '✅',
      'booking.cancelled': '❌',
      'booking.rescheduled': '🔄',
      'booking.completed': '🎉',
      'booking.disputed': '⚠️',
      'booking.resolved': '✔️',
      'admin.override': '🔧',
      'payment.authorized': '💳',
      'payment.captured': '💰',
      'payment.refunded': '↩️',
      'reminder.sent': '🔔',
      'attendance.checkin': '📍',
      'attendance.checkout': '🚪',
    };
    return icons[eventType] || '📌';
  }

  _getEventSeverity(eventType) {
    if (eventType.includes('cancelled') || eventType.includes('disputed')) return 'warning';
    if (eventType.includes('override') || eventType.includes('refunded')) return 'info';
    if (eventType.includes('completed') || eventType.includes('resolved')) return 'success';
    return 'neutral';
  }

  /**
   * Filter events by criteria.
   */
  async queryEvents({ 
    bookingId = null,
    eventTypes = null,
    actorTypes = null,
    actorId = null,
    fromDate = null,
    toDate = null,
    limit = 100,
    offset = 0,
  }) {
    const prisma = this._getPrisma();

    const where = {};
    if (bookingId) where.bookingId = bookingId;
    if (eventTypes?.length) where.eventType = { in: eventTypes };
    if (actorTypes?.length) where.actorType = { in: actorTypes };
    if (actorId) where.actorId = actorId;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditEvent.count({ where }),
    ]);

    return {
      events: events.map(e => ({
        id: e.id.toString(),
        bookingId: e.bookingId,
        eventType: e.eventType,
        actorType: e.actorType,
        actorId: e.actorId,
        createdAt: e.createdAt,
        payloadHash: e.payloadHash,
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Record an admin override action.
   */
  async recordAdminOverride({ 
    bookingId, 
    occurrenceId = null, 
    adminId, 
    action, 
    reason, 
    changes = {},
  }) {
    const prisma = this._getPrisma();

    const payload = {
      action,
      reason,
      changes,
      timestamp: new Date().toISOString(),
    };

    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    return prisma.auditEvent.create({
      data: {
        bookingId,
        occurrenceId,
        actorType: 'admin',
        actorId: adminId,
        eventType: 'admin.override',
        payloadJson: payload,
        payloadHash,
      },
    });
  }

  /**
   * Package evidence for dispute resolution.
   * Includes full timeline, booking details, and policy snapshots.
   */
  async packageDisputeEvidence({ bookingId }) {
    const prisma = this._getPrisma();

    const [booking, timeline] = await Promise.all([
      prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          occurrences: true,
          chargeRecords: true,
        },
      }),
      this.getBookingTimelineFormatted({ bookingId }),
    ]);

    if (!booking) {
      return { error: 'Booking not found' };
    }

    return {
      booking: {
        id: booking.id,
        bookingRef: booking.bookingRef,
        clientId: booking.clientId,
        freelancerId: booking.freelancerId,
        currentState: booking.currentState,
        createdAt: booking.createdAt,
        policySnapshot: booking.policySnapshotJson,
        pricingSnapshot: booking.pricingSnapshotJson,
      },
      occurrences: booking.occurrences.map(o => ({
        id: o.id,
        occurrenceNo: o.occurrenceNo,
        startAtUtc: o.startAtUtc,
        endAtUtc: o.endAtUtc,
        timezone: o.timezone,
        localStart: o.localStartWallclock,
        localEnd: o.localEndWallclock,
        status: o.status,
      })),
      payments: booking.chargeRecords.map(c => ({
        id: c.id,
        amountCents: c.amountCents,
        state: c.state,
        stripePaymentIntentId: c.stripePaymentIntentId,
        createdAt: c.createdAt,
      })),
      timeline,
      exportedAt: new Date().toISOString(),
      evidenceHash: crypto
        .createHash('sha256')
        .update(JSON.stringify({ booking, timeline }))
        .digest('hex'),
    };
  }

  /**
   * Get audit stats for admin dashboard.
   */
  async getStats({ days = 7 }) {
    const prisma = this._getPrisma();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const eventCounts = await prisma.auditEvent.groupBy({
      by: ['eventType'],
      where: { createdAt: { gte: since } },
      _count: { eventType: true },
    });

    const actorCounts = await prisma.auditEvent.groupBy({
      by: ['actorType'],
      where: { createdAt: { gte: since } },
      _count: { actorType: true },
    });

    return {
      period: `${days} days`,
      since,
      byEventType: Object.fromEntries(
        eventCounts.map(e => [e.eventType, e._count.eventType])
      ),
      byActorType: Object.fromEntries(
        actorCounts.map(a => [a.actorType, a._count.actorType])
      ),
    };
  }

  /**
   * Verify payload integrity (check hash matches).
   */
  async verifyPayloadIntegrity(eventId) {
    const prisma = this._getPrisma();

    const event = await prisma.auditEvent.findUnique({
      where: { id: BigInt(eventId) },
    });

    if (!event) {
      return { valid: false, reason: 'Event not found' };
    }

    const computedHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(event.payloadJson))
      .digest('hex');

    const valid = computedHash === event.payloadHash;

    return {
      valid,
      storedHash: event.payloadHash,
      computedHash,
      reason: valid ? 'Payload integrity verified' : 'Hash mismatch - payload may have been tampered',
    };
  }
}

module.exports = { AuditService };
