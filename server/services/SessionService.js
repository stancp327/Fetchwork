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

// ─── Fee Snapshot ───────────────────────────────────────────────────────────

/**
 * Snapshot the fee breakdown onto a PaymentLedgerEntry when it transitions to held.
 * Called by webhook, confirm-payment, and hold-expiry auto-confirm paths.
 *
 * Non-throwing: returns { ok, error? } so callers can confirm the booking even if
 * the fee snapshot fails. A failed snapshot blocks future release via metadata,
 * not by preventing payment confirmation.
 *
 * @param {string} ledgerEntryId - PaymentLedgerEntry UUID
 * @param {import('@prisma/client').PrismaClient} [txOrPrisma] - Prisma client or transaction
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function snapshotSessionLedgerFees(ledgerEntryId, txOrPrisma) {
  const db = txOrPrisma || getPrisma();
  const snapshotAt = new Date().toISOString();

  try {
    const ledger = await db.paymentLedgerEntry.findUnique({ where: { id: ledgerEntryId } });
    if (!ledger) return { ok: false, error: 'Ledger entry not found' };
    if (ledger.sourceType !== 'session_booking') return { ok: false, error: `Wrong sourceType: ${ledger.sourceType}` };

    // Calculate fee breakdown — sessions use feesIncluded=true so that:
    //   grossAmountCents (what client paid) = platformFeeCents + payoutAmountCents
    // The platform fee comes out of the listed price, not added on top.
    const { computeServiceFeeBreakdown } = require('../routes/services.fees.helpers');
    const listedPriceCents = ledger.grossAmountCents;
    const listedPrice = listedPriceCents / 100; // cents → dollars

    const feeBreakdown = await computeServiceFeeBreakdown({
      clientUserId: ledger.clientId,
      freelancerUserId: ledger.freelancerId,
      listedPrice,
      feesIncluded: true, // sessions: client pays listed price, platform takes cut from it
    });

    const platformFeeCents = Math.round(feeBreakdown.totalPlatformFee * 100);
    const payoutAmountCents = Math.round(feeBreakdown.freelancerPayout * 100);
    const clientFeeCents = Math.round((feeBreakdown.clientFeeAmt || 0) * 100);
    const freelancerFeeCents = Math.round((feeBreakdown.freelancerFeeAmt || 0) * 100);

    // Look up freelancer's Stripe Connect account
    let stripeConnectedAccountId = null;
    try {
      const User = require('../models/User');
      const freelancer = await User.findById(ledger.freelancerId).select('stripeAccountId').lean();
      stripeConnectedAccountId = freelancer?.stripeAccountId || null;
    } catch (userErr) {
      console.warn(`[snapshotSessionLedgerFees] Failed to look up freelancer ${ledger.freelancerId}: ${userErr.message}`);
      // Non-fatal: fee math succeeded, connect account just unknown
    }

    // Build release blocked reasons (if any)
    const releaseBlockReasons = [];
    if (!stripeConnectedAccountId) releaseBlockReasons.push('connect_account_missing');

    // Merge into existing metadata
    const existingMetadata = (ledger.metadata && typeof ledger.metadata === 'object') ? ledger.metadata : {};
    const clientTotalCents = ledger.grossAmountCents; // client pays exactly the listed price
    const updatedMetadata = {
      ...existingMetadata,
      feeSnapshot: {
        status: 'ok',
        snapshotAt,
        listedPriceCents,
        clientTotalCents,
        grossAmountCents: ledger.grossAmountCents,
        platformFeeCents,
        payoutAmountCents,
        clientFeeCents,
        freelancerFeeCents,
        feeHelper: 'computeServiceFeeBreakdown',
        feesIncluded: true,
      },
    };
    // Clear any prior fee_snapshot_failed reason
    if (updatedMetadata.releaseBlockedReason === 'fee_snapshot_failed') {
      delete updatedMetadata.releaseBlockedReason;
    }
    // Set connect_account_missing if applicable
    if (releaseBlockReasons.length > 0) {
      updatedMetadata.releaseBlockedReason = releaseBlockReasons[0];
    }

    await db.paymentLedgerEntry.update({
      where: { id: ledgerEntryId },
      data: {
        platformFeeCents,
        payoutAmountCents,
        stripeConnectedAccountId,
        metadata: updatedMetadata,
      },
    });

    return { ok: true };
  } catch (err) {
    // Fee snapshot failed — record failure in metadata but do NOT throw
    console.warn(`[snapshotSessionLedgerFees] Fee snapshot failed for ledger ${ledgerEntryId}: ${err.message}`);

    try {
      const ledger = await db.paymentLedgerEntry.findUnique({ where: { id: ledgerEntryId } });
      const existingMetadata = (ledger?.metadata && typeof ledger.metadata === 'object') ? ledger.metadata : {};
      await db.paymentLedgerEntry.update({
        where: { id: ledgerEntryId },
        data: {
          metadata: {
            ...existingMetadata,
            feeSnapshot: {
              status: 'failed',
              snapshotAt,
              error: err.message,
              feeHelper: 'computeServiceFeeBreakdown',
            },
            releaseBlockedReason: 'fee_snapshot_failed',
          },
        },
      });
    } catch (metaErr) {
      console.error(`[snapshotSessionLedgerFees] Failed to write failure metadata for ledger ${ledgerEntryId}: ${metaErr.message}`);
    }

    return { ok: false, error: err.message };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Interpret legacy services (null/undefined scheduleType) as DYNAMIC_PRIVATE */
