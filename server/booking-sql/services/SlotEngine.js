/**
 * SlotEngine — DST-safe slot generation for booking-sql
 * Uses Luxon for timezone handling; never converts weekly windows to fixed UTC offsets.
 * Integrates with AvailabilityService for hybrid availability (global + service overrides + exceptions).
 */

const { DateTime } = require('luxon');
const { ServiceAdapter } = require('../repos/ServiceAdapter');
const { OccurrenceRepo } = require('../repos/OccurrenceRepo');
const { AvailabilityService } = require('./AvailabilityService');

/**
 * Generate time slots from windows for a specific date.
 * @param {Object} params
 * @param {Array} params.windows - time windows [{startTime, endTime}]
 * @param {number} params.slotDuration - minutes per slot
 * @param {number} params.bufferTime - minutes between slots
 * @param {string} params.dateStr - "YYYY-MM-DD"
 * @param {string} params.timezone - IANA timezone
 * @param {number} params.minNoticeHours - minimum booking notice (default 0)
 * @returns {Array} slot objects
 */
function generateSlotsFromWindows({ windows, slotDuration, bufferTime, dateStr, timezone, minNoticeHours = 0 }) {
  const tz = timezone || 'America/Los_Angeles';
  const slots = [];
  const nowMs = Date.now();
  const noticeMs = (minNoticeHours || 0) * 3600 * 1000;

  for (const win of windows || []) {
    let cursor = DateTime.fromISO(`${dateStr}T${win.startTime}`, { zone: tz });
    const winEnd = DateTime.fromISO(`${dateStr}T${win.endTime}`, { zone: tz });

    if (!cursor.isValid || !winEnd.isValid) continue;

    while (true) {
      const slotEnd = cursor.plus({ minutes: slotDuration });
      if (slotEnd > winEnd) break;

      // DST spring-forward: the hour doesn't exist
      if (!cursor.isValid || !slotEnd.isValid) {
        cursor = slotEnd.plus({ minutes: bufferTime });
        continue;
      }

      // Enforce minimum notice window
      if (cursor.toMillis() < nowMs + noticeMs) {
        cursor = slotEnd.plus({ minutes: bufferTime });
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
      });

      cursor = slotEnd.plus({ minutes: bufferTime });
    }
  }

  return slots;
}

/**
 * Legacy: Generate slots from weekly schedule (dayOfWeek-filtered).
 * Used when AvailabilityService is not available.
 */
function generateSlots({ windows, slotDuration, bufferTime, dateStr, timezone, minNoticeHours = 0 }) {
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
    slotDuration,
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
    if (!service.bookingEnabled) {
      return { statusCode: 200, body: { slots: [], message: 'Booking not enabled' } };
    }

    const effectiveFreelancerId = freelancerId || service.freelancerId;
    let availability = null;
    let windowsResult = null;

    // Try hybrid availability (SQL) first
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
        // Fall back to service-based availability if SQL fails
        console.warn('[SlotEngine] Hybrid availability failed, using service fallback:', e.message);
      }
    }

    // Determine settings: hybrid or service fallback
    const tz = availability?.timezone || service.timezone || 'America/Los_Angeles';
    const slotDuration = availability?.slotDuration || service.slotDuration || 60;
    const bufferTime = availability?.bufferTime || service.bufferTime || 0;
    const minNoticeHours = availability?.minNoticeHours || service.minNoticeHours || 0;
    const maxAdvanceDays = availability?.maxAdvanceBookingDays || service.maxAdvanceDays || 60;
    const maxPerSlot = availability?.capacity || service.maxPerSlot || 1;

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

    // Generate slots
    let allSlots;
    if (windowsResult?.windows?.length > 0) {
      // Use windows from hybrid availability (already day-filtered)
      allSlots = generateSlotsFromWindows({
        windows: windowsResult.windows,
        slotDuration,
        bufferTime,
        dateStr: date,
        timezone: tz,
        minNoticeHours,
      });
    } else if (availability?.weeklySchedule) {
      // Use weekly schedule from hybrid availability
      allSlots = generateSlots({
        windows: availability.weeklySchedule,
        slotDuration,
        bufferTime,
        dateStr: date,
        timezone: tz,
        minNoticeHours,
      });
    } else {
      // Fallback to service availability windows
      allSlots = generateSlots({
        windows: service.availabilityWindows,
        slotDuration: service.slotDuration || 60,
        bufferTime: service.bufferTime || 0,
        dateStr: date,
        timezone: tz,
        minNoticeHours: service.minNoticeHours || 0,
      });
    }

    // Query existing bookings
    const startOfDayUtc = requestedDate.startOf('day').toUTC().toJSDate();
    const endOfDayUtc = requestedDate.endOf('day').toUTC().toJSDate();
    
    const booked = await this.occurrenceRepo.findActiveForFreelancerDateRange({
      freelancerId: effectiveFreelancerId,
      dayStartUtc: startOfDayUtc,
      dayEndUtc: endOfDayUtc,
    });

    // Count bookings per slot
    const bookedCounts = {};
    for (const item of booked) {
      const hhmm = String(item.localStartWallclock || '').split('T')[1]?.slice(0, 5);
      if (!hhmm) continue;
      bookedCounts[hhmm] = (bookedCounts[hhmm] || 0) + 1;
    }

    // Filter to available slots
    const slots = allSlots
      .map((s) => {
        const count = bookedCounts[s.startTime] || 0;
        const spotsLeft = Math.max(0, maxPerSlot - count);
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
        source: windowsResult?.source || (availability ? 'hybrid' : 'service_fallback'),
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
