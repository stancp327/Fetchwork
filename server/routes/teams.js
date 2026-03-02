const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Team = require('../models/Team');
const User = require('../models/User');

// All routes require auth
router.use(authenticateToken);

// ── GET /api/teams — list user's teams ──
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find({
      'members.user': req.user.userId,
      'members.status': 'active',
      isActive: true,
    })
      .populate('owner', 'firstName lastName email profileImage')
      .populate('members.user', 'firstName lastName email profileImage')
      .lean();

    res.json({ teams });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// ── POST /api/teams — create a team ──
router.post('/', async (req, res) => {
  try {
    const { name, type = 'client_team', description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Team name is required' });

    // Check user doesn't already own too many teams
    const existing = await Team.countDocuments({ owner: req.user.userId, isActive: true });
    if (existing >= 5) return res.status(400).json({ error: 'Maximum 5 teams per user' });

    const team = await Team.create({
      name: name.trim(),
      type,
      description: description?.trim() || '',
      owner: req.user.userId,
      members: [{
        user: req.user.userId,
        role: 'owner',
        permissions: ['manage_members', 'manage_billing', 'approve_orders', 'create_jobs', 'manage_services', 'view_analytics', 'message_clients', 'assign_work'],
        status: 'active',
        joinedAt: new Date(),
      }],
    });

    // Add team ref to user
    await User.findByIdAndUpdate(req.user.userId, { $addToSet: { teams: team._id } });

    const populated = await Team.findById(team._id)
      .populate('owner', 'firstName lastName email profileImage')
      .populate('members.user', 'firstName lastName email profileImage');

    res.status(201).json({ team: populated });
  } catch (err) {
    console.error('Create team error:', err.message);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// ── GET /api/teams/:id — team detail ──
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('owner', 'firstName lastName email profileImage')
      .populate('members.user', 'firstName lastName email profileImage');

    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    res.json({ team });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// ── PUT /api/teams/:id — update team settings ──
router.put('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (!team.isOwnerOrAdmin(req.user.userId)) return res.status(403).json({ error: 'Admin access required' });

    const allowed = ['name', 'description', 'logo', 'website', 'specialties', 'isPublic', 'billingEmail', 'approvalThreshold', 'settings'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) team[field] = req.body[field];
    });

    await team.save();
    res.json({ team });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// ── POST /api/teams/:id/invite — invite a member ──
router.post('/:id/invite', async (req, res) => {
  try {
    const { email, role = 'member', permissions, title } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (!team.hasPermission(req.user.userId, 'manage_members')) {
      return res.status(403).json({ error: 'No permission to manage members' });
    }

    // Find user by email
    const invitee = await User.findOne({ email: email.toLowerCase().trim() }).select('_id firstName lastName email');
    if (!invitee) return res.status(404).json({ error: 'No user found with that email. They must have a Fetchwork account first.' });

    // Check if already a member
    const existing = team.members.find(m => m.user.toString() === invitee._id.toString());
    if (existing && existing.status === 'active') {
      return res.status(400).json({ error: 'User is already a team member' });
    }
    if (existing && existing.status === 'invited') {
      return res.status(400).json({ error: 'User already has a pending invitation' });
    }

    // Prevent non-owners from inviting admins
    if (role === 'admin' || role === 'owner') {
      const inviter = team.getMember(req.user.userId);
      if (inviter.role !== 'owner') {
        return res.status(403).json({ error: 'Only the team owner can invite admins' });
      }
    }

    // Max 50 members
    if (team.members.filter(m => m.status !== 'removed').length >= 50) {
      return res.status(400).json({ error: 'Maximum 50 members per team' });
    }

    const defaultPerms = team.settings?.defaultMemberPermissions || ['view_analytics', 'message_clients'];

    team.members.push({
      user: invitee._id,
      role: role === 'owner' ? 'member' : role, // can't invite as owner
      permissions: permissions || defaultPerms,
      title: title || '',
      invitedBy: req.user.userId,
      status: 'invited',
    });

    await team.save();

    // TODO: Send invitation email/notification to invitee

    res.json({ message: `Invitation sent to ${invitee.firstName} ${invitee.lastName}`, team });
  } catch (err) {
    console.error('Invite error:', err.message);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// ── POST /api/teams/:id/accept — accept invitation ──
router.post('/:id/accept', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const member = team.members.find(m => m.user.toString() === req.user.userId && m.status === 'invited');
    if (!member) return res.status(404).json({ error: 'No pending invitation found' });

    member.status = 'active';
    member.joinedAt = new Date();
    await team.save();

    await User.findByIdAndUpdate(req.user.userId, { $addToSet: { teams: team._id } });

    res.json({ message: 'Joined the team!', team });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// ── POST /api/teams/:id/decline — decline invitation ──
router.post('/:id/decline', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const idx = team.members.findIndex(m => m.user.toString() === req.user.userId && m.status === 'invited');
    if (idx === -1) return res.status(404).json({ error: 'No pending invitation found' });

    team.members.splice(idx, 1);
    await team.save();

    res.json({ message: 'Invitation declined' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

// ── DELETE /api/teams/:id/members/:userId — remove a member ──
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const targetUserId = req.params.userId;
    const isSelf = targetUserId === req.user.userId;

    // Can't remove the owner
    const target = team.members.find(m => m.user.toString() === targetUserId);
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.role === 'owner') return res.status(400).json({ error: "Can't remove the team owner" });

    // Must be self (leaving) or have manage_members permission
    if (!isSelf && !team.hasPermission(req.user.userId, 'manage_members')) {
      return res.status(403).json({ error: 'No permission to remove members' });
    }

    target.status = 'removed';
    await team.save();

    await User.findByIdAndUpdate(targetUserId, { $pull: { teams: team._id } });

    res.json({ message: isSelf ? 'Left the team' : 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ── PATCH /api/teams/:id/members/:userId — update member role/permissions ──
router.patch('/:id/members/:userId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (!team.hasPermission(req.user.userId, 'manage_members')) {
      return res.status(403).json({ error: 'No permission to manage members' });
    }

    const member = team.getMember(req.params.userId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.role === 'owner') return res.status(400).json({ error: "Can't modify the owner" });

    // Only owner can promote to admin
    if (req.body.role === 'admin') {
      const requester = team.getMember(req.user.userId);
      if (requester.role !== 'owner') return res.status(403).json({ error: 'Only owner can promote to admin' });
    }

    if (req.body.role) member.role = req.body.role;
    if (req.body.permissions) member.permissions = req.body.permissions;
    if (req.body.title !== undefined) member.title = req.body.title;

    await team.save();
    res.json({ message: 'Member updated', member });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// ── GET /api/teams/:id/invitations — pending invitations for current user ──
router.get('/invitations/pending', async (req, res) => {
  try {
    const teams = await Team.find({
      'members.user': req.user.userId,
      'members.status': 'invited',
      isActive: true,
    })
      .populate('owner', 'firstName lastName email profileImage')
      .select('name type description owner')
      .lean();

    res.json({ invitations: teams });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// ── DELETE /api/teams/:id — delete team (owner only) ──
router.delete('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const member = team.getMember(req.user.userId);
    if (!member || member.role !== 'owner') {
      return res.status(403).json({ error: 'Only the team owner can delete the team' });
    }

    team.isActive = false;
    await team.save();

    // Remove team ref from all members
    const memberIds = team.members.map(m => m.user);
    await User.updateMany({ _id: { $in: memberIds } }, { $pull: { teams: team._id } });

    res.json({ message: 'Team deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// ── GET /api/teams/agencies/public — public agency directory ──
router.get('/agencies/public', async (req, res) => {
  try {
    const { page = 1, limit = 20, specialty } = req.query;
    const query = { type: 'agency', isPublic: true, isActive: true };
    if (specialty) query.specialties = specialty;

    const [agencies, total] = await Promise.all([
      Team.find(query)
        .populate('owner', 'firstName lastName profileImage')
        .populate('members.user', 'firstName lastName profileImage')
        .select('name slug description logo specialties members portfolio')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Team.countDocuments(query),
    ]);

    res.json({ agencies, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agencies' });
  }
});

module.exports = router;
