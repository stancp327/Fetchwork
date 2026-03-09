/**
 * RecurringSeriesService — Weekly/biweekly/monthly recurring booking schedules
 *
 * Design:
 * - One Booking per series (master record, already confirmed)
 * - Multiple BookingOccurrences under that booking (one per recurrence date)
 * - RecurringSeries stores the schedule definition
 * - Occurrences are generated eagerly up to GENERATE_AHEAD_DAYS from today
 *
 * Frequency → intervalDays:
 *   weekly    → 7
 *   biweekly  → 14
 *   monthly   → uses calendar month arithmetic (not fixed days)
 *   custom    → caller supplies intervalDays
 */

const { DateTime } = require('luxon');
const { getPrisma } = require('../db/client');

// How far ahead to pre-generate occurrences
const GENERATE_AHEAD_DAYS = 60;

// Max occurrences per series (safety cap)
const MAX_OCCURRENCES_HARD_CAP = 104; // 2 years weekly

const FREQUENCY_INTERVAL = {
  weekly:   7,
  biweekly: 14,
};

class RecurringSeriesService {
  constructor(deps = {}) {
    this.prisma = deps.prisma || null;
  }

  _getPrisma() {
    return this.prisma || getPrisma();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE SERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a recurring series from an existing confirmed booking.
   * The first occurrence is the booking's current occurrence (already created).
   * Subsequent occurrences are generated up to GENERATE_AHEAD_DAYS.
   *
   * @param {object} params
   * @param {string} params.bookingId  - Existing confirmed booking
   * @param {string} params.frequency  - weekly | biweekly | monthly | custom
   * @param {number} [params.intervalDays] - Required for custom, overrides for others
   * @param {string} params.startDate  - YYYY-MM-DD (first occurrence date)
   * @param {string} params.startTime  - HH:MM wallclock
   * @param {string} params.endTime    - HH:MM wallclock
   * @param {string} params.timezone
   * @param {string} [params.endDate]  - YYYY-MM-DD or null
   * @param {number} [params.maxOccurrences] - Hard cap on occurrences
   */
  async createSeries({
    bookingId,
    frequency,
    intervalDays: customInterval,
    startDate,
    startTime,
    endTime,
    timezone,
    endDate = null,
    maxOccurrences = null,
  }) {
    const prisma = this._getPrisma();

    // Validate frequency
    const validFrequencies = ['weekly', 'biweekly', 'monthly', 'custom'];
    if (!validFrequencies.includes(frequency)) {
      return { error: `frequency must be one of: ${validFrequencies.join(', ')}`, code: 'INVALID_FREQUENCY' };
    }
    if (frequency === 'custom' && !customInterval) {
      return { error: 'intervalDays is required for custom frequency', code: 'MISSING_INTERVAL' };
    }

    const intervalDays = frequency === 'monthly' ? null
      : frequency === 'custom' ? customInterval
      : FREQUENCY_INTERVAL[frequency];

    // Verify booking exists and is confirmed
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { occurrences: { orderBy: { occurrenceNo: 'asc' } } },
    });

