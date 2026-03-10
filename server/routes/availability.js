/**
 * availability.js — freelancer availability (global + per-service overrides)
 * All data lives in SQL (Prisma FreelancerAvailability + ServiceAvailabilityOverride).
 * No Mongo reads/writes for availability.
 */

const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');

function getPrisma() {
  return require('../booking-sql/db/client').getPrisma();
}

// ── PUT /api/availability — freelancer sets/updates global defaults ──────────
router.put('/', authenticateToken, async (req, res) => {
  try {
    const {
      timezone, defaultSlotDuration, bufferTime, defaultCapacity,
      minNoticeHours, maxAdvanceBookingDays, weeklySchedule, exceptions, isActive,
    } = req.body;

    const prisma = getPrisma();
    const freelancerId = req.user._id.toString();

    const payload = {
      ...(isActive              !== undefined && { isActive }),
      ...(timezone              !== undefined && { timezone }),
      ...(defaultSlotDuration   !== undefined && { defaultSlotDuration: parseInt(defaultSlotDuration) }),
      ...(bufferTime            !== undefined && { bufferTime: parseInt(bufferTime) }),
      ...(defaultCapacity       !== undefined && { defaultCapacity: parseInt(defaultCapacity) }),
      ...(minNoticeHours        !== undefined && { minNoticeHours: parseInt(minNoticeHours) }),
      ...(maxAdvanceBookingDays !== undefined && { maxAdvanceBookingDays: parseInt(maxAdvanceBookingDays) }),
      ...(weeklySchedule        !== undefined && { weeklyScheduleJson: weeklySchedule }),
    };

    const doc = await prisma.freelancerAvailability.upsert({
      where:  { freelancerId },
      update: payload,
      create: { freelancerId, ...payload },
    });

    // Handle exceptions separately if provided
    if (exceptions && Array.isArray(exceptions)) {
      // Clear existing and re-create
      await prisma.availabilityException.deleteMany({
        where: { freelancerAvailId: doc.id, serviceId: null },
      });
      if (exceptions.length > 0) {
        await prisma.availabilityException.createMany({
          data: exceptions.map(ex => ({
            freelancerAvailId: doc.id,
            date:              ex.date,
            unavailable:       ex.unavailable !== false,
            windowsJson:       ex.windows || null,
            reason:            ex.reason || null,
          })),
        });
      }
    }

    // Return in the shape the frontend expects
    res.json({
      availability: {
        freelancerId:          doc.freelancerId,
        timezone:              doc.timezone,
        defaultSlotDuration:   doc.defaultSlotDuration,
        bufferTime:            doc.bufferTime,
        defaultCapacity:       doc.defaultCapacity,
        minNoticeHours:        doc.minNoticeHours,
        maxAdvanceBookingDays: doc.maxAdvanceBookingDays,
        isActive:              doc.isActive,
        weeklySchedule:        doc.weeklyScheduleJson || [],
        exceptions:            exceptions || [],
      },
    });
  } catch (err) {
    console.error('[availability] PUT error:', err);
    res.status(500).json({ error: 'Failed to save availability' });
  }
});

