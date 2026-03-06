/**
 * AvailabilityService — Hybrid availability resolution
 * 
 * Resolution order:
 * 1. Check exception for specific date (service-specific > global)
 * 2. Check service override settings
 * 3. Fall back to freelancer global defaults
 */

const { getPrisma } = require('../db/client');

class AvailabilityService {
  constructor(deps = {}) {
    this.prisma = deps.prisma || null;
  }

  _getPrisma() {
    if (this.prisma) return this.prisma;
    return getPrisma();
  }

  /**
   * Get resolved availability for a freelancer + optional service.
   * Merges global defaults with service overrides.
   */
  async getResolvedAvailability({ freelancerId, serviceId = null }) {
    const prisma = this._getPrisma();

    // Get freelancer's global availability
    const global = await prisma.freelancerAvailability.findUnique({
      where: { freelancerId },
      include: {
        serviceOverrides: serviceId ? {
          where: { serviceId }
        } : false,
      },
    });

    if (!global) {
      return null;
    }

    // Get service-specific override if requested
    const override = serviceId && global.serviceOverrides?.length > 0
      ? global.serviceOverrides[0]
      : null;

    // Merge: override wins if present, else use global
    return {
      freelancerId,
      serviceId,
      timezone: override?.timezone ?? global.timezone,
      slotDuration: override?.slotDuration ?? global.defaultSlotDuration,
      bufferTime: override?.bufferTime ?? global.bufferTime,
      capacity: override?.capacity ?? global.defaultCapacity,
      minNoticeHours: override?.minNoticeHours ?? global.minNoticeHours,
      maxAdvanceBookingDays: override?.maxAdvanceBookingDays ?? global.maxAdvanceBookingDays,
      isActive: (override?.isActive ?? true) && global.isActive,
      weeklySchedule: override?.weeklyScheduleJson ?? global.weeklyScheduleJson ?? [],
      // Include raw refs for debugging/admin
      _globalId: global.id,
      _overrideId: override?.id ?? null,
    };
  }

  /**
   * Get exceptions for a date range.
   * Service-specific exceptions take precedence over global exceptions.
   */
  async getExceptionsForRange({ freelancerId, serviceId = null, fromDate, toDate }) {
    const prisma = this._getPrisma();

    // Get freelancer availability ID
    const global = await prisma.freelancerAvailability.findUnique({
      where: { freelancerId },
      select: { id: true },
    });

    if (!global) return [];

    const exceptions = await prisma.availabilityException.findMany({
      where: {
        freelancerAvailId: global.id,
        date: { gte: fromDate, lte: toDate },
        OR: [
          { serviceId: null },        // Global exceptions
          { serviceId: serviceId },   // Service-specific
        ],
      },
      orderBy: { date: 'asc' },
    });

    // Dedupe: service-specific wins over global for same date
    const byDate = new Map();
    for (const exc of exceptions) {
      const key = exc.date;
      const existing = byDate.get(key);
      // Service-specific (non-null) takes precedence
      if (!existing || (exc.serviceId && !existing.serviceId)) {
        byDate.set(key, exc);
      }
    }

    return Array.from(byDate.values());
  }

  /**
   * Get exception for a specific date.
   */
  async getExceptionForDate({ freelancerId, serviceId = null, date }) {
    const exceptions = await this.getExceptionsForRange({
      freelancerId,
      serviceId,
      fromDate: date,
      toDate: date,
    });
    return exceptions[0] ?? null;
  }

  /**
   * Check if a specific date is available (not blocked by exception).
   */
  async isDateAvailable({ freelancerId, serviceId = null, date }) {
    const exception = await this.getExceptionForDate({ freelancerId, serviceId, date });
    if (!exception) return true;
    return !exception.unavailable;
  }

