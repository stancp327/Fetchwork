const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');

let getPrisma;
try {
  getPrisma = require('../booking-sql/db/client').getPrisma;
} catch (_) {}

function requireDb(req, res, next) {
  if (!getPrisma || !process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Intake forms unavailable' });
  }
  next();
}

// ── GET /api/intake-forms/templates/me ──────────────────────────────────────
// Auth required. Freelancer lists their own templates.
router.get('/templates/me', authenticateToken, requireDb, async (req, res) => {
  try {
    const prisma = getPrisma();
    const freelancerId = req.user._id.toString();
    const templates = await prisma.intakeFormTemplate.findMany({
      where:   { freelancerId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ templates });
  } catch (err) {
    console.error('[intake-forms/templates/me] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/intake-forms/responses/:bookingId ───────────────────────────────
// Auth required (freelancer or the client who submitted).
router.get('/responses/:bookingId', authenticateToken, requireDb, async (req, res) => {
  try {
    const prisma    = getPrisma();
    const actorId   = req.user._id.toString();
    const { bookingId } = req.params;

    // Verify the actor is a participant in this booking
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== actorId && booking.freelancerId !== actorId) {
      return res.status(403).json({ error: 'Not a booking participant' });
    }

    const response = await prisma.intakeFormResponse.findFirst({
      where:   { bookingId },
      include: { template: true },
    });

    res.json({ response: response || null });
  } catch (err) {
    console.error('[intake-forms/responses] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/intake-forms ───────────────────────────────────────────────────
// Auth required (freelancer). Create or update a template.
router.post('/', authenticateToken, requireDb, async (req, res) => {
  try {
    const prisma       = getPrisma();
    const freelancerId = req.user._id.toString();
    const { serviceId, name, fieldsJson } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    if (!Array.isArray(fieldsJson)) return res.status(400).json({ error: 'fieldsJson must be an array' });

    const existing = await prisma.intakeFormTemplate.findFirst({
      where: { freelancerId, serviceId: serviceId || null },
    });

    let template;
    if (existing) {
      template = await prisma.intakeFormTemplate.update({
        where: { id: existing.id },
        data:  { name: name.trim(), fieldsJson, isActive: true },
      });
    } else {
      template = await prisma.intakeFormTemplate.create({
        data: {
          freelancerId,
          serviceId: serviceId || null,
          name:      name.trim(),
          fieldsJson,
          isActive:  true,
        },
      });
    }

    res.status(existing ? 200 : 201).json({ template });
  } catch (err) {
    console.error('[intake-forms] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/intake-forms/:templateId ─────────────────────────────────────
// Auth required (freelancer). Deactivates the template (soft delete).
router.delete('/:templateId', authenticateToken, requireDb, async (req, res) => {
  try {
    const prisma       = getPrisma();
    const freelancerId = req.user._id.toString();
    const { templateId } = req.params;

    const template = await prisma.intakeFormTemplate.findUnique({ where: { id: templateId } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.freelancerId !== freelancerId) return res.status(403).json({ error: 'Not your template' });

    await prisma.intakeFormTemplate.update({
      where: { id: templateId },
      data:  { isActive: false },
    });

    res.json({ deactivated: true });
  } catch (err) {
    console.error('[intake-forms] DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/intake-forms/:templateId/respond ───────────────────────────────
// Auth required (client). Submit or update a response.
router.post('/:templateId/respond', authenticateToken, requireDb, async (req, res) => {
  try {
    const prisma    = getPrisma();
    const clientId  = req.user._id.toString();
    const { templateId } = req.params;
    const { bookingId, responses } = req.body;

    if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });
    if (!responses || typeof responses !== 'object') return res.status(400).json({ error: 'responses must be an object' });

    // Verify booking belongs to this client
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== clientId) return res.status(403).json({ error: 'Not your booking' });

    const template = await prisma.intakeFormTemplate.findUnique({ where: { id: templateId } });
    if (!template || !template.isActive) return res.status(404).json({ error: 'Template not found or inactive' });

    // Validate required fields
    const fields = Array.isArray(template.fieldsJson) ? template.fieldsJson : [];
    const missing = fields
      .filter(f => f.required && (responses[f.id] === undefined || responses[f.id] === '' || responses[f.id] === null))
      .map(f => f.label);

    if (missing.length > 0) {
      return res.status(400).json({ error: `Required fields missing: ${missing.join(', ')}` });
    }

    // Upsert response
    const existing = await prisma.intakeFormResponse.findFirst({
      where: { templateId, bookingId },
    });

    let response;
    if (existing) {
      response = await prisma.intakeFormResponse.update({
        where: { id: existing.id },
        data:  { responsesJson: responses, submittedAt: new Date() },
      });
    } else {
      response = await prisma.intakeFormResponse.create({
        data: { templateId, bookingId, clientId, responsesJson: responses },
      });
    }

    res.status(existing ? 200 : 201).json({ response });
  } catch (err) {
    console.error('[intake-forms/respond] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/intake-forms/:serviceId ─────────────────────────────────────────
// Public, no auth. Returns the active template for a service (or freelancer default).
router.get('/:serviceId', requireDb, async (req, res) => {
  try {
    const prisma = getPrisma();
    const { serviceId } = req.params;

    // Try service-specific first, then global default (serviceId = null)
    let template = await prisma.intakeFormTemplate.findFirst({
      where: { serviceId, isActive: true },
    });

    if (!template) {
      // Look up the freelancer who owns this service from the params or query
      const { freelancerId } = req.query;
      if (freelancerId) {
        template = await prisma.intakeFormTemplate.findFirst({
          where: { freelancerId, serviceId: null, isActive: true },
        });
      }
    }

    res.json({ template: template || null });
  } catch (err) {
    console.error('[intake-forms/:serviceId] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