// ── GET /api/availability/me — current freelancer's own config ──────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    const doc = await prisma.freelancerAvailability.findUnique({
      where: { freelancerId: req.user._id.toString() },
      include: {
        exceptions: { where: { serviceId: null }, orderBy: { date: 'asc' } },
      },
    });

    if (!doc) return res.json({ availability: null });

    res.json({
      availability: {
        freelancerId:          doc.freelancerId,
        timezone:              doc.timezone,
        defaultSlotDuration:   doc.defaultSlotDuration,
        bufferTime:            doc.bufferTime,
        defaultCapacity:       doc.defaultCapacity,
        minNoticeHours:        doc.minNoticeHours,
        maxAdvanceBookingDays: doc.maxAdvanceBookingDays,
        isActive:              doc.isActive,
        weeklySchedule:        doc.weeklyScheduleJson || [],
        exceptions:            (doc.exceptions || []).map(e => ({
          date: e.date, unavailable: e.unavailable, reason: e.reason,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load availability' });
  }
});

// ── GET /api/availability/:freelancerId — public availability config ─────────
router.get('/:freelancerId', async (req, res) => {
  try {
    const prisma = getPrisma();
    const doc = await prisma.freelancerAvailability.findUnique({
      where: { freelancerId: req.params.freelancerId },
    });

    if (!doc || !doc.isActive) {
      return res.status(404).json({ error: 'Availability not configured' });
    }

    res.json({
      availability: {
        timezone:              doc.timezone,
        defaultSlotDuration:   doc.defaultSlotDuration,
        bufferTime:            doc.bufferTime,
        defaultCapacity:       doc.defaultCapacity,
        minNoticeHours:        doc.minNoticeHours,
        maxAdvanceBookingDays: doc.maxAdvanceBookingDays,
        weeklySchedule:        doc.weeklyScheduleJson || [],
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load availability' });
  }
});

// ── PUT /api/availability/service/:serviceId — per-service override ──────────
router.put('/service/:serviceId', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    const freelancerId = req.user._id.toString();
    const serviceId    = req.params.serviceId;

    // Verify freelancer owns this service
    const Service = require('../models/Service');
    const svc = await Service.findById(serviceId).select('freelancer').lean();
    if (!svc) return res.status(404).json({ error: 'Service not found' });
    if (svc.freelancer.toString() !== freelancerId)
      return res.status(403).json({ error: 'Not your service' });

    // Ensure global availability exists first
    const global = await prisma.freelancerAvailability.findUnique({
      where: { freelancerId },
      select: { id: true },
    });
    if (!global) {
      return res.status(400).json({
        error: 'Set up your global availability first before customizing per-service.',
      });
    }

    const {
      timezone, slotDuration, bufferTime, capacity,
      minNoticeHours, maxAdvanceBookingDays, weeklySchedule, isActive,
      blockedDates,  // array of 'YYYY-MM-DD' strings to mark as unavailable
    } = req.body;

    const override = await prisma.serviceAvailabilityOverride.upsert({
      where: {
        freelancerAvailId_serviceId: {
          freelancerAvailId: global.id,
          serviceId,
        },
      },
      create: {
        freelancerAvailId:     global.id,
        serviceId,
        timezone:              timezone || null,
        slotDuration:          slotDuration != null ? parseInt(slotDuration) : null,
        bufferTime:            bufferTime != null ? parseInt(bufferTime) : null,
        capacity:              capacity != null ? parseInt(capacity) : null,
        minNoticeHours:        minNoticeHours != null ? parseInt(minNoticeHours) : null,
        maxAdvanceBookingDays: maxAdvanceBookingDays != null ? parseInt(maxAdvanceBookingDays) : null,
        weeklyScheduleJson:    weeklySchedule || null,
        isActive:              isActive !== false,
      },
      update: {
        timezone:              timezone ?? undefined,
        slotDuration:          slotDuration != null ? parseInt(slotDuration) : undefined,
        bufferTime:            bufferTime != null ? parseInt(bufferTime) : undefined,
        capacity:              capacity != null ? parseInt(capacity) : undefined,
        minNoticeHours:        minNoticeHours != null ? parseInt(minNoticeHours) : undefined,
        maxAdvanceBookingDays: maxAdvanceBookingDays != null ? parseInt(maxAdvanceBookingDays) : undefined,
        weeklyScheduleJson:    weeklySchedule ?? undefined,
        isActive:              isActive ?? undefined,
      },
    });

    // Persist blocked holiday dates as AvailabilityDateOverride rows (optional — empty array clears all)
    if (Array.isArray(blockedDates)) {
      const validDates = blockedDates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
      if (validDates.length > 0) {
        await Promise.all(validDates.map(date =>
          prisma.availabilityDateOverride.upsert({
            where: { freelancerAvailId_serviceId_date: { freelancerAvailId: global.id, serviceId, date } },
            create: { freelancerAvailId: global.id, serviceId, date, unavailable: true, reason: 'Holiday' },
            update: { unavailable: true, reason: 'Holiday' },
          })
        ));
      }
      // Remove any previously blocked dates not in the current list ([] clears all)
      await prisma.availabilityDateOverride.deleteMany({
        where: { freelancerAvailId: global.id, serviceId, reason: 'Holiday', date: { notIn: validDates } },
      });
    }

    res.json({ message: 'Service availability override saved', override });
  } catch (err) {
    console.error('[availability] service override PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/availability/service/:serviceId — resolved availability for a service
router.get('/service/:serviceId', authenticateToken, async (req, res) => {
  try {
    const serviceId = req.params.serviceId;

    // Get freelancer ID from service
    const Service = require('../models/Service');
    const svc = await Service.findById(serviceId).select('freelancer serviceLocation').lean();
    if (!svc) return res.status(404).json({ error: 'Service not found' });

    const { AvailabilityService } = require('../booking-sql/services/AvailabilityService');
    const availService = new AvailabilityService();
    const resolved = await availService.getResolvedAvailability({
      freelancerId: svc.freelancer.toString(),
      serviceId,
    });

    if (!resolved) return res.json({ availability: null, serviceLocation: svc.serviceLocation || null, blockedDates: [] });

    // Fetch blocked holiday dates
    const prisma = getPrisma();
    const globalAvail = await prisma.freelancerAvailability.findUnique({ where: { freelancerId: svc.freelancer.toString() }, select: { id: true } });
    let blockedDates = [];
    if (globalAvail) {
      const overrides = await prisma.availabilityDateOverride.findMany({
        where: { freelancerAvailId: globalAvail.id, serviceId, reason: 'Holiday', unavailable: true },
        select: { date: true },
      });
      blockedDates = overrides.map(o => o.date);
    }

    res.json({
      availability: {
        timezone:              resolved.timezone,
        slotDuration:          resolved.slotDuration,
        bufferTime:            resolved.bufferTime,
        capacity:              resolved.capacity,
        minNoticeHours:        resolved.minNoticeHours,
        maxAdvanceBookingDays: resolved.maxAdvanceBookingDays,
        isActive:              resolved.isActive,
        weeklySchedule:        resolved.weeklySchedule || [],
        isOverride:            !!resolved._overrideId,
      },
      serviceLocation: svc.serviceLocation || null,
      blockedDates,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/availability/service/:serviceId/location — service location mode
router.put('/service/:serviceId/location', authenticateToken, async (req, res) => {
  try {
    const Service = require('../models/Service');
    const svc = await Service.findById(req.params.serviceId);
    if (!svc) return res.status(404).json({ error: 'Service not found' });
    if (svc.freelancer.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Not your service' });

    const { mode, address, travelRadius, notes } = req.body;

    svc.serviceLocation = {
      mode:         mode || 'remote',
      address:      address || '',
      travelRadius: Number(travelRadius) || 0,
      notes:        notes || '',
    };

    await svc.save();
    res.json({ message: 'Service location updated', serviceLocation: svc.serviceLocation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
