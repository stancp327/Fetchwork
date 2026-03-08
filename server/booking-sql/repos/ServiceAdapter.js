/**
 * ServiceAdapter
 *
 * Decouples BookingService from the Mongo `Service` model.
 * Provides a stable interface so we can swap to a SQL service_offerings
 * repo later without touching BookingService.
 *
 * Shape returned by getById:
 * {
 *   id: string,
 *   freelancerId: string,
 *   title: string,
 *   timezone: string,
 *   maxPerSlot: number,
 *   pricingBaseCents: number,
 *   cancellationTier: string, // flexible | moderate | strict
 * }
 */

let MongoService;
function getMongoService() {
  if (!MongoService) {
    MongoService = require('../../models/Service');
  }
  return MongoService;
}

class ServiceAdapter {
  /**
   * Fetch service metadata needed for booking hold creation.
   * @param {string} serviceId
   * @returns {object|null}
   */
  async getById(serviceId) {
    const Service = getMongoService();
    const raw = await Service.findById(serviceId)
      .select('_id freelancer availability pricing title cancellationPolicy capacity bookingThrottle')
      .lean();

    if (!raw) return null;

    return {
      // Identity
      id: String(raw._id),
      freelancerId: String(raw.freelancer),
      title: raw.title || '',

      // Booking + pricing
      timezone: raw.availability?.timezone || 'UTC',
      maxPerSlot: Number(raw.availability?.maxPerSlot || raw.capacity?.maxPerSlot || 1),
      pricingBaseCents: Math.round(Number(raw.pricing?.base || 0) * 100),
      cancellationTier: raw.cancellationPolicy?.tier || 'flexible',

      // Booking throttle limits (null = unlimited)
      maxPerDay:     raw.bookingThrottle?.maxPerDay     ?? raw.maxPerDay     ?? null,
      maxPerWeek:    raw.bookingThrottle?.maxPerWeek    ?? raw.maxPerWeek    ?? null,
      maxConcurrent: raw.bookingThrottle?.maxConcurrent ?? raw.maxConcurrent ?? null,

      // Availability / slot generation
      bookingEnabled: raw.availability?.enabled === true,
      slotDuration: Number(raw.availability?.slotDuration || 60),
      bufferTime: Number(raw.availability?.bufferTime || 0),
      maxAdvanceDays: Number(raw.availability?.maxAdvanceDays || 30),
      availabilityWindows: Array.isArray(raw.availability?.windows)
        ? raw.availability.windows
        : [],
    };
  }
}

module.exports = { ServiceAdapter };
