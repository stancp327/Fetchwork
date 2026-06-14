/**
 * SlotEngine — DST-safe slot generation for booking-sql
 * Uses Luxon for timezone handling; never converts weekly windows to fixed UTC offsets.
 * Integrates with AvailabilityService for hybrid availability (global + service overrides + exceptions).
 */

const { DateTime } = require('luxon');
const { ServiceAdapter } = require('../repos/ServiceAdapter');
const { OccurrenceRepo } = require('../repos/OccurrenceRepo');
const { AvailabilityService } = require('./AvailabilityService');
const { getSessionBlocks } = require('../../services/SessionService');

/**
 * Slot architecture:
 * - DISPLAY_INTERVAL (15 min): spacing between start times shown to users
 * - INTERNAL_PRECISION (5 min): granularity for buffer math
 * - Service duration: how long the appointment actually takes (from service)
 * - Buffer: per-freelancer, in 5-min increments, applied after each booking
 *
 * Collision detection: range-based overlap check. A candidate slot at time T
 * is blocked if ANY existing booking's [start, end + bufferAfter] overlaps
 * with [T - bufferBefore, T + displayInterval].
 *
 * 96 possible start times per 24hr day (at 15-min intervals).
 */

const DISPLAY_INTERVAL = 15;    // minutes between displayed start times
const INTERNAL_PRECISION = 5;   // minutes — buffer granularity

/**
 * Generate time slots from windows for a specific date.
 * Slots are spaced at DISPLAY_INTERVAL (15 min) within each availability window.
 */
function generateSlotsFromWindows({
  windows,
  displayInterval,
  bufferTime,
  bufferBeforeMinutes,
  bufferAfterMinutes,
  dateStr,
  timezone,
  minNoticeHours = 0,
  // Legacy compat: slotDuration treated as displayInterval if displayInterval not set
  slotDuration,
}) {
  const tz = timezone || 'America/Los_Angeles';
  const interval = displayInterval || slotDuration || DISPLAY_INTERVAL;
  const slots = [];
  const nowMs = Date.now();
  const noticeMs = (minNoticeHours || 0) * 3600 * 1000;

  // Resolve effective buffer
  const hasSplitBuffer = (bufferBeforeMinutes ?? 0) > 0 || (bufferAfterMinutes ?? 0) > 0;
  const effectiveBefore = hasSplitBuffer ? (bufferBeforeMinutes ?? 0) : 0;
  const effectiveAfter  = hasSplitBuffer ? (bufferAfterMinutes  ?? 0) : (bufferTime || 0);

  for (const win of windows || []) {
    let cursor = DateTime.fromISO(`${dateStr}T${win.startTime}`, { zone: tz });
    const winEnd = DateTime.fromISO(`${dateStr}T${win.endTime}`, { zone: tz });

    if (!cursor.isValid || !winEnd.isValid) continue;

    while (cursor < winEnd) {
      const slotEnd = cursor.plus({ minutes: interval });

      // DST spring-forward: the hour doesn't exist
      if (!cursor.isValid || !slotEnd.isValid) {
        cursor = cursor.plus({ minutes: interval });
        continue;
      }

      // Don't generate slots that extend past the window end
      if (slotEnd > winEnd) break;

      // Enforce minimum notice window
      if (cursor.toMillis() < nowMs + noticeMs) {
        cursor = cursor.plus({ minutes: interval });
        continue;
      }

      slots.push({
        startTime: cursor.toFormat('HH:mm'),
        endTime: slotEnd.toFormat('HH:mm'),
        startUtc: cursor.toUTC().toISO(),
        endUtc: slotEnd.toUTC().toISO(),
        startLocal: cursor.toISO(),
        endLocal: slotEnd.toISO(),
        displayTime: cursor.toFormat('h:mm a'),
        bufferBeforeMinutes: effectiveBefore,
        bufferAfterMinutes:  effectiveAfter,
      });

      cursor = cursor.plus({ minutes: interval });
    }
  }

  return slots;
}