  /**
   * Get windows for a specific date.
   * Order: exception > service override > global default
   */
  async getWindowsForDate({ freelancerId, serviceId = null, date }) {
    const { DateTime } = require('luxon');

    // Get resolved availability (global + service override merged)
    const avail = await this.getResolvedAvailability({ freelancerId, serviceId });
    if (!avail || !avail.isActive) {
      return { available: false, windows: [], reason: 'Availability not configured or inactive' };
    }

    // Check for exception
    const exception = await this.getExceptionForDate({ freelancerId, serviceId, date });
    if (exception) {
      if (exception.unavailable) {
        return { available: false, windows: [], reason: exception.reason || 'Day off' };
      }
      // Exception has custom windows
      return {
        available: true,
        windows: exception.windowsJson ?? [],
        source: 'exception',
      };
    }

    // Use weekly schedule
    const localDate = DateTime.fromISO(date, { zone: avail.timezone });
    if (!localDate.isValid) {
      return { available: false, windows: [], reason: 'Invalid date' };
    }

    const dayOfWeek = localDate.weekday % 7; // 0=Sun, 6=Sat
    const weeklySchedule = Array.isArray(avail.weeklySchedule) 
      ? avail.weeklySchedule 
      : [];
    
    const daySchedule = weeklySchedule.find(d => d.dayOfWeek === dayOfWeek);
    if (!daySchedule || !daySchedule.windows?.length) {
      return { available: false, windows: [], reason: 'No availability on this day' };
    }

    return {
      available: true,
      windows: daySchedule.windows,
      source: avail._overrideId ? 'service_override' : 'global_default',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD Operations
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create or update freelancer global availability.
   */
  async upsertGlobalAvailability({ freelancerId, data }) {
    const prisma = this._getPrisma();

    return prisma.freelancerAvailability.upsert({
      where: { freelancerId },
      create: {
        freelancerId,
        timezone: data.timezone ?? 'America/Los_Angeles',
        defaultSlotDuration: data.slotDuration ?? 60,
        bufferTime: data.bufferTime ?? 0,
        defaultCapacity: data.capacity ?? 1,
        minNoticeHours: data.minNoticeHours ?? 24,
        maxAdvanceBookingDays: data.maxAdvanceBookingDays ?? 60,
        isActive: data.isActive ?? true,
        weeklyScheduleJson: data.weeklySchedule ?? [],
      },
      update: {
        timezone: data.timezone,
        defaultSlotDuration: data.slotDuration,
        bufferTime: data.bufferTime,
        defaultCapacity: data.capacity,
        minNoticeHours: data.minNoticeHours,
        maxAdvanceBookingDays: data.maxAdvanceBookingDays,
        isActive: data.isActive,
        weeklyScheduleJson: data.weeklySchedule,
      },
    });
  }

  /**
   * Create or update service-specific override.
   */
  async upsertServiceOverride({ freelancerId, serviceId, data }) {
    const prisma = this._getPrisma();

    // Ensure freelancer availability exists
    const global = await prisma.freelancerAvailability.findUnique({
      where: { freelancerId },
      select: { id: true },
    });

    if (!global) {
      throw new Error('Freelancer availability not configured. Create global availability first.');
    }

    return prisma.serviceAvailabilityOverride.upsert({
      where: {
        freelancerAvailId_serviceId: {
          freelancerAvailId: global.id,
          serviceId,
        },
      },
      create: {
        freelancerAvailId: global.id,
        serviceId,
        timezone: data.timezone,
        slotDuration: data.slotDuration,
        bufferTime: data.bufferTime,
        capacity: data.capacity,
        minNoticeHours: data.minNoticeHours,
        maxAdvanceBookingDays: data.maxAdvanceBookingDays,
        isActive: data.isActive ?? true,
        weeklyScheduleJson: data.weeklySchedule,
      },
      update: {
        timezone: data.timezone,
        slotDuration: data.slotDuration,
        bufferTime: data.bufferTime,
        capacity: data.capacity,
        minNoticeHours: data.minNoticeHours,
        maxAdvanceBookingDays: data.maxAdvanceBookingDays,
        isActive: data.isActive,
        weeklyScheduleJson: data.weeklySchedule,
      },
    });
  }

  /**
   * Add an exception (day off or custom hours).
   */
  async addException({ freelancerId, serviceId = null, date, unavailable = true, windows = null, reason = null }) {
    const prisma = this._getPrisma();

    const global = await prisma.freelancerAvailability.findUnique({
      where: { freelancerId },
      select: { id: true },
    });

    if (!global) {
      throw new Error('Freelancer availability not configured');
    }

    return prisma.availabilityException.upsert({
      where: {
        freelancerAvailId_serviceId_date: {
          freelancerAvailId: global.id,
          serviceId: serviceId,
          date,
        },
      },
      create: {
        freelancerAvailId: global.id,
        serviceId,
        date,
        unavailable,
        windowsJson: windows,
        reason,
      },
      update: {
        unavailable,
        windowsJson: windows,
        reason,
      },
    });
  }

  /**
   * Remove an exception.
   */
  async removeException({ freelancerId, serviceId = null, date }) {
    const prisma = this._getPrisma();

    const global = await prisma.freelancerAvailability.findUnique({
      where: { freelancerId },
      select: { id: true },
    });

    if (!global) return null;

    return prisma.availabilityException.delete({
      where: {
        freelancerAvailId_serviceId_date: {
          freelancerAvailId: global.id,
          serviceId: serviceId,
          date,
        },
      },
    }).catch(() => null); // Ignore if not found
  }

  /**
   * Delete service override (revert to global).
   */
  async deleteServiceOverride({ freelancerId, serviceId }) {
    const prisma = this._getPrisma();

    const global = await prisma.freelancerAvailability.findUnique({
      where: { freelancerId },
      select: { id: true },
    });

    if (!global) return null;

    return prisma.serviceAvailabilityOverride.delete({
      where: {
        freelancerAvailId_serviceId: {
          freelancerAvailId: global.id,
          serviceId,
        },
      },
    }).catch(() => null);
  }
}

module.exports = { AvailabilityService };
