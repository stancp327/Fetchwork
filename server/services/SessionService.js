/**
 * SessionService — Core backend logic for the unified scheduling system.
 *
 * Provides reusable functions for:
 *   - SessionTemplate CRUD
 *   - SessionOccurrence generation (idempotent, conflict-aware)
 *   - SessionBooking (atomic seat management)
 *   - Conflict detection
 *   - Queries by service, freelancer, or template
 *
 * Scheduling modes (on MongoDB Service model):
 *   DYNAMIC_PRIVATE  — SlotEngine generates from availability (legacy default)
 *   FIXED_RECURRING  — SessionTemplate with recurrence pattern
 *   FIXED_ONE_TIME   — Single-event SessionTemplate
 *   REQUEST_BASED    — No scheduling; proposal/quote flow
 *
 * See docs/SCHEDULING_RULES.md for the full hierarchy and conflict rules.
 */

const { getPrisma } = require('../booking-sql/db/client');

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Interpret legacy services (null/undefined scheduleType) as DYNAMIC_PRIVATE */
function resolveScheduleType(service) {
  return service?.scheduleType || 'DYNAMIC_PRIVATE';
}

/** Interpret legacy services (null/undefined capacityType) as ONE_ON_ONE */
function resolveCapacityType(service) {
  return service?.capacityType || 'ONE_ON_ONE';
}

/** Map day name ('Mon','Tue',...) to JS getDay() number (0=Sun) */
const DAY_NAME_TO_NUM = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Parse "HH:MM" to { hours, minutes } */
function parseTime(str) {
  const [h, m] = (str || '00:00').split(':').map(Number);
  return { hours: h || 0, minutes: m || 0 };
}

// ─── Template CRUD ──────────────────────────────────────────────────────────

/**
 * Create a SessionTemplate.
 * @param {Object} data - Template fields
 * @returns {Promise<Object>} Created template
 */
async function createTemplate(data) {
  const prisma = getPrisma();

  const {
    mongoServiceId, freelancerId, title,
    capacityType, scheduleType,
    maxCapacity, durationMinutes, price, currency,
    locationMode, locationAddress, locationNotes,
    recurrenceRule, generationWeeks,
    bookingCutoffHours, cancellationHours,
  } = data;

  if (!mongoServiceId) throw new Error('mongoServiceId is required');
  if (!freelancerId) throw new Error('freelancerId is required');

  const template = await prisma.sessionTemplate.create({
    data: {
      mongoServiceId,
      freelancerId,
      title:              title || null,
      capacityType:       capacityType || 'GROUP',
      scheduleType:       scheduleType || 'FIXED_RECURRING',
      maxCapacity:        maxCapacity || 1,
      durationMinutes:    durationMinutes || 60,
      price:              price != null ? price : null,
      currency:           currency || 'usd',
      locationMode:       locationMode || null,
      locationAddress:    locationAddress || null,
      locationNotes:      locationNotes || null,
      recurrenceRule:     recurrenceRule || null,
      generationWeeks:    generationWeeks || 8,
      bookingCutoffHours: bookingCutoffHours != null ? bookingCutoffHours : 1,
      cancellationHours:  cancellationHours != null ? cancellationHours : 24,
    },
  });

  return template;
}

/**
 * Update an existing template. Only affects the template record — existing
 * occurrences are snapshots and remain unchanged (per scheduling rules).
 */
async function updateTemplate(templateId, freelancerId, updates) {
  const prisma = getPrisma();

  // Verify ownership
  const existing = await prisma.sessionTemplate.findUnique({ where: { id: templateId } });
  if (!existing) throw new Error('Template not found');
  if (existing.freelancerId !== freelancerId) throw new Error('Not authorized');

  // Whitelist updatable fields
  const allowed = [
    'title', 'maxCapacity', 'durationMinutes', 'price', 'currency',
    'locationMode', 'locationAddress', 'locationNotes',
    'recurrenceRule', 'generationWeeks',
    'bookingCutoffHours', 'cancellationHours',
  ];
  const data = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }

  return prisma.sessionTemplate.update({ where: { id: templateId }, data });
}

/**
 * Deactivate a template. Stops future occurrence generation.
 * Existing future occurrences with no bookings are cancelled.
 * Occurrences with bookings remain active (freelancer must cancel manually).
 */