    if (!booking) return { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' };
    if (booking.recurringSeries) return { error: 'Booking already has a recurring series', code: 'ALREADY_RECURRING' };

    const cap = maxOccurrences
      ? Math.min(maxOccurrences, MAX_OCCURRENCES_HARD_CAP)
      : MAX_OCCURRENCES_HARD_CAP;

    // Create series record
    const series = await prisma.recurringSeries.create({
      data: {
        bookingId,
        frequency,
        intervalDays: intervalDays || 0,
        startDate,
        endDate,
        maxOccurrences: cap,
        startTime,
        endTime,
        timezone,
        status: 'active',
        generatedCount: 0,
      },
    });

    // Link existing first occurrence to this series
    if (booking.occurrences.length > 0) {
      await prisma.bookingOccurrence.update({
        where: { id: booking.occurrences[0].id },
        data: { seriesId: series.id },
      });
    }

    // Generate upcoming occurrences
    const generated = await this._generateOccurrences({
      seriesId: series.id,
      booking,
      series: { ...series, generatedCount: booking.occurrences.length > 0 ? 1 : 0 },
      prisma,
    });

    return {
      success: true,
      seriesId: series.id,
      frequency,
      intervalDays: intervalDays || null,
      startDate,
      endDate,
      generatedCount: generated.length + (booking.occurrences.length > 0 ? 1 : 0),
      nextOccurrences: generated.slice(0, 3).map(o => o.localStartWallclock),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERATE OCCURRENCES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate upcoming occurrences for a series up to GENERATE_AHEAD_DAYS from now.
   * Called internally on create and by a cron to top up near-expiring series.
   */
  async _generateOccurrences({ seriesId, booking, series, prisma: txPrisma }) {
    const prisma = txPrisma || this._getPrisma();

    const tz = series.timezone;
    const today = DateTime.now().setZone(tz).startOf('day');
    const horizon = today.plus({ days: GENERATE_AHEAD_DAYS });

    // Find the latest existing occurrence date
    const latestOccurrence = await prisma.bookingOccurrence.findFirst({
      where: { seriesId },
      orderBy: { startAtUtc: 'desc' },
    });

    const latestDate = latestOccurrence
      ? DateTime.fromJSDate(latestOccurrence.startAtUtc).setZone(tz)
      : DateTime.fromISO(series.startDate, { zone: tz }).minus({ days: series.intervalDays || 7 });

    // Get current occurrence count for numbering
    const currentCount = await prisma.bookingOccurrence.count({
      where: { bookingId: booking.id },
    });

    const occurrenceData = [];
    let nextDate = this._nextDate(latestDate, series);
    let occurrenceNo = currentCount + 1;

    while (nextDate <= horizon) {
      // Check end date
      if (series.endDate) {
        const end = DateTime.fromISO(series.endDate, { zone: tz });
        if (nextDate > end) break;
      }

      // Check max occurrences
      if (series.maxOccurrences && occurrenceNo > series.maxOccurrences) break;

      // Check cancelledFromDate
      if (series.cancelledFromDate) {
        const cancelFrom = DateTime.fromISO(series.cancelledFromDate, { zone: tz });
        if (nextDate >= cancelFrom) break;
      }

      const dateStr = nextDate.toFormat('yyyy-MM-dd');
      const startAtUtc = DateTime.fromISO(`${dateStr}T${series.startTime}`, { zone: tz }).toUTC().toJSDate();
      const endAtUtc   = DateTime.fromISO(`${dateStr}T${series.endTime}`,   { zone: tz }).toUTC().toJSDate();

      occurrenceData.push({
        bookingId: booking.id,
        seriesId,
        occurrenceNo,
        clientId:     booking.clientId,
        freelancerId: booking.freelancerId,
        startAtUtc,
        endAtUtc,
        timezone:             tz,
        localStartWallclock:  `${dateStr}T${series.startTime}`,
        localEndWallclock:    `${dateStr}T${series.endTime}`,
        status:               'confirmed',
      });

      occurrenceNo++;
      nextDate = this._nextDate(nextDate, series);
    }

    // Single batch insert
    if (occurrenceData.length > 0) {
      await prisma.bookingOccurrence.createMany({ data: occurrenceData });

      const lastEntry = occurrenceData[occurrenceData.length - 1];
      const lastDate = this._nextDate(
        DateTime.fromJSDate(lastEntry.startAtUtc).setZone(tz),
        series
      );
      await prisma.recurringSeries.update({
        where: { id: seriesId },
        data: {
          generatedThrough: lastDate.minus({ days: 1 }).toFormat('yyyy-MM-dd'),
          generatedCount:   { increment: occurrenceData.length },
        },
      });
    }

    return occurrenceData;
  }

  /**
   * Calculate the next date after `current` for a given series.
   */
  _nextDate(current, series) {
    if (series.frequency === 'monthly') {
      return current.plus({ months: 1 });
    }
    return current.plus({ days: series.intervalDays });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SERIES OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get series details with all occurrences.
   */
  async getSeriesDetails(seriesId) {
    const prisma = this._getPrisma();

    const series = await prisma.recurringSeries.findUnique({
      where: { id: seriesId },
      include: {
        occurrences: {
          orderBy: { startAtUtc: 'asc' },
        },
        booking: {
          select: { id: true, bookingRef: true, clientId: true, freelancerId: true, currentState: true },
        },
      },
    });

    if (!series) return null;
    return series;
  }

  /**
   * Skip a specific occurrence in the series (mark as skipped, not cancelled).
   */
  async skipOccurrence({ seriesId, occurrenceId, reason = '' }) {
    const prisma = this._getPrisma();

    const occurrence = await prisma.bookingOccurrence.findUnique({
      where: { id: occurrenceId },
    });

    if (!occurrence) return { error: 'Occurrence not found', code: 'NOT_FOUND' };
    if (occurrence.seriesId !== seriesId) return { error: 'Occurrence does not belong to this series', code: 'SERIES_MISMATCH' };
    if (occurrence.skipped) return { error: 'Already skipped', code: 'ALREADY_SKIPPED' };

    await prisma.bookingOccurrence.update({
      where: { id: occurrenceId },
      data: { skipped: true, status: 'cancelled_by_client' },
    });

    return { success: true, occurrenceId, reason };
  }

  /**
   * Cancel all occurrences from a given date forward (keep past ones intact).
   */
  async cancelFromDate({ seriesId, fromDate, reason = '', actorId }) {
    const prisma = this._getPrisma();

    const series = await prisma.recurringSeries.findUnique({ where: { id: seriesId } });
    if (!series) return { error: 'Series not found', code: 'NOT_FOUND' };
    if (series.status === 'cancelled') return { error: 'Series already cancelled', code: 'ALREADY_CANCELLED' };

    const cancelFromDt = DateTime.fromISO(fromDate, { zone: series.timezone }).toUTC().toJSDate();

    // Cancel future occurrences
    const cancelled = await prisma.bookingOccurrence.updateMany({
      where: {
        seriesId,
        startAtUtc: { gte: cancelFromDt },
        status: { notIn: ['cancelled_by_client', 'cancelled_by_freelancer', 'completed'] },
      },
      data: { status: actorId ? 'cancelled_by_client' : 'cancelled_by_freelancer' },
    });

    // Mark series as cancelled from that date
    await prisma.recurringSeries.update({
      where: { id: seriesId },
      data: {
        cancelledFromDate: fromDate,
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });

    return {
      success: true,
      cancelledFromDate: fromDate,
      occurrencesCancelled: cancelled.count,
    };
  }

  /**
   * Cancel the entire series (all future occurrences).
   */
  async cancelSeries({ seriesId, reason = '', actorId }) {
    const prisma = this._getPrisma();

    const series = await prisma.recurringSeries.findUnique({ where: { id: seriesId } });
    if (!series) return { error: 'Series not found', code: 'NOT_FOUND' };

    const today = DateTime.now().toUTC().toJSDate();

    const cancelled = await prisma.bookingOccurrence.updateMany({
      where: {
        seriesId,
        startAtUtc: { gte: today },
        status: { notIn: ['cancelled_by_client', 'cancelled_by_freelancer', 'completed'] },
      },
      data: { status: 'cancelled_by_client' },
    });

    await prisma.recurringSeries.update({
      where: { id: seriesId },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    return {
      success: true,
      seriesId,
      occurrencesCancelled: cancelled.count,
    };
  }

  /**
   * Pause a series (stop generating new occurrences, don't cancel existing).
   */
  async pauseSeries(seriesId) {
    const prisma = this._getPrisma();

    const series = await prisma.recurringSeries.findUnique({ where: { id: seriesId } });
    if (!series) return { error: 'Series not found', code: 'NOT_FOUND' };
    if (series.status !== 'active') return { error: `Cannot pause a ${series.status} series`, code: 'INVALID_STATE' };

    await prisma.recurringSeries.update({
      where: { id: seriesId },
      data: { status: 'paused' },
    });

    return { success: true, status: 'paused' };
  }

  /**
   * Resume a paused series and generate new occurrences.
   */
  async resumeSeries(seriesId) {
    const prisma = this._getPrisma();

    const series = await prisma.recurringSeries.findUnique({
      where: { id: seriesId },
      include: { booking: true },
    });
    if (!series) return { error: 'Series not found', code: 'NOT_FOUND' };
    if (series.status !== 'paused') return { error: `Cannot resume a ${series.status} series`, code: 'INVALID_STATE' };

    await prisma.recurringSeries.update({
      where: { id: seriesId },
      data: { status: 'active' },
    });

    const generated = await this._generateOccurrences({
      seriesId,
      booking: series.booking,
      series: { ...series, status: 'active' },
    });

    return {
      success: true,
      status: 'active',
      newOccurrencesGenerated: generated.length,
    };
  }

  /**
   * Top up occurrences for all active series approaching their horizon.
   * Called by a daily cron job.
   */
  async topUpAllActiveSeries() {
    const prisma = this._getPrisma();
    const horizon = DateTime.now().plus({ days: GENERATE_AHEAD_DAYS - 7 }).toFormat('yyyy-MM-dd');

    // Find series that need topping up
    const series = await prisma.recurringSeries.findMany({
      where: {
        status: 'active',
        OR: [
          { generatedThrough: null },
          { generatedThrough: { lte: horizon } },
        ],
      },
      include: { booking: true },
      take: 50,
    });

    const results = [];
    for (const s of series) {
      const generated = await this._generateOccurrences({
        seriesId: s.id,
        booking: s.booking,
        series: s,
      });
      if (generated.length > 0) {
        results.push({ seriesId: s.id, generated: generated.length });
      }
    }

    return { seriesChecked: series.length, seriesUpdated: results.length, results };
  }
}

module.exports = { RecurringSeriesService, GENERATE_AHEAD_DAYS };
