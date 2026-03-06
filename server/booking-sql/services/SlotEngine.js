const { ServiceAdapter } = require('../repos/ServiceAdapter');
const { OccurrenceRepo } = require('../repos/OccurrenceRepo');

function generateSlots(windows, slotDuration, bufferTime, dayOfWeek) {
  const dayWindows = (windows || []).filter((w) => w.dayOfWeek === dayOfWeek);
  const slots = [];

  for (const win of dayWindows) {
    const [startH, startM] = String(win.startTime || '00:00').split(':').map(Number);
    const [endH, endM] = String(win.endTime || '00:00').split(':').map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    let cursor = startMin;
    while (cursor + slotDuration <= endMin) {
      const slotStart = `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`;
      const slotEndMin = cursor + slotDuration;
      const slotEnd = `${String(Math.floor(slotEndMin / 60)).padStart(2, '0')}:${String(slotEndMin % 60).padStart(2, '0')}`;
      slots.push({ startTime: slotStart, endTime: slotEnd });
      cursor = slotEndMin + bufferTime;
    }
  }

  return slots;
}

class SlotEngine {
  constructor(deps = {}) {
    this.occurrenceRepo = deps.occurrenceRepo || new OccurrenceRepo();
    this.serviceAdapter = deps.serviceAdapter || new ServiceAdapter();
  }

  async getSlotsForServiceDate({ serviceId, date }) {
    const service = await this.serviceAdapter.getById(serviceId);

    if (!service) return { statusCode: 404, body: { error: 'Service not found' } };
    if (!service.bookingEnabled) return { statusCode: 200, body: { slots: [], message: 'Booking not enabled' } };

    const requestedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(requestedDate.getTime())) {
      return { statusCode: 400, body: { error: 'date query param required (YYYY-MM-DD)' } };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestedDate < today) return { statusCode: 200, body: { slots: [], message: 'Date is in the past' } };

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + service.maxAdvanceDays);
    if (requestedDate > maxDate) return { statusCode: 200, body: { slots: [], message: 'Date too far in advance' } };

    const dayOfWeek = requestedDate.getDay();
    const allSlots = generateSlots(
      service.availabilityWindows,
      service.slotDuration,
      service.bufferTime,
      dayOfWeek
    );

    const startOfDayUtc = new Date(`${date}T00:00:00Z`);
    const endOfDayUtc = new Date(`${date}T23:59:59Z`);
    const booked = await this.occurrenceRepo.findActiveForFreelancerDateRange({
      freelancerId: service.freelancerId,
      dayStartUtc: startOfDayUtc,
      dayEndUtc: endOfDayUtc,
    });

    const bookedCounts = {};
    for (const item of booked) {
      const hhmm = String(item.localStartWallclock || '').split('T')[1]?.slice(0, 5);
      if (!hhmm) continue;
      bookedCounts[hhmm] = (bookedCounts[hhmm] || 0) + 1;
    }

    const slots = allSlots
      .map((s) => {
        const count = bookedCounts[s.startTime] || 0;
        const spotsLeft = Math.max(0, service.maxPerSlot - count);
        return { ...s, spotsLeft, totalSpots: service.maxPerSlot };
      })
      .filter((s) => s.spotsLeft > 0);

    return {
      statusCode: 200,
      body: {
        date,
        dayOfWeek,
        slots,
        totalSlots: allSlots.length,
      },
    };
  }
}

module.exports = { SlotEngine };