async function deactivateTemplate(templateId, freelancerId) {
  const prisma = getPrisma();

  const existing = await prisma.sessionTemplate.findUnique({ where: { id: templateId } });
  if (!existing) throw new Error('Template not found');
  if (existing.freelancerId !== freelancerId) throw new Error('Not authorized');

  await prisma.$transaction([
    // Deactivate template
    prisma.sessionTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    }),
    // Cancel future unbooked occurrences
    prisma.sessionOccurrence.updateMany({
      where: {
        templateId,
        status: 'scheduled',
        bookedCount: 0,
        startTime: { gt: new Date() },
      },
      data: { status: 'cancelled', cancelReason: 'Template deactivated' },
    }),
  ]);
}

/**
 * Get a template by ID.
 */
async function getTemplate(templateId) {
  return getPrisma().sessionTemplate.findUnique({ where: { id: templateId } });
}

/**
 * List templates for a freelancer, optionally filtered by service.
 */
async function listTemplates(freelancerId, { mongoServiceId, activeOnly = true } = {}) {
  const where = { freelancerId };
  if (mongoServiceId) where.mongoServiceId = mongoServiceId;
  if (activeOnly) where.isActive = true;

  return getPrisma().sessionTemplate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Conflict Detection ─────────────────────────────────────────────────────

/**
 * Check if a freelancer has any scheduling conflict in a time window.
 * Checks both:
 *   - Existing confirmed Bookings (Prisma Booking table)
 *   - Existing active SessionOccurrences
 *
 * @param {string} freelancerId
 * @param {Date} startTime
 * @param {Date} endTime
 * @param {Object} [opts]
 * @param {string} [opts.excludeOccurrenceId] - Exclude a specific occurrence (for edits)
 * @returns {Promise<{hasConflict: boolean, conflicts: Array}>}
 */
async function checkConflict(freelancerId, startTime, endTime, opts = {}) {
  const prisma = getPrisma();
  const conflicts = [];

  // 1. Check SessionOccurrences (priority 3 in hierarchy)
  const sessionConflicts = await prisma.sessionOccurrence.findMany({
    where: {
      freelancerId,
      status: 'scheduled',
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      ...(opts.excludeOccurrenceId ? { id: { not: opts.excludeOccurrenceId } } : {}),
    },
    select: { id: true, startTime: true, endTime: true, templateId: true },
  });

  for (const s of sessionConflicts) {
    conflicts.push({
      type: 'session_occurrence',
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
    });
  }

  // 2. Check existing BookingOccurrences (priority 2 in hierarchy)
  // Time data lives on BookingOccurrence (not Booking). Fields: startAtUtc, endAtUtc.
  // Blocking statuses: held, confirmed, in_progress (matches SlotEngine/OccurrenceRepo).
  const bookingConflicts = await prisma.bookingOccurrence.findMany({
    where: {
      freelancerId,
      status: { in: ['held', 'confirmed', 'in_progress'] },
      startAtUtc: { lt: endTime },
      endAtUtc: { gt: startTime },
    },
    select: { id: true, startAtUtc: true, endAtUtc: true, bookingId: true },
  });

  for (const b of bookingConflicts) {
    conflicts.push({
      type: 'booking_occurrence',
      id: b.id,
      bookingId: b.bookingId,
      startTime: b.startAtUtc,
      endTime: b.endAtUtc,
    });
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

// ─── Occurrence Generation ──────────────────────────────────────────────────

/**
 * Generate occurrences for a single template.
 * Idempotent: uses @@unique([templateId, startTime]) — duplicates are skipped.
 * Conflict-aware: skips dates where freelancer has existing bookings or sessions.
 *
 * @param {string} templateId
 * @returns {Promise<{generated: number, skippedConflict: number, skippedDuplicate: number}>}
 */
async function generateOccurrences(templateId) {
  const prisma = getPrisma();
  const template = await prisma.sessionTemplate.findUnique({ where: { id: templateId } });

  if (!template || !template.isActive) {
    return { generated: 0, skippedConflict: 0, skippedDuplicate: 0 };
  }

  const rule = template.recurrenceRule;
  const isOneTime = template.scheduleType === 'FIXED_ONE_TIME';

  // For one-time events, the recurrenceRule contains { date, startTime, endTime }
  // For recurring, it contains { days, startTime, endTime, timezone }
  if (!rule) return { generated: 0, skippedConflict: 0, skippedDuplicate: 0 };

  const candidates = [];
  const now = new Date();

  if (isOneTime) {
    // Single occurrence from rule.date + rule.startTime
    const start = buildDateTime(rule.date, rule.startTime, rule.timezone);
    const end = buildDateTime(rule.date, rule.endTime, rule.timezone);
    if (start > now) {
      candidates.push({ startTime: start, endTime: end });
    }
  } else {
    // Recurring: generate for each matching day within the generation window
    const weeks = template.generationWeeks || 8;
    const windowEnd = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
    const days = rule.days || []; // e.g. ['Tue', 'Thu']

    // Start from tomorrow (don't generate for today if time has passed)
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() + 1);

    while (cursor <= windowEnd) {
      const dayNum = cursor.getDay(); // 0=Sun
      const dayNames = Object.entries(DAY_NAME_TO_NUM)
        .filter(([, num]) => num === dayNum)
        .map(([name]) => name);

      if (days.some(d => dayNames.includes(d))) {
        const dateStr = cursor.toISOString().split('T')[0]; // "YYYY-MM-DD"
        const start = buildDateTime(dateStr, rule.startTime, rule.timezone);
        const end = buildDateTime(dateStr, rule.endTime, rule.timezone);
        candidates.push({ startTime: start, endTime: end });
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Now attempt to insert each candidate, checking conflicts and idempotency
  let generated = 0;
  let skippedConflict = 0;
  let skippedDuplicate = 0;

  for (const candidate of candidates) {
    // Check for scheduling conflicts (existing bookings + other sessions)
    const { hasConflict } = await checkConflict(
      template.freelancerId,
      candidate.startTime,
      candidate.endTime,
    );

    if (hasConflict) {
      skippedConflict++;
      continue;
    }

    // Attempt insert — unique constraint handles idempotency
    try {
      await prisma.sessionOccurrence.create({
        data: {
          templateId:   template.id,
          freelancerId: template.freelancerId,
          startTime:    candidate.startTime,
          endTime:      candidate.endTime,
          maxCapacity:  template.maxCapacity,
          status:       'scheduled',
        },
      });
      generated++;
    } catch (err) {
      // P2002 = unique constraint violation (already exists)
      if (err.code === 'P2002') {
        skippedDuplicate++;
      } else {
        throw err;
      }
    }
  }

  return { generated, skippedConflict, skippedDuplicate };
}

/**
 * Generate occurrences for ALL active templates.
 * Intended as a cron job entry point. Safe to call repeatedly.
 *
 * @returns {Promise<{templates: number, totalGenerated: number, totalSkipped: number}>}
 */
async function generateAllPending() {
  const prisma = getPrisma();
  const templates = await prisma.sessionTemplate.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  let totalGenerated = 0;
  let totalSkipped = 0;

  for (const t of templates) {
    const result = await generateOccurrences(t.id);
    totalGenerated += result.generated;
    totalSkipped += result.skippedConflict + result.skippedDuplicate;
  }

  return { templates: templates.length, totalGenerated, totalSkipped };
}

/**
 * Build a Date object from a date string, time string, and timezone.
 * e.g. buildDateTime("2026-06-17", "17:00", "America/Los_Angeles")
 */
function buildDateTime(dateStr, timeStr, timezone) {
  const { hours, minutes } = parseTime(timeStr);
  // Create date in the target timezone
  // We build an ISO string and use the timezone offset to adjust
  const naive = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);

  if (timezone) {
    // Use Intl to find the UTC offset for this timezone on this date
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      });
      // Get what the local time would be if we treated naive as UTC
      // Then compute the offset
      const parts = formatter.formatToParts(naive);
      const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
      const localInTz = new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
      const offsetMs = naive.getTime() - localInTz.getTime();
      return new Date(naive.getTime() + offsetMs);
    } catch {
      // Fallback: treat as local time
      return naive;
    }
  }

  return naive;
}

// ─── Seat Booking ───────────────────────────────────────────────────────────

/**
 * Book seat(s) in a session occurrence.
 * Uses atomic increment to prevent overbooking.
 *
 * @param {string} occurrenceId
 * @param {string} clientId
 * @param {Object} [opts]
 * @param {number} [opts.seats=1]
 * @param {Decimal} [opts.paidAmount]
 * @param {string} [opts.paymentIntentId]
 * @returns {Promise<Object>} The created SessionBooking
 * @throws If occurrence is not bookable, is full, or client already booked
 */
async function bookSeat(occurrenceId, clientId, opts = {}) {
  const prisma = getPrisma();
  const seats = opts.seats || 1;

  return prisma.$transaction(async (tx) => {
    // 1. Lock and read the occurrence
    const occurrence = await tx.sessionOccurrence.findUnique({
      where: { id: occurrenceId },
    });

    if (!occurrence) throw new Error('Session not found');
    if (occurrence.status !== 'scheduled') throw new Error('Session is not available for booking');
    if (occurrence.startTime <= new Date()) throw new Error('This session has already started');

    // Check booking cutoff
    const template = await tx.sessionTemplate.findUnique({ where: { id: occurrence.templateId } });
    if (template) {
      const cutoffMs = (template.bookingCutoffHours || 0) * 60 * 60 * 1000;
      if (occurrence.startTime.getTime() - Date.now() < cutoffMs) {
        throw new Error(`Booking closes ${template.bookingCutoffHours} hour(s) before the session`);
      }
    }

    // 2. Check capacity
    const availableSeats = occurrence.maxCapacity - occurrence.bookedCount;
    if (seats > availableSeats) {
      throw new Error(availableSeats === 0 ? 'Session is full' : `Only ${availableSeats} seat(s) remaining`);
    }

    // 3. Atomic increment bookedCount
    const updated = await tx.sessionOccurrence.update({
      where: {
        id: occurrenceId,
        // Extra safety: re-check capacity in the WHERE clause
        bookedCount: { lte: occurrence.maxCapacity - seats },
      },
      data: {
        bookedCount: { increment: seats },
        // Auto-set to full if now at capacity
        status: (occurrence.bookedCount + seats >= occurrence.maxCapacity) ? 'full' : 'scheduled',
      },
    });

    if (!updated) throw new Error('Session is full (concurrent booking)');

    // 4. Create booking record
    const booking = await tx.sessionBooking.create({
      data: {
        occurrenceId,
        clientId,
        seats,
        status: opts.status || 'confirmed',
        paidAmount: opts.paidAmount != null ? opts.paidAmount : null,
        paymentIntentId: opts.paymentIntentId || null,
        holdExpiresAt: opts.holdExpiresAt || null,
      },
    });

    return booking;
  });
}

/**
 * Cancel a session booking. Decrements seat count atomically.
 *
 * @param {string} bookingId
 * @param {string} clientId - Must match the booking owner
 * @param {Object} [opts]
 * @param {string} [opts.cancelReason]
 * @returns {Promise<{booking: Object, refundEligible: boolean}>}
 */
async function cancelBooking(bookingId, clientId, opts = {}) {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const booking = await tx.sessionBooking.findUnique({
      where: { id: bookingId },
      include: { occurrence: { include: { template: true } } },
    });

    if (!booking) throw new Error('Booking not found');
    if (booking.clientId !== clientId) throw new Error('Not authorized');
    if (booking.status === 'cancelled') throw new Error('Booking is already cancelled');

    // Determine refund eligibility based on cancellation policy
    const hoursUntilStart = (booking.occurrence.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const cancellationHours = booking.occurrence.template?.cancellationHours || 24;
    const refundEligible = hoursUntilStart >= cancellationHours;

    // 1. Update booking status
    await tx.sessionBooking.update({
      where: { id: bookingId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: opts.cancelReason || null,
      },
    });

    // 2. Decrement seat count and reopen if was full
    await tx.sessionOccurrence.update({
      where: { id: booking.occurrenceId },
      data: {
        bookedCount: { decrement: booking.seats },
        // If occurrence was full, set back to scheduled
        ...(booking.occurrence.status === 'full' ? { status: 'scheduled' } : {}),
      },
    });

    return { booking, refundEligible };
  });
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Get upcoming occurrences for a service (client-facing).
 * Returns only future, bookable occurrences.
 *
 * @param {string} mongoServiceId
 * @param {Object} [opts]
 * @param {number} [opts.limit=20]
 * @param {Date} [opts.after] - Only occurrences after this date (default: now)
 * @returns {Promise<Array>}
 */
async function getUpcomingByService(mongoServiceId, opts = {}) {
  const prisma = getPrisma();
  const after = opts.after || new Date();
  const limit = opts.limit || 20;

  // Find templates for this service, then their occurrences
  const templates = await prisma.sessionTemplate.findMany({
    where: { mongoServiceId, isActive: true },
    select: { id: true },
  });

  if (templates.length === 0) return [];

  return prisma.sessionOccurrence.findMany({
    where: {
      templateId: { in: templates.map(t => t.id) },
      status: { in: ['scheduled', 'full'] },
      startTime: { gt: after },
    },
    orderBy: { startTime: 'asc' },
    take: limit,
    include: {
      template: {
        select: {
          id: true, title: true, maxCapacity: true, price: true,
          currency: true, durationMinutes: true, locationMode: true,
          locationAddress: true, locationNotes: true, cancellationHours: true,
          bookingCutoffHours: true,
        },
      },
    },
  });
}

/**
 * Get upcoming occurrences for a freelancer (dashboard view).
 * Includes all statuses except completed.
 */
async function getUpcomingByFreelancer(freelancerId, opts = {}) {
  const after = opts.after || new Date();
  const limit = opts.limit || 50;

  return getPrisma().sessionOccurrence.findMany({
    where: {
      freelancerId,
      status: { not: 'completed' },
      startTime: { gt: after },
    },
    orderBy: { startTime: 'asc' },
    take: limit,
    include: {
      template: { select: { id: true, title: true, mongoServiceId: true, maxCapacity: true, price: true } },
      bookings: { where: { status: { not: 'cancelled' } }, select: { id: true, clientId: true, seats: true, status: true } },
    },
  });
}

/**
 * Get a client's session bookings.
 */
async function getClientBookings(clientId, opts = {}) {
  const prisma = getPrisma();
  const { upcoming = true, limit = 20 } = opts;

  return prisma.sessionBooking.findMany({
    where: {
      clientId,
      status: { not: 'cancelled' },
      ...(upcoming ? {
        occurrence: { startTime: { gt: new Date() } },
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      occurrence: {
        include: {
          template: {
            select: { title: true, mongoServiceId: true, locationMode: true, locationAddress: true },
          },
        },
      },
    },
  });
}

/**
 * Get bookings for a specific occurrence (freelancer view).
 */
async function getOccurrenceBookings(occurrenceId, freelancerId) {
  const prisma = getPrisma();

  // Verify ownership
  const occurrence = await prisma.sessionOccurrence.findUnique({
    where: { id: occurrenceId },
    select: { freelancerId: true },
  });
  if (!occurrence) throw new Error('Occurrence not found');
  if (occurrence.freelancerId !== freelancerId) throw new Error('Not authorized');

  return prisma.sessionBooking.findMany({
    where: { occurrenceId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Cancel an occurrence (freelancer action).
 * Sets occurrence to cancelled, cancels all active bookings.
 *
 * @returns {Promise<{occurrence: Object, cancelledBookings: number}>}
 */
async function cancelOccurrence(occurrenceId, freelancerId, reason) {
  const prisma = getPrisma();

  const occurrence = await prisma.sessionOccurrence.findUnique({ where: { id: occurrenceId } });
  if (!occurrence) throw new Error('Occurrence not found');
  if (occurrence.freelancerId !== freelancerId) throw new Error('Not authorized');
  if (occurrence.status === 'cancelled') throw new Error('Already cancelled');

  const result = await prisma.$transaction([
    prisma.sessionOccurrence.update({
      where: { id: occurrenceId },
      data: { status: 'cancelled', cancelReason: reason || 'Cancelled by freelancer' },
    }),
    prisma.sessionBooking.updateMany({
      where: { occurrenceId, status: { in: ['confirmed', 'waitlisted'] } },
      data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'Session cancelled by provider' },
    }),
  ]);

  return { occurrence: result[0], cancelledBookings: result[1].count };
}

/**
 * Get all active session occurrences for a freelancer in a date range.
 * Used by SlotEngine bridge (Gate 4) to subtract session times from availability.
 *
 * @param {string} freelancerId
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @returns {Promise<Array<{startTime: Date, endTime: Date}>>}
 */
async function getSessionBlocks(freelancerId, rangeStart, rangeEnd) {
  return getPrisma().sessionOccurrence.findMany({
    where: {
      freelancerId,
      status: { in: ['scheduled', 'full'] },
      startTime: { lt: rangeEnd },
      endTime: { gt: rangeStart },
    },
    select: { startTime: true, endTime: true },
    orderBy: { startTime: 'asc' },
  });
}

// ─── Exports ────────────────────────────────────────────────────────────────

/**
 * Confirm a paid session booking after Stripe payment succeeds.
 *
 * @param {string} bookingId - SessionBooking UUID
 * @param {string} clientId - Must match booking owner
 * @param {Object} stripePaymentIntent - The retrieved Stripe PI object
 * @returns {Promise<Object>} The updated SessionBooking
 */
async function confirmSessionPayment(bookingId, clientId, stripePaymentIntent) {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const booking = await tx.sessionBooking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) throw new Error('Booking not found');
    if (booking.clientId !== clientId) throw new Error('Not authorized');
    if (booking.status !== 'pending_payment') {
      throw new Error(`Booking status is "${booking.status}", expected "pending_payment"`);
    }

    if (stripePaymentIntent.status !== 'succeeded') {
      throw new Error(`Payment not completed. Stripe status: ${stripePaymentIntent.status}`);
    }

    const updated = await tx.sessionBooking.update({
      where: { id: bookingId },
      data: {
        status: 'confirmed',
        holdExpiresAt: null,
        paidAmount: stripePaymentIntent.amount / 100, // cents → dollars
        paymentIntentId: stripePaymentIntent.id,
      },
    });

    return updated;
  });
}

/**
 * Expire pending_payment session holds that have passed their holdExpiresAt.
 * For each expired hold: decrement bookedCount, reopen occurrence if needed, delete the hold.
 *
 * NOT wired to cron — called manually or by future Gate 7C-B3 cron job.
 *
 * @returns {Promise<number>} Number of expired holds deleted
 */
async function expireSessionHolds() {
  const prisma = getPrisma();
  const now = new Date();

  const expiredHolds = await prisma.sessionBooking.findMany({
    where: {
      status: 'pending_payment',
      holdExpiresAt: { lt: now },
    },
  });

  if (expiredHolds.length === 0) return 0;

  for (const hold of expiredHolds) {
    await prisma.$transaction(async (tx) => {
      // 1. Read current occurrence state
      const occ = await tx.sessionOccurrence.findUnique({
        where: { id: hold.occurrenceId },
      });

      if (occ) {
        const newCount = Math.max(0, occ.bookedCount - hold.seats);
        // Reopen to scheduled if it was full and now has capacity
        const newStatus = (occ.status === 'full' && newCount < occ.maxCapacity)
          ? 'scheduled'
          : occ.status;

        await tx.sessionOccurrence.update({
          where: { id: hold.occurrenceId },
          data: {
            bookedCount: newCount,
            status: newStatus,
          },
        });
      }

      // 2. Delete the expired hold (not cancel — clears unique constraint for retry)
      await tx.sessionBooking.delete({
        where: { id: hold.id },
      });
    });
  }

  console.log(`[SessionService] Expired ${expiredHolds.length} pending_payment session hold(s)`);
  return expiredHolds.length;
}

module.exports = {
  // Helpers
  resolveScheduleType,
  resolveCapacityType,

  // Template CRUD
  createTemplate,
  updateTemplate,
  deactivateTemplate,
  getTemplate,
  listTemplates,

  // Conflict detection
  checkConflict,

  // Occurrence generation
  generateOccurrences,
  generateAllPending,

  // Seat booking
  bookSeat,
  cancelBooking,
  confirmSessionPayment,
  expireSessionHolds,

  // Queries
  getUpcomingByService,
  getUpcomingByFreelancer,
  getClientBookings,
  getOccurrenceBookings,

  // Freelancer actions
  cancelOccurrence,

  // SlotEngine bridge helper (for Gate 4)
  getSessionBlocks,
};
