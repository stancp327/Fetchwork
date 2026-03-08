const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Presentation = require('../models/Presentation');
const Team = require('../models/Team');

// ── Helpers ──────────────────────────────────────────────────────
function getId(value) {
  return String(value?._id || value?.id || value || '');
}

function resolveRequester(req) {
  return getId(req.user?.userId || req.user?._id || req.user?.id);
}

async function findTeamAndAuthorize(teamId, requesterId) {
  const team = await Team.findById(teamId).populate('members.user', 'firstName lastName email profileImage');
  if (!team) return { error: 'Team not found', status: 404 };
  const member = team.members.find(m => getId(m.user) === requesterId && m.status === 'active');
  if (!member) return { error: 'Not a member of this team', status: 403 };
  return { team, member };
}

// ── Public routes (no auth) ──────────────────────────────────────

// GET /api/presentations/view/:slug — public view
router.get('/view/:slug', async (req, res) => {
  try {
    const presentation = await Presentation.findOne({ slug: req.params.slug })
      .populate('team', 'name logo slug description')
      .populate('createdBy', 'firstName lastName');

    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    // Increment view count
    presentation.viewCount = (presentation.viewCount || 0) + 1;
    if (!presentation.viewedAt) presentation.viewedAt = new Date();
    if (presentation.status === 'sent') presentation.status = 'viewed';
    await presentation.save();

    res.json({ presentation });
  } catch (err) {
    console.error('Public view error:', err.message);
    res.status(500).json({ error: 'Failed to load presentation' });
  }
});

// POST /api/presentations/view/:slug/respond — client accepts/declines
router.post('/view/:slug/respond', async (req, res) => {
  try {
    const { action, clientNote } = req.body;
    if (!['accepted', 'declined'].includes(action)) {
      return res.status(400).json({ error: 'Action must be accepted or declined' });
    }

    const presentation = await Presentation.findOne({ slug: req.params.slug });
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    if (['accepted', 'declined'].includes(presentation.status)) {
      return res.status(400).json({ error: 'Presentation has already been responded to' });
    }

    presentation.status = action;
    presentation.respondedAt = new Date();
    if (clientNote) presentation.clientNote = clientNote;
    await presentation.save();

    res.json({ message: `Proposal ${action}`, status: action });
  } catch (err) {
    console.error('Respond error:', err.message);
    res.status(500).json({ error: 'Failed to respond' });
  }
});

// ── Auth middleware (everything below requires auth) ──────────────
router.use(authenticateToken);

// POST /api/presentations — create
router.post('/', async (req, res) => {
  try {
    const requesterId = resolveRequester(req);
    const { team: teamId, title, clientName, clientEmail, sections, proposedMilestones, totalAmount, validUntil } = req.body;

    if (!teamId || !title) {
      return res.status(400).json({ error: 'Team and title are required' });
    }

    const { error, status } = await findTeamAndAuthorize(teamId, requesterId);
    if (error) return res.status(status).json({ error });

    const presentation = await Presentation.create({
      team: teamId,
      createdBy: requesterId,
      title,
      clientName,
      clientEmail,
      sections: sections || [],
      proposedMilestones: proposedMilestones || [],
      totalAmount,
      validUntil,
    });

    res.status(201).json({ presentation, message: 'Presentation created' });
  } catch (err) {
    console.error('Create presentation error:', err.message);
    res.status(500).json({ error: 'Failed to create presentation' });
  }
});

// GET /api/presentations — list for user's teams
router.get('/', async (req, res) => {
  try {
    const requesterId = resolveRequester(req);
    const teams = await Team.find({
      'members.user': requesterId,
      'members.status': 'active',
    }).select('_id');

    const teamIds = teams.map(t => t._id);
    const presentations = await Presentation.find({ team: { $in: teamIds } })
      .populate('team', 'name logo slug')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({ presentations });
  } catch (err) {
    console.error('List presentations error:', err.message);
    res.status(500).json({ error: 'Failed to fetch presentations' });
  }
});

// GET /api/presentations/:id — get single
router.get('/:id', async (req, res) => {
  try {
    const requesterId = resolveRequester(req);
    const presentation = await Presentation.findById(req.params.id)
      .populate('team', 'name logo slug description')
      .populate('createdBy', 'firstName lastName email');

    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    const { error, status } = await findTeamAndAuthorize(presentation.team._id || presentation.team, requesterId);
    if (error) return res.status(status).json({ error });

    res.json({ presentation });
  } catch (err) {
    console.error('Get presentation error:', err.message);
    res.status(500).json({ error: 'Failed to fetch presentation' });
  }
});

// PUT /api/presentations/:id — update
router.put('/:id', async (req, res) => {
  try {
    const requesterId = resolveRequester(req);
    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    const { error, status } = await findTeamAndAuthorize(presentation.team, requesterId);
    if (error) return res.status(status).json({ error });

    const allowed = ['title', 'clientName', 'clientEmail', 'sections', 'proposedMilestones', 'totalAmount', 'validUntil', 'status'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) presentation[key] = req.body[key];
    }

    await presentation.save();

    const populated = await Presentation.findById(presentation._id)
      .populate('team', 'name logo slug description')
      .populate('createdBy', 'firstName lastName email');

    res.json({ presentation: populated, message: 'Presentation updated' });
  } catch (err) {
    console.error('Update presentation error:', err.message);
    res.status(500).json({ error: 'Failed to update presentation' });
  }
});

// DELETE /api/presentations/:id — delete (owner/admin)
router.delete('/:id', async (req, res) => {
  try {
    const requesterId = resolveRequester(req);
    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    const { error, status, member } = await findTeamAndAuthorize(presentation.team, requesterId);
    if (error) return res.status(status).json({ error });

    const isCreator = getId(presentation.createdBy) === requesterId;
    const isAdminOrOwner = ['owner', 'admin'].includes(member.role);
    if (!isCreator && !isAdminOrOwner) {
      return res.status(403).json({ error: 'Only the creator or team admin can delete' });
    }

    await presentation.deleteOne();
    res.json({ message: 'Presentation deleted' });
  } catch (err) {
    console.error('Delete presentation error:', err.message);
    res.status(500).json({ error: 'Failed to delete presentation' });
  }
});

// POST /api/presentations/:id/send — mark as sent
router.post('/:id/send', async (req, res) => {
  try {
    const requesterId = resolveRequester(req);
    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    const { error, status } = await findTeamAndAuthorize(presentation.team, requesterId);
    if (error) return res.status(status).json({ error });

    presentation.status = 'sent';
    await presentation.save();

    res.json({ presentation, message: 'Presentation marked as sent' });
  } catch (err) {
    console.error('Send presentation error:', err.message);
    res.status(500).json({ error: 'Failed to send presentation' });
  }
});

module.exports = router;