function resolveScheduleType(service) {
  return service?.scheduleType || 'DYNAMIC_PRIVATE';
}

/** Interpret legacy services (null/undefined capacityType) as ONE_ON_ONE */
function resolveCapacityType(service) {
  return service?.capacityType || 'ONE_ON_ONE';
}

/** Map day name to JS getDay() number (0=Sun). Accepts both short and full forms. */
const DAY_NAME_TO_NUM = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

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

      if (days.some(d => dayNames.includes(d.toLowerCase()))) {
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

    // Block paid booking cancellation when ledger feature is off (Gate 16E safety)
    if (process.env.PAID_SESSION_LEDGER_ENABLED !== 'true') {
      const paidLedger = await tx.paymentLedgerEntry.findFirst({
        where: { sourceType: 'session_booking', sourceId: booking.id },
      });
      if (paidLedger) {
        throw new Error('Paid session ledger actions are disabled.');
      }
    }

    // Determine refund eligibility based on cancellation policy
    const now = new Date();
    const hoursUntilStart = (booking.occurrence.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const cancellationHours = booking.occurrence.template?.cancellationHours || 24;
    const refundEligible = hoursUntilStart >= cancellationHours;

    // Session already ended — no cancellation, dispute only
    if (booking.occurrence.endTime < now) {
      throw new Error('Session has ended. Use dispute if applicable.');
    }

    // 1. Update booking status
    await tx.sessionBooking.update({
      where: { id: bookingId },
      data: {
        status: 'cancelled',
        cancelledAt: now,
        cancelReason: opts.cancelReason || null,
      },
    });

    // 2. Decrement seat count and reopen if was full
    await tx.sessionOccurrence.update({
      where: { id: booking.occurrenceId },
      data: {
        bookedCount: { decrement: booking.seats },
        ...(booking.occurrence.status === 'full' ? { status: 'scheduled' } : {}),
      },
    });

    // 3. Handle paid session ledger refund (Gate 16E)
    let ledgerRefund = null;
    if (process.env.PAID_SESSION_LEDGER_ENABLED === 'true') {
      const ledger = await tx.paymentLedgerEntry.findFirst({
        where: { sourceType: 'session_booking', sourceId: booking.id, status: { in: ['held', 'release_pending'] } },
      });

      if (ledger) {
        if (refundEligible) {
          // Full refund — before cancellation cutoff
          if (!ledger.stripePaymentIntentId) {
            ledgerRefund = { error: 'no_payment_intent', refunded: false };
          } else if (ledger.stripeTransferId) {
            ledgerRefund = { error: 'already_transferred', refunded: false };
          } else {
            const stripeService = require('../services/stripeService');
            const idempotencyKey = `session_refund_${ledger.id}`;
            const refund = await stripeService.refundPayment(
              ledger.stripePaymentIntentId,
              ledger.grossAmountCents / 100,
              'requested_by_customer',
              { ledgerEntryId: ledger.id, reason: 'client_cancelled_before_cutoff' },
              { idempotencyKey },
            );

            const existingMeta = (ledger.metadata && typeof ledger.metadata === 'object') ? ledger.metadata : {};
            await tx.paymentLedgerEntry.update({
              where: { id: ledger.id },
              data: {
                status: 'refunded',
                refundedAt: now,
                stripeRefundId: refund.id,
                refundedAmountCents: ledger.grossAmountCents,
                cancelReason: 'client_cancelled_before_cutoff',
                metadata: {
                  ...existingMeta,
                  refundIdempotencyKey: idempotencyKey,
                  refundReason: 'client_cancelled_before_cutoff',
                  cancellationRequestedAt: now.toISOString(),
                  cancelledBy: clientId,
                  previousStatus: ledger.status,
                },
              },
            });
            ledgerRefund = { refunded: true, stripeRefundId: refund.id, amountCents: ledger.grossAmountCents };
          }
        } else {
          // Late cancellation — no auto-refund
          const existingMeta = (ledger.metadata && typeof ledger.metadata === 'object') ? ledger.metadata : {};
          await tx.paymentLedgerEntry.update({
            where: { id: ledger.id },
            data: {
              metadata: {
                ...existingMeta,
                lateCancellationRequestedAt: now.toISOString(),
                lateCancellationReason: opts.cancelReason || 'client_late_cancellation',
                refundEligible: false,
              },
            },
          });
          ledgerRefund = { refunded: false, reason: 'late_cancellation', refundEligible: false };
        }
      }
    }

    return { booking, refundEligible, ledgerRefund };
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
async function cancelOccurrence(occurrenceId, freelancerId, reason, opts = {}) {
  const prisma = getPrisma();

  const occurrence = await prisma.sessionOccurrence.findUnique({ where: { id: occurrenceId } });
  if (!occurrence) throw new Error('Occurrence not found');
  if (occurrence.freelancerId !== freelancerId && !opts.isAdmin) throw new Error('Not authorized');
  if (occurrence.status === 'cancelled') throw new Error('Already cancelled');

  // Block if paid ledgers exist and flag is off (Gate 16E safety)
  if (process.env.PAID_SESSION_LEDGER_ENABLED !== 'true') {
    const activeBookings = await prisma.sessionBooking.findMany({
      where: { occurrenceId, status: { in: ['confirmed', 'waitlisted'] } },
      select: { id: true },
    });
    if (activeBookings.length > 0) {
      const paidLedgerCount = await prisma.paymentLedgerEntry.count({
        where: {
          sourceType: 'session_booking',
          sourceId: { in: activeBookings.map(b => b.id) },
          status: { notIn: ['refunded', 'cancelled', 'failed', 'expired'] },
        },
      });
      if (paidLedgerCount > 0) {
        throw new Error('Paid session ledger actions are disabled.');
      }
    }
  }

  const now = new Date();
  const cancelledBy = opts.isAdmin ? 'admin' : 'freelancer';
  const cancelReasonText = reason || `Cancelled by ${cancelledBy}`;
  const refundReason = opts.isAdmin ? 'admin_cancelled_occurrence' : 'freelancer_cancelled_occurrence';

  // Get affected confirmed bookings before cancelling
  const confirmedBookings = await prisma.sessionBooking.findMany({
    where: { occurrenceId, status: { in: ['confirmed', 'waitlisted'] } },
    select: { id: true, clientId: true },
  });

  const result = await prisma.$transaction([
    prisma.sessionOccurrence.update({
      where: { id: occurrenceId },
      data: { status: 'cancelled', cancelReason: cancelReasonText },
    }),
    prisma.sessionBooking.updateMany({
      where: { occurrenceId, status: { in: ['confirmed', 'waitlisted'] } },
      data: { status: 'cancelled', cancelledAt: now, cancelReason: cancelReasonText },
    }),
  ]);

  // Refund paid session ledgers (Gate 16E)
  let refundedLedgers = 0;
  let refundErrors = [];
  if (process.env.PAID_SESSION_LEDGER_ENABLED === 'true' && confirmedBookings.length > 0) {
    // Only refund if occurrence hasn't started yet
    if (occurrence.startTime > now) {
      const bookingIds = confirmedBookings.map(b => b.id);
      const ledgers = await prisma.paymentLedgerEntry.findMany({
        where: {
          sourceType: 'session_booking',
          sourceId: { in: bookingIds },
          status: { in: ['held', 'release_pending'] },
        },
      });

      const stripeService = require('../services/stripeService');
      for (const ledger of ledgers) {
        try {
          if (!ledger.stripePaymentIntentId) {
            refundErrors.push({ ledgerId: ledger.id, error: 'no_payment_intent' });
            continue;
          }
          if (ledger.stripeTransferId) {
            refundErrors.push({ ledgerId: ledger.id, error: 'already_transferred' });
            continue;
          }
          if (ledger.grossAmountCents <= 0) {
            refundErrors.push({ ledgerId: ledger.id, error: 'zero_amount' });
            continue;
          }

          const idempotencyKey = `session_refund_${ledger.id}`;
          const refund = await stripeService.refundPayment(
            ledger.stripePaymentIntentId,
            ledger.grossAmountCents / 100,
            'requested_by_customer',
            { ledgerEntryId: ledger.id, reason: refundReason },
            { idempotencyKey },
          );

          const existingMeta = (ledger.metadata && typeof ledger.metadata === 'object') ? ledger.metadata : {};
          await prisma.paymentLedgerEntry.update({
            where: { id: ledger.id },
            data: {
              status: 'refunded',
              refundedAt: now,
              stripeRefundId: refund.id,
              refundedAmountCents: ledger.grossAmountCents,
              cancelReason: refundReason,
              metadata: {
                ...existingMeta,
                refundIdempotencyKey: idempotencyKey,
                refundReason,
                cancellationRequestedAt: now.toISOString(),
                cancelledBy,
                previousStatus: ledger.status,
              },
            },
          });
          refundedLedgers++;
        } catch (err) {
          console.error(`[cancelOccurrence] Refund failed for ledger ${ledger.id}: ${err.message}`);
          refundErrors.push({ ledgerId: ledger.id, error: err.message });
        }
      }

      if (refundedLedgers > 0) {
        console.log(`[cancelOccurrence] Refunded ${refundedLedgers} paid session ledger(s) for occurrence ${occurrenceId}`);
      }
    } else {
      console.warn(`[cancelOccurrence] Occurrence ${occurrenceId} already started — skipping auto-refund. Admin review needed.`);
    }
  }

  return { occurrence: result[0], cancelledBookings: result[1].count, refundedLedgers, refundErrors };
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

  let expiredCount = 0;

  for (const hold of expiredHolds) {
    try {
      // Check if this hold has a payment ledger entry
      const ledger = await prisma.paymentLedgerEntry.findFirst({
        where: { sourceType: 'session_booking', sourceId: hold.id },
      });

      // ── No ledger entry: legacy hold, safe to delete ──────────────────
      if (!ledger) {
        await prisma.$transaction(async (tx) => {
          const occ = await tx.sessionOccurrence.findUnique({ where: { id: hold.occurrenceId } });
          if (occ) {
            const newCount = Math.max(0, occ.bookedCount - hold.seats);
            await tx.sessionOccurrence.update({
              where: { id: hold.occurrenceId },
              data: {
                bookedCount: newCount,
                ...(occ.status === 'full' && newCount < occ.maxCapacity ? { status: 'scheduled' } : {}),
              },
            });
          }
          await tx.sessionBooking.delete({ where: { id: hold.id } });
        });
        expiredCount++;
        continue;
      }

      // ── Ledger status: held — money was captured, NEVER delete ────────
      if (ledger.status === 'held') {
        // Booking should already be confirmed; ensure it is
        if (hold.status === 'pending_payment') {
          await prisma.sessionBooking.update({
            where: { id: hold.id },
            data: { status: 'confirmed', holdExpiresAt: null },
          });
          console.warn(`[sessionHoldExpiry] Booking ${hold.id} had ledger=held but was still pending_payment — auto-confirmed`);
        }
        continue; // Do not delete, do not decrement
      }

      // ── Ledger status: failed or expired — safe to delete booking ─────
      if (ledger.status === 'failed' || ledger.status === 'expired') {
        await prisma.$transaction(async (tx) => {
          const occ = await tx.sessionOccurrence.findUnique({ where: { id: hold.occurrenceId } });
          if (occ) {
            const newCount = Math.max(0, occ.bookedCount - hold.seats);
            await tx.sessionOccurrence.update({
              where: { id: hold.occurrenceId },
              data: {
                bookedCount: newCount,
                ...(occ.status === 'full' && newCount < occ.maxCapacity ? { status: 'scheduled' } : {}),
              },
            });
          }
          await tx.sessionBooking.delete({ where: { id: hold.id } });
        });
        expiredCount++;
        continue;
      }

      // ── Ledger status: charging — PI was created, check Stripe status ─
      if (ledger.status === 'charging' && ledger.stripePaymentIntentId) {
        let piStatus;
        try {
          const stripeService = require('../services/stripeService');
          const pi = await stripeService.retrievePaymentIntent(ledger.stripePaymentIntentId);
          piStatus = pi.status;

          // PI succeeded but webhook hasn't arrived — DO NOT DELETE
          if (piStatus === 'succeeded') {
            await prisma.$transaction(async (tx) => {
              await tx.paymentLedgerEntry.update({
                where: { id: ledger.id },
                data: {
                  status: 'held',
                  heldAt: new Date(),
                  stripeChargeId: pi.latest_charge || null,
                },
              });
              await tx.sessionBooking.update({
                where: { id: hold.id },
                data: {
                  status: 'confirmed',
                  holdExpiresAt: null,
                  paidAmount: pi.amount / 100,
                  paymentIntentId: pi.id,
                },
              });
            });
            // Snapshot fees onto ledger (non-blocking — booking is already confirmed)
            const feeResult = await snapshotSessionLedgerFees(ledger.id, prisma);
            if (!feeResult.ok) {
              console.warn(`[sessionHoldExpiry] Fee snapshot failed for ledger ${ledger.id}: ${feeResult.error} — release blocked until admin re-snapshot`);
            }
            console.warn(`[sessionHoldExpiry] Booking ${hold.id} — PI succeeded but webhook was delayed. Auto-confirmed via hold expiry check.`);
            continue; // Do not delete
          }

          // PI still processing — skip this hold, extend expiry by 2 min
          if (piStatus === 'processing') {
            await prisma.sessionBooking.update({
              where: { id: hold.id },
              data: { holdExpiresAt: new Date(Date.now() + 2 * 60 * 1000) },
            });
            console.log(`[sessionHoldExpiry] Booking ${hold.id} — PI still processing, extending hold 2 min`);
            continue; // Skip, try again next cron cycle
          }

          // PI failed/cancelled/requires_payment_method/requires_action — safe to delete
          await prisma.$transaction(async (tx) => {
            await tx.paymentLedgerEntry.update({
              where: { id: ledger.id },
              data: { status: 'expired', failedAt: new Date(), failureReason: `PI status: ${piStatus}` },
            });
            const occ = await tx.sessionOccurrence.findUnique({ where: { id: hold.occurrenceId } });
            if (occ) {
              const newCount = Math.max(0, occ.bookedCount - hold.seats);
              await tx.sessionOccurrence.update({
                where: { id: hold.occurrenceId },
                data: {
                  bookedCount: newCount,
                  ...(occ.status === 'full' && newCount < occ.maxCapacity ? { status: 'scheduled' } : {}),
                },
              });
            }
            await tx.sessionBooking.delete({ where: { id: hold.id } });
          });
          expiredCount++;

        } catch (stripeErr) {
          // Stripe API unreachable — don't delete, skip this hold to be safe
          console.error(`[sessionHoldExpiry] Booking ${hold.id} — Stripe check failed: ${stripeErr.message}. Skipping.`);
          continue;
        }
      } else if (ledger.status === 'charging' && !ledger.stripePaymentIntentId) {
        // Ledger is charging but no PI was stored — PI creation failed between ledger create and PI create
        // Safe to clean up
        await prisma.$transaction(async (tx) => {
          await tx.paymentLedgerEntry.update({
            where: { id: ledger.id },
            data: { status: 'expired', failedAt: new Date(), failureReason: 'No PI created — hold expired' },
          });
          const occ = await tx.sessionOccurrence.findUnique({ where: { id: hold.occurrenceId } });
          if (occ) {
            const newCount = Math.max(0, occ.bookedCount - hold.seats);
            await tx.sessionOccurrence.update({
              where: { id: hold.occurrenceId },
              data: {
                bookedCount: newCount,
                ...(occ.status === 'full' && newCount < occ.maxCapacity ? { status: 'scheduled' } : {}),
              },
            });
          }
          await tx.sessionBooking.delete({ where: { id: hold.id } });
        });
        expiredCount++;
      }
    } catch (holdErr) {
      console.error(`[sessionHoldExpiry] Error processing hold ${hold.id}: ${holdErr.message}`);
    }
  }

  if (expiredCount > 0) {
    console.log(`[SessionService] Expired ${expiredCount} pending_payment session hold(s) (checked ${expiredHolds.length} total)`);
  }
  return expiredCount;
}

// ─── Client Dispute (Gate 16E) ──────────────────────────────────────────────

/**
 * Client disputes a paid session booking within 48 hours after session end.
 * Moves the ledger to 'disputed' which blocks auto-release.
 *
 * @param {string} bookingId - SessionBooking UUID
 * @param {string} clientId - requesting client's ID
 * @param {string} reason - dispute reason (required)
 * @returns {Promise<Object>} Updated ledger entry
 */
async function disputeSessionBooking(bookingId, clientId, reason) {
  if (process.env.PAID_SESSION_LEDGER_ENABLED !== 'true') {
    throw new Error('Paid session features are not enabled');
  }
  if (!reason) throw new Error('Dispute reason is required');

  const prisma = getPrisma();

  const booking = await prisma.sessionBooking.findUnique({
    where: { id: bookingId },
    include: { occurrence: true },
  });

  if (!booking) throw new Error('Booking not found');
  if (booking.clientId !== clientId) throw new Error('Not authorized');

  const now = new Date();

  // Must be after session end
  if (booking.occurrence.endTime > now) {
    throw new Error('Session has not ended yet. Cancel before the session or wait until it ends to dispute.');
  }

  // Must be within 48 hours of session end
  const DISPUTE_WINDOW_MS = 48 * 60 * 60 * 1000;
  const windowEnd = new Date(booking.occurrence.endTime.getTime() + DISPUTE_WINDOW_MS);
  if (now > windowEnd) {
    throw new Error('Dispute window has closed. Disputes must be filed within 48 hours after session end.');
  }

  // Find the ledger entry
  const ledger = await prisma.paymentLedgerEntry.findFirst({
    where: {
      sourceType: 'session_booking',
      sourceId: booking.id,
      status: { in: ['held', 'release_pending'] },
    },
  });

  if (!ledger) {
    throw new Error('No eligible payment found for dispute. Payment may have already been released or refunded.');
  }

  if (ledger.stripeTransferId) {
    throw new Error('Payment has already been transferred. Contact support for post-release disputes.');
  }

  const existingMeta = (ledger.metadata && typeof ledger.metadata === 'object') ? ledger.metadata : {};

  const updated = await prisma.paymentLedgerEntry.update({
    where: { id: ledger.id },
    data: {
      status: 'disputed',
      disputedAt: now,
      metadata: {
        ...existingMeta,
        disputeReason: reason,
        disputedBy: clientId,
        disputedAt: now.toISOString(),
        previousStatus: ledger.status,
      },
    },
  });

  console.log(`[dispute] Client ${clientId} disputed ledger ${ledger.id} for booking ${bookingId}`);
  return updated;
}

// ─── Session Completion + Auto-Release (Gate 16D) ───────────────────────────

/**
 * Move held ledger entries to release_pending for sessions that have ended.
 * Sets releaseAt = occurrence.endTime + 48 hours.
 *
 * Only affects sourceType='session_booking' ledgers in 'held' status
 * whose associated booking's occurrence has ended (endTime < now).
 *
 * @returns {Promise<number>} Number of ledger entries moved to release_pending
 */
async function markCompletedSessionLedgersReleasePending() {
  if (process.env.PAID_SESSION_LEDGER_ENABLED !== 'true') return 0;

  const prisma = getPrisma();
  const now = new Date();
  const RELEASE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

  // Find held session_booking ledger entries
  const heldLedgers = await prisma.paymentLedgerEntry.findMany({
    where: { sourceType: 'session_booking', status: 'held' },
  });

  if (heldLedgers.length === 0) return 0;

  let movedCount = 0;

  for (const ledger of heldLedgers) {
    try {
      // Look up the associated booking to get occurrenceId
      const booking = await prisma.sessionBooking.findUnique({
        where: { id: ledger.sourceId },
        include: { occurrence: { select: { id: true, endTime: true, status: true } } },
      });

      if (!booking || !booking.occurrence) continue;

      // Skip if occurrence hasn't ended yet
      if (booking.occurrence.endTime > now) continue;

      // Skip cancelled occurrences
      if (booking.occurrence.status === 'cancelled') continue;

      // Skip if booking isn't confirmed
      if (booking.status !== 'confirmed') continue;

      const releaseAt = new Date(booking.occurrence.endTime.getTime() + RELEASE_WINDOW_MS);

      // Merge metadata
      const existingMeta = (ledger.metadata && typeof ledger.metadata === 'object') ? ledger.metadata : {};
      const updatedMeta = {
        ...existingMeta,
        releasePendingAt: now.toISOString(),
        releasePendingReason: 'session_completed',
        occurrenceEndTime: booking.occurrence.endTime.toISOString(),
      };

      await prisma.paymentLedgerEntry.update({
        where: { id: ledger.id },
        data: { status: 'release_pending', releaseAt, metadata: updatedMeta },
      });

      // Mark occurrence as completed if still scheduled/full
      if (['scheduled', 'full'].includes(booking.occurrence.status)) {
        // Only if all bookings for this occurrence have been moved
        const remainingHeld = await prisma.paymentLedgerEntry.count({
          where: {
            sourceType: 'session_booking',
            status: 'held',
            sourceId: {
              in: (await prisma.sessionBooking.findMany({
                where: { occurrenceId: booking.occurrence.id, status: 'confirmed' },
                select: { id: true },
              })).map(b => b.id),
            },
          },
        });
        if (remainingHeld === 0) {
          await prisma.sessionOccurrence.update({
            where: { id: booking.occurrence.id },
            data: { status: 'completed' },
          });
        }
      }

      movedCount++;
    } catch (err) {
      console.error(`[sessionCompletion] Error processing ledger ${ledger.id}: ${err.message}`);
    }
  }

  if (movedCount > 0) {
    console.log(`[sessionCompletion] Moved ${movedCount} held ledger(s) to release_pending`);
  }
  return movedCount;
}

/**
 * Auto-release paid session ledger entries whose releaseAt has passed.
 * Uses atomic claim (release_pending → release_processing) to prevent duplicate transfers.
 *
 * @returns {Promise<{ released: number, skipped: number, failed: number }>}
 */
async function autoReleasePendingSessionLedgers() {
  if (process.env.PAID_SESSION_LEDGER_ENABLED !== 'true') return { released: 0, skipped: 0, failed: 0 };

  const prisma = getPrisma();
  const now = new Date();

  // ── Recover stuck release_processing entries (>10 min old) ─────
  const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
  const stuckCutoff = new Date(now.getTime() - STUCK_THRESHOLD_MS);
  const stuckEntries = await prisma.paymentLedgerEntry.findMany({
    where: {
      sourceType: 'session_booking',
      status: 'release_processing',
      releaseAt: { lte: stuckCutoff }, // was eligible before the threshold
    },
  });
  for (const stuck of stuckEntries) {
    // If a transfer was somehow created (crash after Stripe, before DB save),
    // check Stripe with idempotency — the same key will return the same transfer
    const idempotencyKey = `session_release_${stuck.id}`;
    try {
      const stripeService = require('../services/stripeService');
      const transfer = await stripeService.releasePayment(
        stuck.payoutAmountCents / 100,
        stuck.stripeConnectedAccountId,
        stuck.stripePaymentIntentId,
        { idempotencyKey },
      );
      // Idempotent: if transfer already existed, Stripe returns the same one
      const meta = (stuck.metadata && typeof stuck.metadata === 'object') ? stuck.metadata : {};
      const actions = Array.isArray(meta.adminActions) ? meta.adminActions : [];
      await prisma.paymentLedgerEntry.update({
        where: { id: stuck.id },
        data: {
          status: 'released',
          releasedAt: new Date(),
          stripeTransferId: transfer.id,
          releasedAmountCents: stuck.payoutAmountCents,
          releaseEvent: 'auto_release',
          metadata: {
            ...meta,
            adminActions: [...actions, {
              action: 'auto_release_recovery',
              timestamp: new Date().toISOString(),
              stripeObjectId: transfer.id,
              previousStatus: 'release_processing',
              nextStatus: 'released',
              idempotencyKey,
              note: 'Recovered stuck release_processing entry',
            }],
          },
        },
      });
      console.log(`✅ [autoRelease] Recovered stuck ledger ${stuck.id}: transfer ${transfer.id}`);
    } catch (recoverErr) {
      // Stripe failed — revert to release_pending for normal retry
      console.error(`[autoRelease] Stuck recovery failed for ledger ${stuck.id}: ${recoverErr.message}`);
      const meta = (stuck.metadata && typeof stuck.metadata === 'object') ? stuck.metadata : {};
      await prisma.paymentLedgerEntry.update({
        where: { id: stuck.id },
        data: {
          status: 'release_pending',
          metadata: {
            ...meta,
            lastReleaseError: `Stuck recovery: ${recoverErr.message}`,
            lastReleaseAttemptAt: new Date().toISOString(),
            releaseAttemptCount: (meta.releaseAttemptCount || 0) + 1,
          },
        },
      });
    }
  }

  // Find release-eligible entries
  const candidates = await prisma.paymentLedgerEntry.findMany({
    where: {
      sourceType: 'session_booking',
      status: 'release_pending',
      releaseAt: { lte: now },
    },
  });

  if (candidates.length === 0) return { released: 0, skipped: 0, failed: 0 };

  let released = 0, skipped = 0, failed = 0;

  for (const entry of candidates) {
    try {
      // ── Guard checks ──────────────────────────────────────────────
      const meta = entry.metadata || {};

      if (!meta.feeSnapshot || meta.feeSnapshot.status !== 'ok') {
        console.warn(`[autoRelease] Skipping ledger ${entry.id}: fee_snapshot_missing`);
        skipped++;
        continue;
      }
      if (entry.payoutAmountCents <= 0) {
        console.warn(`[autoRelease] Skipping ledger ${entry.id}: payout_zero`);
        skipped++;
        continue;
      }
      if (!entry.stripeConnectedAccountId) {
        console.warn(`[autoRelease] Skipping ledger ${entry.id}: connect_account_missing`);
        skipped++;
        continue;
      }
      if (!entry.stripePaymentIntentId) {
        console.warn(`[autoRelease] Skipping ledger ${entry.id}: stripe_pi_missing`);
        skipped++;
        continue;
      }
      if (entry.stripeTransferId) {
        console.warn(`[autoRelease] Skipping ledger ${entry.id}: transfer_already_exists`);
        skipped++;
        continue;
      }

      // ── Atomic claim: release_pending → release_processing ────────
      // Only one cron instance can claim this entry. If updateMany returns 0,
      // another process already claimed it.
      const claimed = await prisma.paymentLedgerEntry.updateMany({
        where: { id: entry.id, status: 'release_pending' },
        data: { status: 'release_processing' },
      });

      if (claimed.count === 0) {
        // Another cron instance claimed it first
        skipped++;
        continue;
      }

      // ── Execute Stripe Transfer ───────────────────────────────────
      try {
        const stripeService = require('../services/stripeService');
        const idempotencyKey = `session_release_${entry.id}`;
        const transfer = await stripeService.releasePayment(
          entry.payoutAmountCents / 100, // cents → dollars
          entry.stripeConnectedAccountId,
          entry.stripePaymentIntentId, // transfer_group
          { idempotencyKey },
        );

        // ── Success: update to released ─────────────────────────────
        const existingMeta = (entry.metadata && typeof entry.metadata === 'object') ? entry.metadata : {};
        const autoReleaseAction = {
          action: 'auto_release',
          timestamp: new Date().toISOString(),
          stripeObjectId: transfer.id,
          previousStatus: 'release_pending',
          nextStatus: 'released',
          idempotencyKey,
        };
        const actions = Array.isArray(existingMeta.adminActions) ? existingMeta.adminActions : [];

        await prisma.paymentLedgerEntry.update({
          where: { id: entry.id },
          data: {
            status: 'released',
            releasedAt: new Date(),
            stripeTransferId: transfer.id,
            releasedAmountCents: entry.payoutAmountCents,
            releaseEvent: 'auto_release',
            metadata: { ...existingMeta, adminActions: [...actions, autoReleaseAction] },
          },
        });

        console.log(`✅ [autoRelease] Released ledger ${entry.id}: transfer ${transfer.id}, payout $${(entry.payoutAmountCents / 100).toFixed(2)}`);
        released++;
      } catch (stripeErr) {
        // ── Stripe failed: return to release_pending ────────────────
        console.error(`[autoRelease] Stripe transfer failed for ledger ${entry.id}: ${stripeErr.message}`);

        const existingMeta = (entry.metadata && typeof entry.metadata === 'object') ? entry.metadata : {};
        const attemptCount = (existingMeta.releaseAttemptCount || 0) + 1;

        await prisma.paymentLedgerEntry.update({
          where: { id: entry.id },
          data: {
            status: 'release_pending', // return to release_pending for retry
            metadata: {
              ...existingMeta,
              lastReleaseError: stripeErr.message,
              lastReleaseAttemptAt: new Date().toISOString(),
              releaseAttemptCount: attemptCount,
              ...(attemptCount >= 5 ? { releaseBlockedReason: 'max_attempts_exceeded' } : {}),
            },
          },
        });

        failed++;
      }
    } catch (err) {
      console.error(`[autoRelease] Unexpected error for ledger ${entry.id}: ${err.message}`);
      // If we crashed after claiming but before stripe call, return to release_pending
      try {
        await prisma.paymentLedgerEntry.updateMany({
          where: { id: entry.id, status: 'release_processing' },
          data: { status: 'release_pending' },
        });
      } catch (revertErr) {
        console.error(`[autoRelease] Failed to revert claim for ledger ${entry.id}: ${revertErr.message}`);
      }
      failed++;
    }
  }

  if (released > 0 || failed > 0) {
    console.log(`[autoRelease] Summary: ${released} released, ${skipped} skipped, ${failed} failed`);
  }
  return { released, skipped, failed };
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

  // Payment ledger
  snapshotSessionLedgerFees,
  markCompletedSessionLedgersReleasePending,
  autoReleasePendingSessionLedgers,
  disputeSessionBooking,

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