/**
 * Legacy: Generate slots from weekly schedule (dayOfWeek-filtered).
 * Used when AvailabilityService is not available.
 */
function generateSlots({ windows, slotDuration, displayInterval, bufferTime, dateStr, timezone, minNoticeHours = 0 }) {
  const tz = timezone || 'America/Los_Angeles';
  const localDate = DateTime.fromISO(dateStr, { zone: tz });
  
  if (!localDate.isValid) return [];

  const dayOfWeek = localDate.weekday % 7;
  const dayWindows = (windows || []).filter((w) => w.dayOfWeek === dayOfWeek);
  
  if (!dayWindows.length) return [];

  // Extract just the time windows for this day
  const timeWindows = dayWindows.flatMap(d => 
    d.windows ? d.windows : [{ startTime: d.startTime, endTime: d.endTime }]
  );

  return generateSlotsFromWindows({
    windows: timeWindows,
    displayInterval: displayInterval || slotDuration,
    bufferTime,
    dateStr,
    timezone: tz,
    minNoticeHours,
  });
}

class SlotEngine {
  constructor(deps = {}) {
    this.occurrenceRepo = deps.occurrenceRepo || new OccurrenceRepo();
    this.serviceAdapter = deps.serviceAdapter || new ServiceAdapter();
    this.availabilityService = deps.availabilityService || new AvailabilityService();
    this.useHybridAvailability = deps.useHybridAvailability ?? true;
  }

