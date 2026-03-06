const { withTx } = require('../db/tx');
const { acquireSlotLock } = require('../db/locks');
const { BookingRepo } = require('../repos/BookingRepo');
const { AuditRepo } = require('../repos/AuditRepo');
const { IdempotencyRepo } = require('../repos/IdempotencyRepo');
const { PolicyEngine } = require('./PolicyEngine');
const { ServiceAdapter } = require('../repos/ServiceAdapter');

function buildBookingRef() {
  return `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

class BookingService {
  constructor(deps = {}) {
    this.bookingRepo = deps.bookingRepo || new BookingRepo();
    this.auditRepo = deps.auditRepo || new AuditRepo();
    this.idempotencyRepo = deps.idempotencyRepo || new IdempotencyRepo();
    this.policyEngine = deps.policyEngine || new PolicyEngine();
    this.serviceAdapter = deps.serviceAdapter || new ServiceAdapter();
  }

  async createHold({ actorId, route, idempotencyKey, requestHash, body, serviceId }) {
    const existing = await this.idempotencyRepo.findByKey({ idempotencyKey, route, actorId });
    if (existing) {
      return { replayed: true, statusCode: existing.statusCode, response: existing.responseJson };
    }

    const service = await this.serviceAdapter.getById(serviceId);

    if (!service) {
      return {
        replayed: false,
        statusCode: 404,
        response: { error: 'Service not found', code: 'SERVICE_NOT_FOUND' },
      };
    }

    const freelancerId = service.freelancerId;
    if (String(actorId) === freelancerId) {
      return {
        replayed: false,
        statusCode: 400,
        response: { error: 'Cannot book your own service', code: 'SELF_BOOKING_NOT_ALLOWED' },
      };
    }

    const response = await withTx(async (tx) => {
      const localStartWallclock = `${body.date}T${body.startTime}`;
      const localEndWallclock = `${body.date}T${body.endTime}`;
      const maxPerSlot = service.maxPerSlot;

      await acquireSlotLock(tx, {
        freelancerId,
        localStartWallclock,
        serviceId: String(serviceId || ''),
      });

      const conflictCount = await this.bookingRepo.countConflictsAtLocalStart({
        freelancerId,
        localStartWallclock,
      }, tx);

      if (conflictCount >= maxPerSlot) {
        return {
          error: maxPerSlot === 1 ? 'This time slot is already booked' : `This slot is full (${maxPerSlot} spots taken)`,
          code: 'SLOT_CONFLICT',
        };
      }

      const booking = await this.bookingRepo.createBooking({
        bookingRef: buildBookingRef(),
        clientId: String(actorId),
        freelancerId,
        serviceOfferingId: null,
        policySnapshotJson: { tier: service.cancellationTier, snapshotVersion: 1 },
        pricingSnapshotJson: {
          amountCents: service.pricingBaseCents,
          currency: 'usd',
        },
        currentState: 'held',
        notes: body?.notes || null,
      }, tx);

      const occurrence = await this.bookingRepo.createOccurrence({
        bookingId: booking.id,
        occurrenceNo: 1,
        clientId: String(actorId),
        freelancerId,
        startAtUtc: new Date(`${body.date}T${body.startTime}:00Z`),
        endAtUtc: new Date(`${body.date}T${body.endTime}:00Z`),
        timezone: service.timezone,
        localStartWallclock,
        localEndWallclock,
        status: 'held',
      }, tx);

      await this.auditRepo.append({
        bookingId: booking.id,
        occurrenceId: occurrence.id,
        actorType: 'client',
        actorId: String(actorId),
        eventType: 'booking.hold_created',
        payload: { serviceId, route },
      }, tx);

      return {
        message: 'Booking hold created (SQL path)',
        bookingId: booking.id,
        occurrenceId: occurrence.id,
        status: 'held',
      };
    });

    const statusCode = response?.error ? 409 : 201;

    await this.idempotencyRepo.saveResponse({
      idempotencyKey,
      route,
      actorId,
      requestHash,
      responseJson: response,
      statusCode,
    });

    return { replayed: false, statusCode, response };
  }

  async confirmHold({ actorId, route, idempotencyKey, requestHash, bookingId }) {
    const existing = await this.idempotencyRepo.findByKey({ idempotencyKey, route, actorId });
    if (existing) {
      return { replayed: true, statusCode: existing.statusCode, response: existing.responseJson };
    }

    const response = await withTx(async (tx) => {
      const booking = await this.bookingRepo.findBookingById(bookingId, tx);
      if (!booking) {
        return { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' };
      }

      const occurrence = await this.bookingRepo.findFirstOccurrenceByBookingId(booking.id, tx);
      if (!occurrence) {
        return { error: 'Booking occurrence not found', code: 'OCCURRENCE_NOT_FOUND' };
      }

      if (!['held', 'pending_payment'].includes(String(occurrence.status))) {
        return { error: `Cannot confirm a ${occurrence.status} booking`, code: 'INVALID_CONFIRM_STATE' };
      }

      await this.bookingRepo.updateOccurrenceStatus(occurrence.id, 'confirmed', tx);
      await this.bookingRepo.updateBookingState(booking.id, 'confirmed', tx);

      await this.auditRepo.append({
        bookingId: booking.id,
        occurrenceId: occurrence.id,
        actorType: 'freelancer',
        actorId: String(actorId),
        eventType: 'booking.confirmed',
        payload: { route },
      }, tx);

      return {
        message: 'Booking confirmed (SQL path)',
        bookingId: booking.id,
        occurrenceId: occurrence.id,
        status: 'confirmed',
      };
    });

    const statusCode = response?.error
      ? (response.code === 'BOOKING_NOT_FOUND' || response.code === 'OCCURRENCE_NOT_FOUND' ? 404 : 400)
      : 200;

    await this.idempotencyRepo.saveResponse({
      idempotencyKey,
      route,
      actorId,
      requestHash,
      responseJson: response,
      statusCode,
    });

    return { replayed: false, statusCode, response };
  }

  async cancelBooking({ actorId, route, idempotencyKey, requestHash, bookingId, reason = '' }) {
    const existing = await this.idempotencyRepo.findByKey({ idempotencyKey, route, actorId });
    if (existing) return { replayed: true, statusCode: existing.statusCode, response: existing.responseJson };

    const response = await withTx(async (tx) => {
      const booking = await this.bookingRepo.findBookingById(bookingId, tx);
      if (!booking) return { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' };

      const occurrence = await this.bookingRepo.findFirstOccurrenceByBookingId(booking.id, tx);
      if (!occurrence) return { error: 'Booking occurrence not found', code: 'OCCURRENCE_NOT_FOUND' };

      const isClient = String(booking.clientId) === String(actorId);
      const isFreelancer = String(booking.freelancerId) === String(actorId);
      if (!isClient && !isFreelancer) return { error: 'Not authorized', code: 'NOT_AUTHORIZED' };

      if (['completed', 'cancelled_by_client', 'cancelled_by_freelancer', 'no_show_client', 'no_show_freelancer'].includes(String(occurrence.status))) {
        return { error: `Cannot cancel a ${occurrence.status} booking`, code: 'INVALID_CANCEL_STATE' };
      }

      const next = isClient ? 'cancelled_by_client' : 'cancelled_by_freelancer';
      const policyOutcome = this.policyEngine.evaluateCancellation({
        policySnapshot: booking.policySnapshotJson || {},
        bookingAmountCents: Number(booking?.pricingSnapshotJson?.amountCents || 0),
        startAtUtc: occurrence.startAtUtc,
        cancelledAtUtc: new Date(),
      });

      await this.bookingRepo.updateOccurrenceStatus(occurrence.id, next, tx);
      await this.bookingRepo.updateBookingState(booking.id, next, tx);

      await this.auditRepo.append({
        bookingId: booking.id,
        occurrenceId: occurrence.id,
        actorType: isClient ? 'client' : 'freelancer',
        actorId: String(actorId),
        eventType: 'booking.cancelled',
        payload: { route, reason, policyOutcome },
      }, tx);

      return {
        message: 'Booking cancelled (SQL path)',
        bookingId: booking.id,
        occurrenceId: occurrence.id,
        status: next,
        policyOutcome,
      };
    });

    const statusCode = response?.error ? (['BOOKING_NOT_FOUND', 'OCCURRENCE_NOT_FOUND'].includes(response.code) ? 404 : 400) : 200;
    await this.idempotencyRepo.saveResponse({ idempotencyKey, route, actorId, requestHash, responseJson: response, statusCode });
    return { replayed: false, statusCode, response };
  }

  async completeBooking({ actorId, route, idempotencyKey, requestHash, bookingId }) {
    const existing = await this.idempotencyRepo.findByKey({ idempotencyKey, route, actorId });
    if (existing) return { replayed: true, statusCode: existing.statusCode, response: existing.responseJson };

    const response = await withTx(async (tx) => {
      const booking = await this.bookingRepo.findBookingById(bookingId, tx);
      if (!booking) return { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' };

      if (String(booking.freelancerId) !== String(actorId)) {
        return { error: 'Only the freelancer can mark complete', code: 'NOT_AUTHORIZED' };
      }

      const occurrence = await this.bookingRepo.findFirstOccurrenceByBookingId(booking.id, tx);
      if (!occurrence) return { error: 'Booking occurrence not found', code: 'OCCURRENCE_NOT_FOUND' };

      if (!['confirmed', 'in_progress'].includes(String(occurrence.status))) {
        return { error: `Cannot complete a ${occurrence.status} booking`, code: 'INVALID_COMPLETE_STATE' };
      }

      await this.bookingRepo.updateOccurrenceStatus(occurrence.id, 'completed', tx);
      await this.bookingRepo.updateBookingState(booking.id, 'completed', tx);

      await this.auditRepo.append({
        bookingId: booking.id,
        occurrenceId: occurrence.id,
        actorType: 'freelancer',
        actorId: String(actorId),
        eventType: 'booking.completed',
        payload: { route },
      }, tx);

      return { message: 'Booking completed (SQL path)', bookingId: booking.id, occurrenceId: occurrence.id, status: 'completed' };
    });

    const statusCode = response?.error ? (['BOOKING_NOT_FOUND', 'OCCURRENCE_NOT_FOUND'].includes(response.code) ? 404 : 400) : 200;
    await this.idempotencyRepo.saveResponse({ idempotencyKey, route, actorId, requestHash, responseJson: response, statusCode });
    return { replayed: false, statusCode, response };
  }

  /**
   * Reschedule a booking to a new time slot.
   * Validates new slot, checks policy, applies fees if applicable.
   */
  async rescheduleBooking({ 
    actorId, 
    route, 
    idempotencyKey, 
    requestHash, 
    bookingId, 
    newDate, 
    newStartTime, 
    newEndTime,
    reason = '' 
  }) {
    const existing = await this.idempotencyRepo.findByKey({ idempotencyKey, route, actorId });
    if (existing) {
      return { replayed: true, statusCode: existing.statusCode, response: existing.responseJson };
    }

    const response = await withTx(async (tx) => {
      // Get booking and occurrence
      const booking = await this.bookingRepo.findBookingById(bookingId, tx);
      if (!booking) {
        return { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' };
      }

      const occurrence = await this.bookingRepo.findFirstOccurrenceByBookingId(booking.id, tx);
      if (!occurrence) {
        return { error: 'Booking occurrence not found', code: 'OCCURRENCE_NOT_FOUND' };
      }

      // Authorization: client or freelancer can reschedule
      const isClient = String(booking.clientId) === String(actorId);
      const isFreelancer = String(booking.freelancerId) === String(actorId);
      if (!isClient && !isFreelancer) {
        return { error: 'Not authorized', code: 'NOT_AUTHORIZED' };
      }

      // Can only reschedule confirmed or held bookings
      if (!['held', 'confirmed'].includes(String(occurrence.status))) {
        return { 
          error: `Cannot reschedule a ${occurrence.status} booking`, 
          code: 'INVALID_RESCHEDULE_STATE' 
        };
      }

      // Count previous reschedules from audit trail
      const rescheduleCount = await this.auditRepo.countByEventType(booking.id, 'booking.rescheduled', tx);

      // Evaluate reschedule policy
      const policyOutcome = this.policyEngine.evaluateReschedule({
        policySnapshot: booking.policySnapshotJson || {},
        bookingAmountCents: Number(booking?.pricingSnapshotJson?.amountCents || 0),
        startAtUtc: occurrence.startAtUtc,
        rescheduleAtUtc: new Date(),
        rescheduleCount,
      });

      if (!policyOutcome.allowed) {
        return { 
          error: policyOutcome.reason, 
          code: 'RESCHEDULE_NOT_ALLOWED',
          policyOutcome,
        };
      }

      // Build new slot times
      const newLocalStartWallclock = `${newDate}T${newStartTime}`;
      const newLocalEndWallclock = `${newDate}T${newEndTime}`;
      const newStartAtUtc = new Date(`${newDate}T${newStartTime}:00Z`);
      const newEndAtUtc = new Date(`${newDate}T${newEndTime}:00Z`);

      // Acquire lock on new slot
      await acquireSlotLock(tx, {
        freelancerId: booking.freelancerId,
        localStartWallclock: newLocalStartWallclock,
        serviceId: String(booking.serviceOfferingId || ''),
      });

      // Check for conflicts at new slot (excluding current booking)
      const conflictCount = await this.bookingRepo.countConflictsAtLocalStart({
        freelancerId: booking.freelancerId,
        localStartWallclock: newLocalStartWallclock,
        excludeBookingId: booking.id,
      }, tx);

      // Get service to check maxPerSlot
      const service = await this.serviceAdapter.getById(booking.serviceOfferingId);
      const maxPerSlot = service?.maxPerSlot || 1;

      if (conflictCount >= maxPerSlot) {
        return {
          error: 'New time slot is not available',
          code: 'SLOT_CONFLICT',
          policyOutcome,
        };
      }

      // Store old times for audit
      const oldTimes = {
        startAtUtc: occurrence.startAtUtc,
        endAtUtc: occurrence.endAtUtc,
        localStartWallclock: occurrence.localStartWallclock,
        localEndWallclock: occurrence.localEndWallclock,
      };

      // Update occurrence with new times
      await this.bookingRepo.updateOccurrenceTimes(occurrence.id, {
        startAtUtc: newStartAtUtc,
        endAtUtc: newEndAtUtc,
        localStartWallclock: newLocalStartWallclock,
        localEndWallclock: newLocalEndWallclock,
      }, tx);

      // Audit the reschedule
      await this.auditRepo.append({
        bookingId: booking.id,
        occurrenceId: occurrence.id,
        actorType: isClient ? 'client' : 'freelancer',
        actorId: String(actorId),
        eventType: 'booking.rescheduled',
        payload: { 
          route, 
          reason, 
          policyOutcome,
          oldTimes,
          newTimes: {
            startAtUtc: newStartAtUtc,
            endAtUtc: newEndAtUtc,
            localStartWallclock: newLocalStartWallclock,
            localEndWallclock: newLocalEndWallclock,
          },
        },
      }, tx);

      return {
        message: 'Booking rescheduled (SQL path)',
        bookingId: booking.id,
        occurrenceId: occurrence.id,
        status: occurrence.status,
        policyOutcome,
        newTimes: {
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
        },
      };
    });

    const statusCode = response?.error 
      ? (['BOOKING_NOT_FOUND', 'OCCURRENCE_NOT_FOUND'].includes(response.code) ? 404 : 400) 
      : 200;

    await this.idempotencyRepo.saveResponse({
      idempotencyKey,
      route,
      actorId,
      requestHash,
      responseJson: response,
      statusCode,
    });

    return { replayed: false, statusCode, response };
  }
}

module.exports = { BookingService };
