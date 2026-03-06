/**
 * SlotEngine — DST-safe slot generation for booking-sql
 * Uses Luxon for timezone handling; never converts weekly windows to fixed UTC offsets.
 */

const { DateTime } = require('luxon');
const { ServiceAdapter } = require('../repos/ServiceAdapter');
const { OccurrenceRepo } = require('../repos/OccurrenceRepo');

/**
 * Generate time slots for a specific date, respecting DST transitions.
 * @param {Object} params
 * @param {Array} params.windows - availability windows [{dayOfWeek, startTime, endTime}]
 * @param {number} params.slotDuration - minutes per slot
 * @param {number} params.bufferTime - minutes between slots
 * @param {string} params.dateStr - "YYYY-MM-DD"
 * @param {string} params.timezone - IANA timezone (e.g., "America/Los_Angeles")
 * @param {number} params.minNoticeHours - minimum booking notice (default 0)
 * @returns {Array} slot objects with startTime, endTime, startUtc, endUtc
 */
function generateSlots({ windows, slotDuration, bufferTime, dateStr, timezone, minNoticeHours = 0 }) {
  const tz = timezone || 'America/Los_Angeles';
  const localDate = DateTime.fromISO(dateStr, { zone: tz });
  
  if (!localDate.isValid) return [];

  // Luxon: 1=Mon…7=Sun → convert to JS 0=Sun…6=Sat
  const dayOfWeek = localDate.weekday % 7;
  const dayWindows = (windows || []).filter((w) => w.dayOfWeek === dayOfWeek);
  
  if (!dayWindows.length) return [];

  const slots = [];
  const nowMs = Date.now();
  const noticeMs = (minNoticeHours || 0) * 3600 * 1000;

  for (const win of dayWindows) {
    let cursor = DateTime.fromISO(`${dateStr}T${win.startTime}`, { zone: tz });
    const winEnd = DateTime.fromISO(`${dateStr}T${win.endTime}`, { zone: tz });

    if (!cursor.isValid || !winEnd.isValid) continue;

    while (true) {
      const slotEnd = cursor.plus({ minutes: slotDuration });
      if (slotEnd > winEnd) break;

      // DST spring-forward: the hour doesn't exist — Luxon marks isValid: false
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

class SlotEngine {
  constructor(deps = {}) {
    this.occurrenceRepo = deps.occurrenceRepo || new OccurrenceRepo();
    this.serviceAdapter = deps.serviceAdapter || new ServiceAdapter();
  }

  /**
   * Get available slots for a service on a specific date.
   * DST-safe: uses IANA timezone from service, handles spring-forward/fall-back.
   */
  async getSlotsForServiceDate({ serviceId, date }) {
    const service = await this.serviceAdapter.getById(serviceId);

    if (!service) {
      return { statusCode: 404, body: { error: 'Service not found' } };
    }
    if (!service.bookingEnabled) {
      return { statusCode: 200, body: { slots: [], message: 'Booking not enabled' } };
    }

    const tz = service.timezone || 'America/Los_Angeles';
    const requestedDate = DateTime.fromISO(date, { zone: tz });
    
    if (!requestedDate.isValid) {
      return { statusCode: 400, body: { error: 'date query param required (YYYY-MM-DD)' } };
    }

    const today = DateTime.now().setZone(tz).startOf('day');
    if (requestedDate < today) {
      return { statusCode: 200, body: { slots: [], message: 'Date is in the past' } };
    }

    const maxDate = today.plus({ days: service.maxAdvanceDays || 60 });
    if (requestedDate > maxDate) {
      return { statusCode: 200, body: { slots: [], message: 'Date too far in advance' } };
    }

    // Generate all possible slots for this date (DST-safe)
    const allSlots = generateSlots({
      windows: service.availabilityWindows,
      slotDuration: service.slotDuration || 60,
      bufferTime: service.bufferTime || 0,
      dateStr: date,
      timezone: tz,
      minNoticeHours: service.minNoticeHours || 0,
    });

    // Query existing bookings for this date range
    const startOfDayUtc = requestedDate.startOf('day').toUTC().toJSDate();
    const endOfDayUtc = requestedDate.endOf('day').toUTC().toJSDate();
    
    const booked = await this.occurrenceRepo.findActiveForFreelancerDateRange({
      freelancerId: service.freelancerId,
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
    const maxPerSlot = service.maxPerSlot || 1;
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
      },
    };
  }

  /**
   * Validate that a proposed slot is actually available.
   * Prevents slot injection attacks.
   */
  async validateSlot({ serviceId, date, startTime, endTime }) {
    const result = await this.getSlotsForServiceDate({ serviceId, date });
    
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
}

module.exports = { SlotEngine, generateSlots };