  /**
   * Get available slots for a service on a specific date.
   * DST-safe: uses IANA timezone, handles spring-forward/fall-back.
   * Hybrid: checks SQL availability (exceptions + overrides) when enabled.
   */
  async getSlotsForServiceDate({ serviceId, date, freelancerId = null }) {
    // Get basic service info from MongoDB (or mock)
    const service = await this.serviceAdapter.getById(serviceId);

    if (!service) {
      return { statusCode: 404, body: { error: 'Service not found' } };
    }

    const effectiveFreelancerId = freelancerId || service.freelancerId;
    let availability = null;
    let windowsResult = null;

    // Try hybrid availability (SQL) first — this is the primary source
    let usingServiceFallback = false;
    if (this.useHybridAvailability) {
      try {
        availability = await this.availabilityService.getResolvedAvailability({
          freelancerId: effectiveFreelancerId,
          serviceId,
        });

        if (availability) {
          windowsResult = await this.availabilityService.getWindowsForDate({
            freelancerId: effectiveFreelancerId,
            serviceId,
            date,
          });
        }
      } catch (e) {
        console.error('[SlotEngine] SQL availability error:', e.message);
        // Fall through to service-level fallback below
      }
    }

    // Only check MongoDB bookingEnabled if we have NO SQL availability
    // (SQL availability has its own isActive flag, checked in getResolvedAvailability)
    if (!availability && !service.bookingEnabled) {
      return { statusCode: 200, body: { slots: [], message: 'Booking not enabled' } };
    }

    // If no SQL availability, fall back to service-level availability windows
    if (!availability && service.availabilityWindows?.length) {
      availability = {
        timezone: service.timezone || 'America/Los_Angeles',
        slotDuration: DISPLAY_INTERVAL,
        bufferTime: service.bufferTime || 0,
        minNoticeHours: service.minNoticeHours || 0,
        maxAdvanceBookingDays: service.maxAdvanceDays || service.maxAdvanceBookingDays || 60,
        capacity: service.maxPerSlot || 1,
        weeklySchedule: service.availabilityWindows,
      };
      usingServiceFallback = true;
    }

    // No availability record anywhere — booking is not configured for this freelancer.
    if (!availability) {
      return { statusCode: 200, body: { slots: [], message: 'Booking not configured for this service' } };
    }

    // All settings come from SQL FreelancerAvailability — no Mongo fallback.
    const tz = availability.timezone || 'America/Los_Angeles';
    // Use service's configured slot duration as the display interval
    // A 60-min service shows hourly starts; a 15-min service shows 15-min starts
    const serviceSlotDuration = availability.slotDuration || service.slotDuration || DISPLAY_INTERVAL;
    const displayInterval = Math.max(serviceSlotDuration, DISPLAY_INTERVAL);
    const bufferTime = availability.bufferTime || 0;
    const bufferBeforeMinutes = availability.bufferBeforeMinutes ?? 0;
    const bufferAfterMinutes  = availability.bufferAfterMinutes  ?? 0;
    const minNoticeHours = availability.minNoticeHours || 0;
    const maxAdvanceDays = availability.maxAdvanceBookingDays || 60;
    const maxPerSlot = availability.capacity || service.maxPerSlot || 1;

    const requestedDate = DateTime.fromISO(date, { zone: tz });
    
    if (!requestedDate.isValid) {
      return { statusCode: 400, body: { error: 'date query param required (YYYY-MM-DD)' } };
    }

    const today = DateTime.now().setZone(tz).startOf('day');
    if (requestedDate < today) {
      return { statusCode: 200, body: { slots: [], message: 'Date is in the past' } };
    }

    const maxDate = today.plus({ days: maxAdvanceDays });
    if (requestedDate > maxDate) {
      return { statusCode: 200, body: { slots: [], message: 'Date too far in advance' } };
    }

    // Check if date is available (exceptions)
    if (windowsResult && !windowsResult.available) {
      return {
        statusCode: 200,
        body: {
          date,
          timezone: tz,
          dayOfWeek: requestedDate.weekday % 7,
          slots: [],
          totalSlots: 0,
          message: windowsResult.reason || 'Not available on this date',
        },
      };
    }

    // Generate slots at 15-min display intervals within availability windows
    let allSlots;
    if (windowsResult?.windows?.length > 0) {
      // Use windows from hybrid availability (already day-filtered)
      allSlots = generateSlotsFromWindows({
        windows: windowsResult.windows,
        displayInterval,
        bufferTime,
        bufferBeforeMinutes,
        bufferAfterMinutes,
        dateStr: date,
        timezone: tz,
        minNoticeHours,
      });
    } else if (availability?.weeklySchedule) {
      // Use weekly schedule from SQL availability
      allSlots = generateSlots({
        windows: availability.weeklySchedule,
        displayInterval,
        bufferTime,
        bufferBeforeMinutes,
        bufferAfterMinutes,
        dateStr: date,
        timezone: tz,
        minNoticeHours,
      });
    } else {
      // No windows configured in SQL — return empty.
      allSlots = [];
    }

    // Query existing bookings for the day
    const startOfDayUtc = requestedDate.startOf('day').toUTC().toJSDate();
    const endOfDayUtc = requestedDate.endOf('day').toUTC().toJSDate();
    
    const booked = await this.occurrenceRepo.findActiveForFreelancerDateRange({
      freelancerId: effectiveFreelancerId,
      dayStartUtc: startOfDayUtc,
      dayEndUtc: endOfDayUtc,
    });

    // Build blocked ranges: each booking blocks [start - bufferBefore, end + bufferAfter]
    const blockedRanges = booked.map(item => {
      const startMs = new Date(item.startAtUtc).getTime();
      const endMs   = new Date(item.endAtUtc).getTime();
      return {
        blockStart: startMs - (bufferBeforeMinutes * 60000),
        blockEnd:   endMs   + (bufferAfterMinutes  * 60000),
        bookingStart: startMs,
        bookingEnd:   endMs,
      };
    });

    // ── SESSION BRIDGE (Gate 4) ───────────────────────────────────────────
    // Fixed session occurrences (group classes, workshops, etc.) block the
    // freelancer's private availability. Only 'scheduled' and 'full' statuses
    // block; 'cancelled' and 'completed' do not. Keyed by freelancerId so
    // a yoga class blocks guitar lesson slots for the same person.
    // To disable: comment out the try block below. Existing booking blocking
    // (above) is unaffected.
    try {
      const sessionBlocks = await getSessionBlocks(
        effectiveFreelancerId,
        startOfDayUtc,
        endOfDayUtc,
      );
      for (const sb of sessionBlocks) {
        const startMs = new Date(sb.startTime).getTime();
        const endMs   = new Date(sb.endTime).getTime();
        blockedRanges.push({
          blockStart:   startMs - (bufferBeforeMinutes * 60000),
          blockEnd:     endMs   + (bufferAfterMinutes  * 60000),
          bookingStart: startMs,
          bookingEnd:   endMs,
        });
      }
    } catch (err) {
      // Non-fatal: if session tables don't exist or query fails, log and
      // continue — private slot generation should not break.
      console.warn('[SlotEngine] Session bridge warning:', err.message);
    }
    // ── END SESSION BRIDGE ──────────────────────────────────────────────

    // A candidate slot is available if it doesn't overlap with any blocked range.
    // Overlap: slot [startUtc, endUtc] intersects blocked [blockStart, blockEnd]
    // Count overlapping bookings per slot (for capacity/maxPerSlot support)
    const slots = allSlots
      .map((s) => {
        const sStart = new Date(s.startUtc).getTime();
        const sEnd   = new Date(s.endUtc).getTime();
        // Count how many bookings overlap this slot's time range
        let overlaps = 0;
        for (const br of blockedRanges) {
          // Two ranges overlap if one starts before the other ends
          if (sStart < br.blockEnd && sEnd > br.blockStart) {
            overlaps++;
          }
        }
        const spotsLeft = Math.max(0, maxPerSlot - overlaps);
        return { ...s, spotsLeft, totalSpots: maxPerSlot };
      })
      .filter((s) => s.spotsLeft > 0);

    return {
      statusCode: 200,
      body: {
        date,
        timezone: tz,
        dayOfWeek: requestedDate.weekday % 7,
        slots,
        totalSlots: allSlots.length,
        slotDurationMinutes: serviceSlotDuration,
        source: windowsResult?.source || (usingServiceFallback ? 'service_fallback' : 'hybrid'),
      },
    };
  }

