const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { Conversation, Message } = require('../models/Message');
const { getPrisma } = require('../booking-sql/db/client');

const router = express.Router();

const getEntityId = (v) => (v && typeof v === 'object' ? (v._id || v.id || v.userId || v.toString?.()) : v);
const idEq = (a, b) => String(getEntityId(a)) === String(getEntityId(b));

function assert15MinIncrement(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0 && (d.getUTCMinutes() % 15 === 0);
}

function assertDuration15(durationMinutes) {
  const n = Number(durationMinutes);
  return Number.isFinite(n) && n >= 15 && n <= 24 * 60 && n % 15 === 0;
}

function addMinutes(date, mins) {
  return new Date(new Date(date).getTime() + mins * 60 * 1000);
}

// POST /api/appointments
// Creates a proposed appointment. The other participant must approve.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();

    const {
      conversationId,
      appointmentType,
      startAtUtc,
      durationMinutes,
      timezone,
      notes,
      jobId,
      serviceId,
    } = req.body || {};

    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
    if (!appointmentType) return res.status(400).json({ error: 'appointmentType required' });
    if (!startAtUtc) return res.status(400).json({ error: 'startAtUtc required' });
    if (!timezone) return res.status(400).json({ error: 'timezone required' });
    if (!assertDuration15(durationMinutes)) return res.status(400).json({ error: 'durationMinutes must be 15-minute increments (>=15)' });
    if (!assert15MinIncrement(startAtUtc)) return res.status(400).json({ error: 'startAtUtc must be aligned to 15-minute increments' });

    const convo = await Conversation.findById(conversationId).lean();
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const me = req.user?._id;
    const meId = String(getEntityId(me));

    const participantIds = (convo.participants || []).map(p => String(getEntityId(p)));
    if (!participantIds.includes(meId)) return res.status(403).json({ error: 'Not a participant in this conversation' });

    // Infer client/freelancer roles loosely: if job/service exists, we assume two-party convo and map requester as "client" if they match job.client, else freelancer.
    // When role is ambiguous (no linked entity), store requester as clientId and other as freelancerId only for indexing; app logic can treat them as partyA/partyB.
    const otherId = participantIds.find(id => id !== meId) || participantIds[0];

    const start = new Date(startAtUtc);
    const end = addMinutes(start, Number(durationMinutes));

    const appt = await prisma.appointment.create({
      data: {
        conversationId: String(conversationId),
        clientId: meId,
        freelancerId: String(otherId),
        appointmentType,
        status: 'proposed',
        proposedById: meId,
        approvedById: null,
        approvedAt: null,
        jobId: jobId ? String(jobId) : null,
        serviceId: serviceId ? String(serviceId) : null,
        startAtUtc: start,
        endAtUtc: end,
        timezone: String(timezone),
        notes: notes ? String(notes).slice(0, 2000) : null,
      },
    });

    return res.json({ appointment: appt });
  } catch (error) {
    console.error('Create appointment error:', error);
    return res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// POST /api/appointments/:id/approve
router.post('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    const id = req.params.id;
    const meId = String(getEntityId(req.user?._id));

    const appt = await prisma.appointment.findUnique({ where: { id } });
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    // Authorization: must be participant in conversation
    const convo = await Conversation.findById(appt.conversationId).lean();
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    const participantIds = (convo.participants || []).map(p => String(getEntityId(p)));
    if (!participantIds.includes(meId)) return res.status(403).json({ error: 'Not a participant in this conversation' });

    if (appt.status !== 'proposed') return res.status(400).json({ error: 'Only proposed appointments can be approved' });
    if (idEq(appt.proposedById, meId)) return res.status(400).json({ error: 'Proposer cannot approve their own appointment' });

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'confirmed',
        approvedById: meId,
        approvedAt: new Date(),
      },
    });

    return res.json({ appointment: updated });
  } catch (error) {
    console.error('Approve appointment error:', error);
    return res.status(500).json({ error: 'Failed to approve appointment' });
  }
});

// PUT /api/appointments/:id
// Propose edits (requires re-approval).
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    const id = req.params.id;
    const meId = String(getEntityId(req.user?._id));

    const appt = await prisma.appointment.findUnique({ where: { id } });
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    const convo = await Conversation.findById(appt.conversationId).lean();
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    const participantIds = (convo.participants || []).map(p => String(getEntityId(p)));
    if (!participantIds.includes(meId)) return res.status(403).json({ error: 'Not a participant in this conversation' });

    const {
      appointmentType,
      startAtUtc,
      durationMinutes,
      timezone,
      notes,
    } = req.body || {};

    const data = {
      status: 'proposed',
      proposedById: meId,
      approvedById: null,
      approvedAt: null,
    };

    if (appointmentType) data.appointmentType = appointmentType;
    if (timezone) data.timezone = String(timezone);
    if (notes !== undefined) data.notes = notes ? String(notes).slice(0, 2000) : null;

    if (startAtUtc) {
      if (!assert15MinIncrement(startAtUtc)) return res.status(400).json({ error: 'startAtUtc must be aligned to 15-minute increments' });
      data.startAtUtc = new Date(startAtUtc);
    }

    if (durationMinutes !== undefined) {
      if (!assertDuration15(durationMinutes)) return res.status(400).json({ error: 'durationMinutes must be 15-minute increments (>=15)' });
      const start = data.startAtUtc || appt.startAtUtc;
      data.endAtUtc = addMinutes(start, Number(durationMinutes));
    } else if (data.startAtUtc) {
      // Keep same duration if only start changes
      const duration = Math.round((new Date(appt.endAtUtc).getTime() - new Date(appt.startAtUtc).getTime()) / 60000);
      data.endAtUtc = addMinutes(data.startAtUtc, duration);
    }

    const updated = await prisma.appointment.update({ where: { id }, data });
    return res.json({ appointment: updated });
  } catch (error) {
    console.error('Update appointment error:', error);
    return res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// POST /api/appointments/:id/cancel
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    const id = req.params.id;
    const meId = String(getEntityId(req.user?._id));

    const appt = await prisma.appointment.findUnique({ where: { id } });
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    const convo = await Conversation.findById(appt.conversationId).lean();
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    const participantIds = (convo.participants || []).map(p => String(getEntityId(p)));
    if (!participantIds.includes(meId)) return res.status(403).json({ error: 'Not a participant in this conversation' });

    const updated = await prisma.appointment.update({ where: { id }, data: { status: 'cancelled' } });
    return res.json({ appointment: updated });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    return res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

// GET /api/appointments?conversationId=...
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prisma = getPrisma();
    const meId = String(getEntityId(req.user?._id));
    const { conversationId, status, limit = 50 } = req.query || {};

    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });

    const convo = await Conversation.findById(conversationId).lean();
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    const participantIds = (convo.participants || []).map(p => String(getEntityId(p)));
    if (!participantIds.includes(meId)) return res.status(403).json({ error: 'Not a participant in this conversation' });

    const where = {
      conversationId: String(conversationId),
      ...(status ? { status: String(status) } : {}),
    };

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { startAtUtc: 'asc' },
      take: Math.min(Number(limit) || 50, 200),
    });

    return res.json({ appointments });
  } catch (error) {
    console.error('List appointments error:', error);
    return res.status(500).json({ error: 'Failed to list appointments' });
  }
});

module.exports = router;
