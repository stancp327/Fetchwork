/**
 * DST-safe slot generation using Luxon + IANA timezones.
 * NEVER convert weekly windows to UTC offsets — always resolve per calendar date.
 */
const { DateTime } = require('luxon');

/**
 * Generate bookable time slots for a single calendar date.
 *
 * @param {string} dateStr          - "YYYY-MM-DD" in the freelancer's local timezone
 * @param {Object} availability     - Availability document (plain object or Mongoose doc)
 * @param {Array}  existingBookings - Active bookings overlapping this date range
 * @returns {Array} slot objects
 */
function generateSlotsForDate(dateStr, availability, existingBookings = []) {
  const tz = availability.timezone || 'America/Los_Angeles';
  const localDate = DateTime.fromISO(dateStr, { zone: tz });
  if (!localDate.isValid) return [];

  // Luxon: 1=Mon … 7=Sun → convert to 0=Sun … 6=Sat
  const dayOfWeek = localDate.weekday % 7;

  // Exception overrides weeklySchedule
  const exception = (availability.exceptions || []).find(e => e.date === dateStr);
  if (exception?.unavailable) return [];

  const windows =
    exception?.windows ??
    (availability.weeklySchedule || []).find(d => d.dayOfWeek === dayOfWeek)?.windows ??
    [];

  if (!windows.length) return [];

  const slotMins    = availability.defaultSlotDuration || 60;
  const bufferMins  = availability.bufferTime || 0;
  const noticeMs    = (availability.minNoticeHours || 0) * 3600 * 1000;
  const nowMs       = Date.now();

  const slots = [];

  for (const window of windows) {
    let cursor    = DateTime.fromISO(`${dateStr}T${window.startTime}`, { zone: tz });
    const winEnd  = DateTime.fromISO(`${dateStr}T${window.endTime}`,   { zone: tz });

    // Skip invalid windows (shouldn't happen but guard anyway)
    if (!cursor.isValid || !winEnd.isValid) continue;

    while (true) {
      const slotEnd = cursor.plus({ minutes: slotMins });
      if (slotEnd > winEnd) break;

      // DST spring-forward: the hour doesn't exist — Luxon marks isValid: false
      if (!cursor.isValid || !slotEnd.isValid) {
        cursor = slotEnd.plus({ minutes: bufferMins });
        continue;
      }

      // Enforce minimum notice window
      if (cursor.toMillis() < nowMs + noticeMs) {
        cursor = slotEnd.plus({ minutes: bufferMins });
        continue;
      }

      const startUTC = cursor.toUTC().toJSDate();
      const endUTC   = slotEnd.toUTC().toJSDate();

      // Find any existing booking overlapping this slot
      const existing = existingBookings.find(
        b =>
          ['hold', 'confirmed'].includes(b.status) &&
          new Date(b.startTime) < endUTC &&
          new Date(b.endTime)   > startUTC
      );

      const capacity       = existing?.capacity ?? (availability.defaultCapacity ?? 1);
      const activeCount    = existing
        ? (existing.participants || []).filter(p => p.status !== 'cancelled').length
        : 0;
      const spotsRemaining = Math.max(0, capacity - activeCount);

      slots.push({
        startUTC:       cursor.toUTC().toISO(),
        endUTC:         slotEnd.toUTC().toISO(),
        startLocal:     cursor.toISO(),
        displayTime:    cursor.toFormat('h:mm a'),
        available:      spotsRemaining > 0,
        capacity,
        spotsRemaining,
        existingBookingId: existing?._id?.toString() ?? null,
      });

      cursor = slotEnd.plus({ minutes: bufferMins });
    }
  }

  return slots;
}

/**
 * Generate slots for a date range — for month/week calendar view.
 * Makes a SINGLE DB query externally; slot math runs in-memory.
 *
 * @param {string} fromDate   - "YYYY-MM-DD"
 * @param {string} toDate     - "YYYY-MM-DD"
 * @param {Object} availability
 * @param {Array}  existingBookings
 * @returns {Array} grouped by date
 */
function generateSlotsForRange(fromDate, toDate, availability, existingBookings = []) {
  const tz      = availability.timezone || 'America/Los_Angeles';
  const maxDays = availability.maxAdvanceBookingDays || 60;
  const now     = DateTime.now().setZone(tz);

  let cursor = DateTime.fromISO(fromDate, { zone: tz });
  const end  = DateTime.fromISO(toDate,   { zone: tz });
  const result = [];

  while (cursor <= end) {
    const dateStr     = cursor.toFormat('yyyy-MM-dd');
    const daysFromNow = cursor.diff(now, 'days').days;

    if (daysFromNow <= maxDays) {
      const times = generateSlotsForDate(dateStr, availability, existingBookings);
      result.push({
        date:        dateStr,
        displayDate: cursor.toFormat('EEE, MMM d'),
        dayOfWeek:   cursor.weekday % 7,
        available:   times.some(s => s.available),
        times,
      });
    } else {
      result.push({
        date:        dateStr,
        displayDate: cursor.toFormat('EEE, MMM d'),
        dayOfWeek:   cursor.weekday % 7,
        available:   false,
        beyondWindow: true,
        times:       [],
      });
    }

    cursor = cursor.plus({ days: 1 });
  }

  return result;
}

/**
 * Validate that a proposed UTC startTime is a real slot in the freelancer's availability.
 * Prevents slot injection attacks.
 */
function validateSlot(startUTC, endUTC, availability, existingBookings = []) {
  const tz    = availability.timezone || 'America/Los_Angeles';
  const start = DateTime.fromISO(startUTC, { zone: 'utc' }).setZone(tz);
  const dateStr = start.toFormat('yyyy-MM-dd');

  const slots = generateSlotsForDate(dateStr, availability, existingBookings);
  return slots.some(
    s => s.startUTC === DateTime.fromISO(startUTC).toUTC().toISO()
  );
}

module.exports = { generateSlotsForDate, generateSlotsForRange, validateSlot };