  /**
   * Validate that a proposed slot is actually available.
   * Prevents slot injection attacks.
   */
  async validateSlot({ serviceId, date, startTime, endTime, freelancerId = null }) {
    const result = await this.getSlotsForServiceDate({ serviceId, date, freelancerId });
    
    if (result.statusCode !== 200) {
      return { valid: false, reason: result.body.error || result.body.message };
    }

    const slot = result.body.slots.find(
      s => s.startTime === startTime && s.endTime === endTime
    );

    if (!slot) {
      return { valid: false, reason: 'Slot not available' };
    }

    return { valid: true, slot };
  }

  /**
   * Get slots for a date range (calendar view).
   */
  async getSlotsForDateRange({ serviceId, fromDate, toDate, freelancerId = null }) {
    const results = [];
    let cursor = DateTime.fromISO(fromDate);
    const end = DateTime.fromISO(toDate);

    while (cursor <= end) {
      const dateStr = cursor.toFormat('yyyy-MM-dd');
      const dayResult = await this.getSlotsForServiceDate({
        serviceId,
        date: dateStr,
        freelancerId,
      });

      results.push({
        date: dateStr,
        displayDate: cursor.toFormat('EEE, MMM d'),
        dayOfWeek: cursor.weekday % 7,
        available: dayResult.body.slots?.length > 0,
        slotsCount: dayResult.body.slots?.length || 0,
        message: dayResult.body.message,
      });

      cursor = cursor.plus({ days: 1 });
    }

    return { statusCode: 200, body: { dates: results } };
  }
}

module.exports = { SlotEngine, generateSlots, generateSlotsFromWindows };
