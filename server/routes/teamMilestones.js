const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Team = require('../models/Team');
const TeamMilestone = require('../models/TeamMilestone');

// All routes require auth
router.use(authenticateToken);

function getId(value) {
  return String(value?._id || value?.id || value || '');
}

function resolveRequester(req) {
  return String(req.user?.userId || req.user?._id || req.user?.id || '');
}

function getMemberRole(team, userId) {
  const ownerId = getId(team.owner);
  if (ownerId === userId) return 'owner';
  const member = (team.members || []).find(
    (m) => getId(m.user) === userId && m.status === 'active'
  );
  return member?.role || null;
}

function isManagerOrAbove(role) {
  return ['owner', 'admin', 'manager'].includes(role);
}

// GET /api/team-milestones/:teamId — list milestones
router.get('/:teamId', async (req, res) => {
  try {
    const requesterId = resolveRequester(req);
    const team = await Team.findById(req.params.teamId);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const role = getMemberRole(team, requesterId);
    if (!role) return res.status(403).json({ error: 'Not a team member' });

    const filter = { team: team._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.job) filter.job = req.query.job;

    const milestones = await TeamMilestone.find(filter)
      .populate('assignee', 'firstName lastName email profileImage')
      .populate('job', 'title')
      .populate('approvedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();

    res.json({ milestones, userRole: role });
  } catch (err) {
    console.error('List team milestones error:', err.message);
    res.status(500).json({ error: 'Failed to load milestones' });
  }
});

// POST /api/team-milestones/:teamId — create milestone
router.post('/:teamId', async (req, res) => {
  try {
    const requesterId = resolveRequester(req);
    const team = await Team.findById(req.params.teamId);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const role = getMemberRole(team, requesterId);
    if (!role) return res.status(403).json({ error: 'Not a team member' });

    const { title, description, assignee, dueDate, amount, job } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    // Validate assignee is a team member if provided
    if (assignee) {
      const assigneeRole = getMemberRole(team, String(assignee));
      if (!assigneeRole) return res.status(400).json({ error: 'Assignee is not a team member' });
    }

    const milestone = await TeamMilestone.create({
      team: team._id,
      title: title.trim(),
      description: description || '',
      assignee: assignee || null,
      dueDate: dueDate || null,
      amount: amount != null ? Number(amount) : null,
      job: job || null,
      createdBy: req.user._id,
    });

    const populated = await TeamMilestone.findById(milestone._id)
      .populate('assignee', 'firstName lastName email profileImage')
      .populate('job', 'title')
      .populate('createdBy', 'firstName lastName')
      .lean();

    res.status(201).json({ milestone: populated });
  } catch (err) {
    console.error('Create team milestone error:', err.message);
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

// PUT /api/team-milestones/:teamId/:milestoneId — update milestone
router.put('/:teamId/:milestoneId', async (req, res) => {
  try {
    const requesterId = resolveRequester(req);
    const team = await Team.findById(req.params.teamId);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const role = getMemberRole(team, requesterId);
    if (!role) return res.status(403).json({ error: 'Not a team member' });

    const milestone = await TeamMilestone.findOne({
      _id: req.params.milestoneId,
      team: team._id,
    });
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    const { title, description, assignee, dueDate, amount, job, status } = req.body;
    if (title !== undefined) milestone.title = title.trim();
    if (description !== undefined) milestone.description = description;
    if (assignee !== undefined) milestone.assignee = assignee || null;
    if (dueDate !== undefined) milestone.dueDate = dueDate || null;
    if (amount !== undefined) milestone.amount = amount != null ? Number(amount) : null;
    if (job !== undefined) milestone.job = job || null;
    if (status !== undefined) milestone.status = status;

    await milestone.save();

    const populated = await TeamMilestone.findById(milestone._id)
      .populate('assignee', 'firstName lastName email profileImage')
      .populate('job', 'title')
      .populate('approvedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .lean();

    res.json({ milestone: populated });
  } catch (err) {
    console.error('Update team milestone error:', err.message);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

// DELETE /api/team-milestones/:teamId/:milestoneId — delete (owner/admin only)
router.delete('/:teamId/:milestoneId', async (req, res) => {
  try {
    const requesterId = resolveRequester(req);
    const team = await Team.findById(req.params.teamId);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const role = getMemberRole(team, requesterId);
    if (!['owner', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Only team owner or admin can delete milestones' });
    }

    const milestone = await TeamMilestone.findOneAndDelete({
      _id: req.params.milestoneId,
      team: team._id,
    });
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    res.json({ message: 'Milestone deleted' });
  } catch (err) {
    console.error('Delete team milestone error:', err.message);
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
});

// POST /api/team-milestones/:teamId/:milestoneId/complete — mark complete + note
router.post('/:teamId/:milestoneId/complete', async (req, res) => {
  try {
    const requesterId = resolveRequester(req);
    const team = await Team.findById(req.params.teamId);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const role = getMemberRole(team, requesterId);
    if (!role) return res.status(403).json({ error: 'Not a team member' });

    const milestone = await TeamMilestone.findOne({
      _id: req.params.milestoneId,
      team: team._id,
    });
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    milestone.status = 'review';
    if (req.body.completionNote) milestone.completionNote = req.body.completionNote;
    await milestone.save();

    const populated = await TeamMilestone.findById(milestone._id)
      .populate('assignee', 'firstName lastName email profileImage')
      .populate('job', 'title')
      .populate('createdBy', 'firstName lastName')
      .lean();

    res.json({ milestone: populated });
  } catch (err) {
    console.error('Complete team milestone error:', err.message);
    res.status(500).json({ error: 'Failed to complete milestone' });
  }
});

// POST /api/team-milestones/:teamId/:milestoneId/approve — approve (manager+)
router.post('/:teamId/:milestoneId/approve', async (req, res) => {
  try {
    const requesterId = resolveRequester(req);
    const team = await Team.findById(req.params.teamId);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const role = getMemberRole(team, requesterId);
    if (!isManagerOrAbove(role)) {
      return res.status(403).json({ error: 'Only managers and above can approve milestones' });
    }

    const milestone = await TeamMilestone.findOne({
      _id: req.params.milestoneId,
      team: team._id,
    });
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
    if (milestone.status !== 'review') {
      return res.status(400).json({ error: 'Milestone must be in review to approve' });
    }

    milestone.status = 'completed';
    milestone.approvedBy = req.user._id;
    milestone.approvedAt = new Date();
    await milestone.save();

    const populated = await TeamMilestone.findById(milestone._id)
      .populate('assignee', 'firstName lastName email profileImage')
      .populate('job', 'title')
      .populate('approvedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .lean();

    res.json({ milestone: populated });
  } catch (err) {
    console.error('Approve team milestone error:', err.message);
    res.status(500).json({ error: 'Failed to approve milestone' });
  }
});

module.exports = router;
