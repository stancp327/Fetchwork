const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Team = require('../models/Team');
const User = require('../models/User');
const Notification = require('../models/Notification');
const BillingCredit = require('../models/BillingCredit');
const TeamAuditLog = require('../models/TeamAuditLog');
const TeamApproval = require('../models/TeamApproval');
const TeamClient = require('../models/TeamClient');
const emailService = require('../services/emailService');
const { hasFeature, FEATURES } = require('../services/entitlementEngine');
const { getUserSubscription } = require('../utils/billingUtils');

const PLAN_LIMITS = { free: { teams: 0 }, pro: { teams: 1, members: 5 }, business: { teams: 3, members: 10 }, default: { teams: 1, members: 5 } };

async function getUserPlanName(userId) {
  try {
    const sub = await getUserSubscription(userId);
    return sub?.plan?.name?.toLowerCase() || 'free';
  } catch {
    return 'free';
  }
}

// All routes require auth
router.use(authenticateToken);

const VALID_ROLES = ['owner', 'admin', 'manager', 'member'];
const TEAM_PERMISSION_KEYS = [
  'manage_members',
  'manage_billing',
  'approve_orders',
  'create_jobs',
  'manage_services',
  'view_analytics',
  'message_clients',
  'assign_work',
];

function getId(value) {
  return String(value?._id || value?.id || value || '');
}

function normalizeTeamForUser(team, userId) {
  const normalized = team.toObject ? team.toObject() : team;
  const uid = String(userId);

  const myMember = (normalized.members || []).find((m) =>
    getId(m.user) === uid && m.status === 'active'
  );

  const ownerId = getId(normalized.owner);
  const currentUserRole = myMember?.role || (ownerId === uid ? 'owner' : null);
  const currentUserIsOwner = currentUserRole === 'owner';
  const currentUserCanManageMembers = ['owner', 'admin'].includes(currentUserRole);

  return {
    ...normalized,
    currentUserRole,
    currentUserIsOwner,
    currentUserCanDelete: currentUserIsOwner,
    currentUserCanManageMembers,
  };
}

function resolveRequester(req) {
  const id = String(req.user?.userId || req.user?._id || req.user?.id || '');
  return { id };
}

function getTeamAccessContext(team, requesterId) {
  const ownerId = getId(team.owner);
  const activeMember = (team.members || []).find((m) =>
    getId(m.user) === requesterId && m.status === 'active'
  );

  const role = ownerId === requesterId ? 'owner' : (activeMember?.role || null);
  const isOwner = role === 'owner';
  const isAdmin = role === 'admin';

  const builtInPermissions = new Set(activeMember?.permissions || []);
  const customRoleName = activeMember?.customRoleName || '';
  const customRole = customRoleName
    ? (team.customRoles || []).find((r) => r.name === customRoleName)
    : null;
  const customRolePermissions = new Set(customRole?.permissions || []);
  const resolvedPermissions = new Set([...builtInPermissions, ...customRolePermissions]);

  return {
    isOwner,
    isAdmin,
    isMember: Boolean(activeMember || isOwner),
    role,
    customRoleName,
    permissions: resolvedPermissions,
    resolvedPermissions: [...resolvedPermissions],
    canManageMembers: isOwner || isAdmin || resolvedPermissions.has('manage_members'),
    canManageBilling: isOwner || isAdmin || resolvedPermissions.has('manage_billing'),
    canApproveOrders: isOwner || isAdmin || resolvedPermissions.has('approve_orders'),
    canAssignWork: isOwner || isAdmin || resolvedPermissions.has('assign_work'),
    canManagePortfolio: isOwner || isAdmin || resolvedPermissions.has('manage_services'),
    canReadBilling: isOwner || isAdmin || resolvedPermissions.has('manage_billing') || resolvedPermissions.has('view_analytics'),
  };
}

function authorizeTeamAction({ team, requesterId, action }) {
  const ctx = getTeamAccessContext(team, requesterId);

  const allowed = {
    read_team: ctx.isMember,
    manage_team: ctx.isOwner || ctx.isAdmin,
    invite_member: ctx.canManageMembers,
    remove_member: ctx.canManageMembers,
    update_member_role: ctx.canManageMembers,
    promote_admin: ctx.isOwner,
    transfer_ownership: ctx.isOwner,
    delete_team: ctx.isOwner,
    manage_billing: ctx.canManageBilling,
    read_billing: ctx.canReadBilling,
    assign_work: ctx.canAssignWork,
    read_assignments: ctx.isMember,
    read_activity: ctx.isMember,
    read_approvals: ctx.canApproveOrders,
    decide_approvals: ctx.canApproveOrders,
    manage_portfolio: ctx.canManagePortfolio,
    read_audit_logs: ctx.isOwner || ctx.isAdmin,
  };

  return { ok: Boolean(allowed[action]), ctx };
}

function getRequestContext(req) {
  return {
    ipAddress: String(req.ip || req.headers['x-forwarded-for'] || ''),
    userAgent: String(req.get('user-agent') || ''),
  };
}

async function logTeamAudit({ teamId, actorId, action, targetUser = null, before = null, after = null, reason = '', metadata = null, req }) {
  return TeamAuditLog.logSafe({
    team: teamId,
    actor: actorId,
    action,
    targetUser,
    before,
    after,
    reason,
    metadata,
    ...(req ? getRequestContext(req) : {}),
  });
}

function buildLockVersionFilter(lockVersion) {
  const v = Number(lockVersion || 0);
  if (v === 0) {
    return { $or: [{ lockVersion: 0 }, { lockVersion: { $exists: false } }] };
  }
  return { lockVersion: v };
}

function buildIdleTransferStateFilter() {
  return { $or: [{ transferState: 'idle' }, { transferState: { $exists: false } }] };
}

// â”€â”€ GET /api/teams â€” list user's teams â”€â”€
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id || req.user.id;
    const userObjectId = req.user._id;

    // Query owner teams + active-member teams independently, with populate,
    // then merge/dedupe in-memory. This avoids brittle mixed-id query behavior.
    const [ownedTeams, memberTeams] = await Promise.all([
      Team.find({ isActive: true, owner: userObjectId })
        .populate('owner', 'firstName lastName email profileImage')
        .populate('members.user', 'firstName lastName email profileImage')
        .lean(),
      Team.find({
        isActive: true,
        members: { $elemMatch: { user: userObjectId, status: 'active' } },
      })
        .populate('owner', 'firstName lastName email profileImage')
        .populate('members.user', 'firstName lastName email profileImage')
        .lean(),
    ]);

    const teamMap = new Map();
    [...ownedTeams, ...memberTeams].forEach((team) => {
      teamMap.set(String(team._id), team);
    });

    const teams = [...teamMap.values()];

    const normalizedTeams = teams.map((team) => normalizeTeamForUser(team, userId));

    res.json({ teams: normalizedTeams });
  } catch (err) {
    console.error('Fetch teams error:', err.message);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// â”€â”€ POST /api/teams â€” create a team â”€â”€
router.post('/', async (req, res) => {
  try {
    const { name, type = 'client_team', description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Team name is required' });

    const userObjectId = req.user._id;
    const userId = req.user.userId || req.user._id || req.user.id;

    // Plan-based team access check
    const canUseTeams = await hasFeature(userId, FEATURES.TEAM_ACCOUNTS);
    if (!canUseTeams) {
      return res.status(403).json({ error: 'Teams require a paid plan.', upgrade_required: true });
    }

    const planName = await getUserPlanName(userId);
    const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.default;

    // Check user doesn't already own too many teams
    const existing = await Team.countDocuments({ owner: userObjectId, isActive: true });
    if (existing >= limits.teams) {
      return res.status(403).json({ error: 'team_limit_reached', limit: limits.teams, plan: planName });
    }

    const team = await Team.create({
      name: name.trim(),
      type,
      description: description?.trim() || '',
      owner: userObjectId,
      members: [{
        user: userObjectId,
        role: 'owner',
        permissions: ['manage_members', 'manage_billing', 'approve_orders', 'create_jobs', 'manage_services', 'view_analytics', 'message_clients', 'assign_work'],
        status: 'active',
        joinedAt: new Date(),
      }],
    });

    // Add team ref to user
    await User.findByIdAndUpdate(userObjectId, { $addToSet: { teams: team._id } });

    const populated = await Team.findById(team._id)
      .populate('owner', 'firstName lastName email profileImage')
      .populate('members.user', 'firstName lastName email profileImage')
      .lean();

    res.status(201).json({ team: normalizeTeamForUser(populated, req.user.userId) });
  } catch (err) {
    console.error('Create team error:', err.message);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// â”€â”€ GET /api/teams/:id â€” team detail â”€â”€
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id || req.user.id;
    const team = await Team.findById(req.params.id)
      .populate('owner', 'firstName lastName email profileImage')
      .populate('members.user', 'firstName lastName email profileImage')
      .lean();

    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const ownerId = getId(team.owner);
    const isMember = (team.members || []).some((m) =>
      String(m.user?._id || m.user?.id || m.user) === String(userId) && m.status === 'active'
    );
    const isOwner = ownerId === String(userId);

    if (!isMember && !isOwner) return res.status(403).json({ error: 'Not a team member' });

    res.json({ team: normalizeTeamForUser(team, userId) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// â”€â”€ PUT /api/teams/:id â€” update team settings â”€â”€
router.put('/:id', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'manage_team' });
    if (!authz.ok) return res.status(403).json({ error: 'Admin access required' });

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

// â”€â”€ POST /api/teams/:id/invite â€” invite a member â”€â”€
router.post('/:id/invite', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const { email, role = 'member', permissions, title } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'invite_member' });
    if (!authz.ok) {
      return res.status(403).json({ error: 'No permission to manage members' });
    }

    // Find user by email
    const invitee = await User.findOne({ email: email.toLowerCase().trim() }).select('_id firstName lastName email');
    if (!invitee) return res.status(404).json({ error: 'No user found with that email. They must have a Fetchwork account first.' });

    if (String(invitee._id) === requesterId) {
      return res.status(400).json({ error: 'You cannot invite yourself to your own team' });
    }

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
      const promoteAuthz = authorizeTeamAction({ team, requesterId, action: 'promote_admin' });
      if (!promoteAuthz.ok) {
        return res.status(403).json({ error: 'Only the team owner can invite admins' });
      }
    }

    // Plan-based member limit
    const inviterPlanName = await getUserPlanName(requesterId);
    const inviterLimits = PLAN_LIMITS[inviterPlanName] || PLAN_LIMITS.default;
    const memberLimit = inviterLimits.members || 50;
    const activeMemberCount = team.members.filter(m => m.status !== 'removed').length;
    if (activeMemberCount >= memberLimit) {
      return res.status(403).json({ error: 'member_limit_reached', limit: memberLimit });
    }

    const safeRole = VALID_ROLES.includes(role) && role !== 'owner' ? role : 'member';
    const defaultPerms = team.settings?.defaultMemberPermissions || ['view_analytics', 'message_clients'];

    if (existing && existing.status === 'removed') {
      existing.status = 'invited';
      existing.role = safeRole;
      existing.permissions = permissions || defaultPerms;
      existing.title = title || '';
      existing.invitedBy = req.user.userId;
      existing.invitedAt = new Date();
    } else {
      team.members.push({
        user: invitee._id,
        role: safeRole,
        permissions: permissions || defaultPerms,
        title: title || '',
        invitedBy: req.user.userId,
        status: 'invited',
      });
    }

    await team.save();

    const inviteLink = `${process.env.CLIENT_URL || 'https://www.fetchwork.net'}/teams`;
    await emailService.sendEmail(
      invitee.email,
      `You're invited to join ${team.name} on FetchWork`,
      `<p>Hi ${invitee.firstName || 'there'},</p>
       <p>${req.user.email || 'A team admin'} invited you to join <strong>${team.name}</strong> as <strong>${safeRole}</strong>.</p>
       <p>Open your Teams page to accept or decline this invite.</p>
       <div style="text-align:center; margin:24px 0;">
         <a href="${inviteLink}" style="background:#4285f4;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">View Team Invitation</a>
       </div>`,
      'Team Invitation'
    );

    await Notification.notify({
      recipient: invitee._id,
      type: 'team_invitation',
      title: 'Team invitation',
      message: `${req.user.firstName || req.user.email || 'A team admin'} invited you to join ${team.name} as ${safeRole}.`,
      link: '/teams',
    });

    res.json({ message: `Invitation sent to ${invitee.firstName} ${invitee.lastName}`, team });
  } catch (err) {
    console.error('Invite error:', err.message);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// â”€â”€ POST /api/teams/:id/accept â€” accept invitation â”€â”€
router.post('/:id/accept', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const member = team.members.find(m => m.user.toString() === req.user.userId && m.status === 'invited');
    if (!member) return res.status(404).json({ error: 'No pending invitation found' });

    const inviterId = member.invitedBy || team.owner;

    member.status = 'active';
    member.joinedAt = new Date();
    await team.save();

    await User.findByIdAndUpdate(req.user.userId, { $addToSet: { teams: team._id } });

    await Notification.notify({
      recipient: inviterId,
      type: 'team_invitation_accepted',
      title: 'Team invite accepted',
      message: `${req.user.firstName || req.user.email || 'A user'} accepted your invitation to join ${team.name}.`,
      link: `/teams/${team._id}`,
    });

    res.json({ message: 'Joined the team!', team });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// â”€â”€ POST /api/teams/:id/decline â€” decline invitation â”€â”€
router.post('/:id/decline', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const idx = team.members.findIndex(m => m.user.toString() === req.user.userId && m.status === 'invited');
    if (idx === -1) return res.status(404).json({ error: 'No pending invitation found' });

    const inviterId = team.members[idx]?.invitedBy || team.owner;

    team.members.splice(idx, 1);
    await team.save();

    await Notification.notify({
      recipient: inviterId,
      type: 'team_invitation_declined',
      title: 'Team invite declined',
      message: `${req.user.firstName || req.user.email || 'A user'} declined your invitation to join ${team.name}.`,
      link: `/teams/${team._id}`,
    });

    res.json({ message: 'Invitation declined' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

// â”€â”€ DELETE /api/teams/:id/members/:userId â€” remove a member â”€â”€
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const targetUserId = req.params.userId;
    const isSelf = targetUserId === requesterId;

    // Can't remove the owner
    const target = team.members.find(m => m.user.toString() === targetUserId);
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.role === 'owner') return res.status(400).json({ error: "Can't remove the team owner" });

    // Must be self (leaving) or have manage_members permission
    if (!isSelf) {
      const authz = authorizeTeamAction({ team, requesterId, action: 'remove_member' });
      if (!authz.ok) {
        return res.status(403).json({ error: 'No permission to remove members' });
      }
    }

    target.status = 'removed';
    await team.save();

    await User.findByIdAndUpdate(targetUserId, { $pull: { teams: team._id } });

    res.json({ message: isSelf ? 'Left the team' : 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// â”€â”€ PATCH /api/teams/:id/members/:userId â€” update member role/permissions â”€â”€
router.patch('/:id/members/:userId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'update_member_role' });
    if (!authz.ok) {
      return res.status(403).json({ error: 'No permission to manage members' });
    }

    const member = team.getMember(req.params.userId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.role === 'owner') return res.status(400).json({ error: "Can't modify the owner" });

    // Only owner can promote to admin
    if (req.body.role === 'admin') {
      const promoteAuthz = authorizeTeamAction({ team, requesterId, action: 'promote_admin' });
      if (!promoteAuthz.ok) return res.status(403).json({ error: 'Only owner can promote to admin' });
    }

    const setOps = {};

    if (req.body.role !== undefined) {
      if (!VALID_ROLES.includes(req.body.role) || req.body.role === 'owner') {
        return res.status(400).json({ error: 'Invalid role' });
      }
      setOps['members.$[target].role'] = req.body.role;
    }

    if (req.body.permissions !== undefined) {
      if (!Array.isArray(req.body.permissions)) {
        return res.status(400).json({ error: 'Permissions must be an array' });
      }
      setOps['members.$[target].permissions'] = req.body.permissions;
    }

    if (req.body.title !== undefined) {
      setOps['members.$[target].title'] = req.body.title;
    }

    if (Object.keys(setOps).length === 0) {
      return res.status(400).json({ error: 'No valid member fields to update' });
    }

    const currentLockVersion = Number(team.lockVersion || 0);
    const updateResult = await Team.updateOne(
      {
        _id: team._id,
        isActive: true,
        ...buildIdleTransferStateFilter(),
        ...buildLockVersionFilter(currentLockVersion),
      },
      {
        $set: setOps,
        $inc: { lockVersion: 1 },
      },
      {
        arrayFilters: [{ 'target._id': member._id, 'target.status': 'active' }],
      }
    );

    if (!updateResult.modifiedCount) {
      return res.status(409).json({ error: 'Team changed while updating member. Please retry.' });
    }

    const updatedTeam = await Team.findById(team._id);
    const updatedMember = updatedTeam?.getMember(req.params.userId);

    await logTeamAudit({
      teamId: team._id,
      actorId: req.user._id,
      action: req.body.role !== undefined
        ? 'member_role_updated'
        : req.body.permissions !== undefined
          ? 'member_permissions_updated'
          : 'member_title_updated',
      targetUser: member.user,
      before: {
        role: member.role,
        permissions: member.permissions,
        title: member.title,
      },
      after: {
        role: updatedMember?.role,
        permissions: updatedMember?.permissions,
        title: updatedMember?.title,
      },
      metadata: { teamLockVersionFrom: currentLockVersion, teamLockVersionTo: currentLockVersion + 1 },
      req,
    });

    res.json({ message: 'Member updated', member: updatedMember });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// â”€â”€ GET /api/teams/invitations/pending â€” pending invitations for current user â”€â”€
router.get('/invitations/pending', async (req, res) => {
  try {
    const requesterId = String(req.user.userId || req.user._id || req.user.id);
    const teams = await Team.find({
      members: { $elemMatch: { user: requesterId, status: 'invited' } },
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

// â”€â”€ POST /api/teams/:id/transfer-ownership â€” transfer ownership (owner only) â”€â”€
router.post('/:id/transfer-ownership', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required' });

    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'transfer_ownership' });
    if (!authz.ok) return res.status(403).json({ error: 'Only the team owner can transfer ownership' });
    if (String(targetUserId) === requesterId) return res.status(400).json({ error: 'Target is already the owner' });

    const targetMember = team.getMember(targetUserId);
    if (!targetMember) return res.status(404).json({ error: 'Target user must be an active team member' });
    if (team.transferState && team.transferState !== 'idle') {
      return res.status(409).json({ error: 'Ownership transfer already in progress' });
    }

    const currentLockVersion = Number(team.lockVersion || 0);
    const beginTransfer = await Team.updateOne(
      {
        _id: team._id,
        isActive: true,
        owner: requesterId,
        ...buildIdleTransferStateFilter(),
        ...buildLockVersionFilter(currentLockVersion),
      },
      {
        $set: { transferState: 'applying', transferTargetUserId: targetUserId },
        $inc: { lockVersion: 1 },
      }
    );

    if (!beginTransfer.modifiedCount) {
      return res.status(409).json({ error: 'Team changed while starting ownership transfer. Please retry.' });
    }

    await logTeamAudit({
      teamId: team._id,
      actorId: req.user._id,
      action: 'ownership_transfer_started',
      targetUser: targetMember.user,
      before: { owner: team.owner },
      after: { transferState: 'applying', transferTargetUserId: targetUserId },
      metadata: { teamLockVersionFrom: currentLockVersion, teamLockVersionTo: currentLockVersion + 1 },
      req,
    });

    const applyTransfer = await Team.updateOne(
      {
        _id: team._id,
        isActive: true,
        owner: requesterId,
        transferState: 'applying',
        transferTargetUserId: targetUserId,
        lockVersion: currentLockVersion + 1,
      },
      {
        $set: {
          owner: targetUserId,
          transferState: 'idle',
          transferTargetUserId: null,
          'members.$[oldOwner].role': 'admin',
          'members.$[newOwner].role': 'owner',
          'members.$[newOwner].status': 'active',
        },
        $inc: { lockVersion: 1 },
      },
      {
        arrayFilters: [
          { 'oldOwner.user': req.user._id, 'oldOwner.status': 'active' },
          { 'newOwner.user': targetMember.user, 'newOwner.status': 'active' },
        ],
      }
    );

    if (!applyTransfer.modifiedCount) {
      await Team.updateOne(
        { _id: team._id, transferState: 'applying', transferTargetUserId: targetUserId },
        { $set: { transferState: 'idle', transferTargetUserId: null } }
      );
      return res.status(409).json({ error: 'Ownership transfer conflicted with another update. Please retry.' });
    }

    const updatedTeam = await Team.findById(team._id)
      .populate('owner', 'firstName lastName email profileImage')
      .populate('members.user', 'firstName lastName email profileImage')
      .lean();

    await logTeamAudit({
      teamId: team._id,
      actorId: req.user._id,
      action: 'ownership_transferred',
      targetUser: targetMember.user,
      before: { owner: team.owner },
      after: { owner: targetMember.user, transferState: 'idle' },
      metadata: { teamLockVersionFrom: currentLockVersion + 1, teamLockVersionTo: currentLockVersion + 2 },
      req,
    });

    return res.json({
      message: 'Ownership transferred',
      team: normalizeTeamForUser(updatedTeam, requesterId),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to transfer ownership' });
  }
});

// â”€â”€ DELETE /api/teams/:id â€” delete team (owner only) â”€â”€
router.delete('/:id', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'delete_team' });
    if (!authz.ok) {
      return res.status(403).json({ error: 'Only the team owner can delete the team' });
    }

    if (team.transferState && team.transferState !== 'idle') {
      return res.status(409).json({ error: 'Cannot delete team while ownership transfer is in progress' });
    }

    const currentLockVersion = Number(team.lockVersion || 0);
    const deleteResult = await Team.updateOne(
      {
        _id: team._id,
        isActive: true,
        ...buildIdleTransferStateFilter(),
        ...buildLockVersionFilter(currentLockVersion),
      },
      {
        $set: { isActive: false },
        $inc: { lockVersion: 1 },
      }
    );

    if (!deleteResult.modifiedCount) {
      return res.status(409).json({ error: 'Team changed while deleting. Please retry.' });
    }

    // Remove team ref from all members
    const memberIds = team.members.map(m => m.user);
    await User.updateMany({ _id: { $in: memberIds } }, { $pull: { teams: team._id } });

    await logTeamAudit({
      teamId: team._id,
      actorId: req.user._id,
      action: 'team_deleted',
      before: { isActive: true, owner: team.owner },
      after: { isActive: false },
      metadata: { teamLockVersionFrom: currentLockVersion, teamLockVersionTo: currentLockVersion + 1 },
      req,
    });

    res.json({ message: 'Team deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// â”€â”€ GET /api/teams/agencies/public â€” public agency directory â”€â”€
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PHASE 2: Agency Profile, Shared Billing, Work Assignment
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ GET /api/teams/agency/:slug â€” public agency profile â”€â”€
router.get('/agency/:slug', async (req, res) => {
  try {
    const team = await Team.findOne({ slug: req.params.slug, type: 'agency', isPublic: true, isActive: true })
      .populate('owner', 'firstName lastName profileImage averageRating reviewCount skills')
      .populate('members.user', 'firstName lastName profileImage averageRating reviewCount skills title')
      .lean();

    if (!team) return res.status(404).json({ error: 'Agency not found' });

    // Aggregate stats
    const memberIds = team.members.filter(m => m.status === 'active').map(m => m.user?._id);
    const Job = require('../models/Job');
    const Review = require('../models/Review');

    const [completedJobs, reviews] = await Promise.all([
      Job.countDocuments({ freelancer: { $in: memberIds }, status: 'completed' }),
      Review.find({ reviewee: { $in: memberIds }, deletedAt: null }).sort({ createdAt: -1 }).limit(10)
        .populate('reviewer', 'firstName lastName profileImage').lean(),
    ]);

    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
      : null;

    res.json({
      agency: {
        ...team,
        stats: { completedJobs, reviewCount: reviews.length, avgRating },
        recentReviews: reviews.slice(0, 5),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load agency profile' });
  }
});

// â”€â”€ POST /api/teams/:id/portfolio â€” add portfolio item (agency only) â”€â”€
router.post('/:id/portfolio', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (team.type !== 'agency') return res.status(400).json({ error: 'Only agencies have portfolios' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'manage_portfolio' });
    if (!authz.ok) return res.status(403).json({ error: 'No permission' });

    const { title, description, image, url } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (team.portfolio.length >= 20) return res.status(400).json({ error: 'Maximum 20 portfolio items' });

    team.portfolio.push({ title, description: description || '', image: image || '', url: url || '' });
    await team.save();
    res.json({ message: 'Portfolio item added', portfolio: team.portfolio });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add portfolio item' });
  }
});

// â”€â”€ DELETE /api/teams/:id/portfolio/:itemId â€” remove portfolio item â”€â”€
router.delete('/:id/portfolio/:itemId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'manage_portfolio' });
    if (!authz.ok) return res.status(403).json({ error: 'No permission' });

    team.portfolio = team.portfolio.filter(p => p._id.toString() !== req.params.itemId);
    await team.save();
    res.json({ message: 'Portfolio item removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove portfolio item' });
  }
});

// â”€â”€ Shared Billing: team wallet top-up â”€â”€
router.post('/:id/billing/add-funds', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'manage_billing' });
    if (!authz.ok) return res.status(403).json({ error: 'No billing permission' });

    const amount = parseFloat(req.body.amount);
    if (!amount || amount < 5 || amount > 500) return res.status(400).json({ error: 'Amount must be $5â€“$500' });

    // Create Stripe Checkout for team
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    if (!team.stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: team.name,
        email: team.billingEmail || undefined,
        metadata: { teamId: team._id.toString() },
      });
      team.stripeCustomerId = customer.id;
      await team.save();
    }

    const session = await stripe.checkout.sessions.create({
      customer: team.stripeCustomerId,
      mode: 'payment',
      line_items: [{ price_data: { currency: 'usd', unit_amount: Math.round(amount * 100), product_data: { name: `${team.name} â€” Wallet Top-Up` } }, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL || 'https://www.fetchwork.net'}/teams/${team._id}?funded=true`,
      cancel_url: `${process.env.CLIENT_URL || 'https://www.fetchwork.net'}/teams/${team._id}`,
      metadata: { type: 'team_wallet', teamId: team._id.toString(), amount: String(amount) },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Team billing error:', err.message);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// â”€â”€ GET /api/teams/:id/billing â€” team wallet balance + history â”€â”€
router.get('/:id/billing', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_billing' });
    if (!authz.ok) {
      return res.status(403).json({ error: 'No permission' });
    }

    const credits = await BillingCredit.find({
      team: team._id, status: 'active', remaining: { $gt: 0 },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).sort({ createdAt: 1 }).lean();

    const balance = credits.reduce((sum, c) => sum + (c.remaining || 0), 0);
    const history = await BillingCredit.find({ team: team._id }).sort({ createdAt: -1 }).limit(50).lean();

    res.json({ balance: Math.round(balance * 100) / 100, credits: history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load billing' });
  }
});

// â”€â”€ Work Assignment: POST /api/teams/:id/assign â”€â”€
router.post('/:id/assign', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'assign_work' });
    if (!authz.ok) return res.status(403).json({ error: 'No permission to assign work' });

    const { memberId, jobId, serviceOrderId, note } = req.body;
    if (!memberId) return res.status(400).json({ error: 'memberId required' });
    if (!jobId && !serviceOrderId) return res.status(400).json({ error: 'jobId or serviceOrderId required' });

    const member = team.getMember(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found in team' });

    // Assign job
    if (jobId) {
      const Job = require('../models/Job');
      const job = await Job.findOne({ _id: jobId, team: team._id });
      if (!job) return res.status(404).json({ error: 'Job not found in this team' });

      job.assignedTo = memberId;
      job.assignedBy = req.user.userId;
      job.assignedAt = new Date();
      job.assignmentNote = note || '';
      await job.save();

      return res.json({ message: `Job assigned to ${member.user}`, job: { _id: job._id, title: job.title, assignedTo: memberId } });
    }

    // Assign service order
    if (serviceOrderId) {
      const Service = require('../models/Service');
      const service = await Service.findOne({ 'orders._id': serviceOrderId });
      if (!service) return res.status(404).json({ error: 'Service order not found' });

      const order = service.orders.id(serviceOrderId);
      if (!order) return res.status(404).json({ error: 'Order not found' });

      order.assignedTo = memberId;
      order.assignedBy = req.user.userId;
      order.assignedAt = new Date();
      await service.save();

      return res.json({ message: 'Order assigned', orderId: serviceOrderId, assignedTo: memberId });
    }
  } catch (err) {
    console.error('Assignment error:', err.message);
    res.status(500).json({ error: 'Failed to assign work' });
  }
});

// â”€â”€ GET /api/teams/:id/assignments â€” view team work assignments â”€â”€
router.get('/:id/assignments', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_assignments' });
    if (!authz.ok) return res.status(403).json({ error: 'Not a team member' });

    const memberIds = team.members.filter(m => m.status === 'active').map(m => m.user);
    const Job = require('../models/Job');

    const jobs = await Job.find({
      team: team._id,
      assignedTo: { $in: memberIds },
      status: { $in: ['open', 'in_progress', 'assigned'] },
    })
      .populate('assignedTo', 'firstName lastName profileImage')
      .populate('client', 'firstName lastName')
      .select('title status assignedTo assignedAt assignmentNote budget client')
      .sort({ assignedAt: -1 })
      .lean();

    res.json({ assignments: jobs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load assignments' });
  }
});

// â”€â”€ GET /api/teams/:id/activity â€” combined team activity feed â”€â”€
router.get('/:id/activity', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id)
      .populate('members.user', 'firstName lastName')
      .lean();

    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_activity' });
    if (!authz.ok) return res.status(403).json({ error: 'Not a team member' });

    const memberEvents = (team.members || [])
      .filter(m => m.status !== 'removed')
      .flatMap(m => {
        const name = `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim() || 'Team member';
        const events = [];
        if (m.invitedAt) events.push({
          type: 'member_invited',
          at: m.invitedAt,
          message: `${name} was invited as ${m.role}`,
        });
        if (m.status === 'active' && m.joinedAt) events.push({
          type: 'member_joined',
          at: m.joinedAt,
          message: `${name} joined the team`,
        });
        return events;
      });

    const credits = await BillingCredit.find({ team: team._id })
      .sort({ createdAt: -1 })
      .limit(25)
      .lean();

    const billingEvents = credits.map(c => ({
      type: 'wallet_credit',
      at: c.createdAt,
      message: `${c.reason || 'Wallet credit'} (+$${Number(c.amount || 0).toFixed(2)})`,
    }));

    const activity = [...memberEvents, ...billingEvents]
      .filter(a => !!a.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 50);

    res.json({ activity });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load activity' });
  }
});

// â”€â”€ GET /api/teams/:id/audit-logs â€” team audit trail (owner/admin) â”€â”€
router.get('/:id/audit-logs', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_audit_logs' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const { action, actor, targetUser, page = 1, limit = 50 } = req.query;
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);

    const query = { team: team._id };
    if (action) query.action = action;
    if (actor) query.actor = actor;
    if (targetUser) query.targetUser = targetUser;

    const [logs, total] = await Promise.all([
      TeamAuditLog.find(query)
        .populate('actor', 'firstName lastName email profileImage')
        .populate('targetUser', 'firstName lastName email profileImage')
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      TeamAuditLog.countDocuments(query),
    ]);

    res.json({
      logs,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit) || 1,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// â”€â”€ Approval Workflow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/teams/:id/pending-approvals â€” list orders needing approval
router.get('/:id/pending-approvals', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_approvals' });
    if (!authz.ok) {
      return res.status(403).json({ error: 'No approval permission' });
    }

    const Job = require('../models/Job');
    const pendingJobs = await Job.find({
      team: team._id,
      approvalStatus: 'pending',
    })
      .populate('client', 'firstName lastName')
      .populate('freelancer', 'firstName lastName')
      .select('title budget status client freelancer createdAt approvalStatus approvalNote')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ pendingApprovals: pendingJobs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load pending approvals' });
  }
});

// POST /api/teams/:id/approve/:jobId â€” approve or reject a pending order
router.post('/:id/approve/:jobId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const { action, note } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approve or reject' });
    }

    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'decide_approvals' });
    if (!authz.ok) {
      return res.status(403).json({ error: 'No approval permission' });
    }

    const Job = require('../models/Job');
    const job = await Job.findOne({ _id: req.params.jobId, team: team._id });
    if (!job) return res.status(404).json({ error: 'Job not found in this team' });
    if (job.approvalStatus !== 'pending') {
      return res.status(400).json({ error: `Job is already ${job.approvalStatus}` });
    }

    job.approvalStatus = action === 'approve' ? 'approved' : 'rejected';
    job.approvalNote = note || '';
    job.approvedBy = req.user.userId;
    job.approvedAt = new Date();

    if (action === 'approve' && job.status === 'draft') {
      job.status = 'open'; // auto-publish on approval
    }

    await job.save();

    res.json({
      message: `Job ${action === 'approve' ? 'approved' : 'rejected'}`,
      job: { _id: job._id, title: job.title, approvalStatus: job.approvalStatus, status: job.status },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process approval' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PHASE 2: Approval Engine, Spend Controls, Analytics
// ═══════════════════════════════════════════════════════════════

async function expireStaleApprovals(teamId) {
  return TeamApproval.updateMany(
    { team: teamId, status: 'pending', expiresAt: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
}

function checkSpendCap(team, amount) {
  const sc = team.spendControls;
  if (!sc || !sc.monthlyCapEnabled || !sc.monthlyCap) {
    return { blocked: false, alert: false };
  }
  const projected = (sc.currentMonthSpend || 0) + amount;
  if (projected > sc.monthlyCap) {
    return { blocked: true, reason: `Exceeds monthly spend cap ($${sc.monthlyCap})`, alert: true };
  }
  const utilization = projected / sc.monthlyCap;
  if (utilization >= (sc.alertThreshold || 0.8)) {
    return { blocked: false, alert: true, reason: `Approaching spend cap (${Math.round(utilization * 100)}%)` };
  }
  return { blocked: false, alert: false };
}

// ── GET /api/teams/:id/approvals ── list approvals (owner/admin)
router.get('/:id/approvals', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_audit_logs' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    await expireStaleApprovals(team._id);

    const query = { team: team._id };
    if (req.query.status) query.status = req.query.status;

    const approvals = await TeamApproval.find(query)
      .populate('requestedBy', 'firstName lastName email')
      .populate('approvals.userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ approvals });
  } catch (err) {
    console.error('List approvals error:', err.message);
    res.status(500).json({ error: 'Failed to load approvals' });
  }
});

// ── POST /api/teams/:id/approvals ── create approval request
router.post('/:id/approvals', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const ctx = getTeamAccessContext(team, requesterId);
    if (!ctx.isMember || (!ctx.isOwner && !ctx.isAdmin && ctx.role !== 'manager')) {
      return res.status(403).json({ error: 'Owner, admin, or manager access required' });
    }

    const { action, amount, metadata } = req.body;
    if (!action || !['payout', 'spend', 'role_change', 'member_remove'].includes(action)) {
      return res.status(400).json({ error: 'Valid action required (payout, spend, role_change, member_remove)' });
    }

    const requiredApprovals = team.approvalThresholds?.requireDualControl ? 2 : 1;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const approval = await TeamApproval.create({
      team: team._id,
      requestedBy: requesterId,
      action,
      amount: amount || undefined,
      metadata: metadata || undefined,
      requiredApprovals,
      expiresAt,
    });

    await logTeamAudit({
      teamId: team._id,
      actorId: requesterId,
      action: 'approval_requested',
      metadata: { approvalId: approval._id, approvalAction: action, amount },
      req,
    });

    res.status(201).json({ approval });
  } catch (err) {
    console.error('Create approval error:', err.message);
    res.status(500).json({ error: 'Failed to create approval request' });
  }
});

// ── POST /api/teams/:id/approvals/:approvalId/approve ── approve
router.post('/:id/approvals/:approvalId/approve', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_audit_logs' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const approval = await TeamApproval.findOne({ _id: req.params.approvalId, team: team._id });
    if (!approval) return res.status(404).json({ error: 'Approval not found' });
    if (approval.status !== 'pending') return res.status(400).json({ error: `Approval is already ${approval.status}` });
    if (String(approval.requestedBy) === requesterId) {
      return res.status(403).json({ error: 'Cannot approve your own request' });
    }

    const alreadyApproved = approval.approvals.some(a => String(a.userId) === requesterId);
    if (alreadyApproved) return res.status(400).json({ error: 'Already approved by you' });

    approval.approvals.push({
      userId: requesterId,
      approvedAt: new Date(),
      note: req.body.note || '',
    });

    if (approval.isQuorumMet()) {
      approval.status = 'approved';
      approval.executedAt = new Date();
    }

    await approval.save();

    await logTeamAudit({
      teamId: team._id,
      actorId: requesterId,
      action: 'approval_approved',
      metadata: { approvalId: approval._id, approvalAction: approval.action, quorumMet: approval.isQuorumMet() },
      req,
    });

    res.json({ approval });
  } catch (err) {
    console.error('Approve error:', err.message);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// ── POST /api/teams/:id/approvals/:approvalId/reject ── reject
router.post('/:id/approvals/:approvalId/reject', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_audit_logs' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const approval = await TeamApproval.findOne({ _id: req.params.approvalId, team: team._id });
    if (!approval) return res.status(404).json({ error: 'Approval not found' });
    if (approval.status !== 'pending') return res.status(400).json({ error: `Approval is already ${approval.status}` });

    approval.rejections.push({
      userId: requesterId,
      rejectedAt: new Date(),
      reason: req.body.reason || '',
    });
    approval.status = 'rejected';
    await approval.save();

    await logTeamAudit({
      teamId: team._id,
      actorId: requesterId,
      action: 'approval_rejected',
      metadata: { approvalId: approval._id, approvalAction: approval.action, reason: req.body.reason },
      req,
    });

    res.json({ approval });
  } catch (err) {
    console.error('Reject error:', err.message);
    res.status(500).json({ error: 'Failed to reject' });
  }
});

// ── DELETE /api/teams/:id/approvals/:approvalId ── cancel (requestedBy or owner)
router.delete('/:id/approvals/:approvalId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const approval = await TeamApproval.findOne({ _id: req.params.approvalId, team: team._id });
    if (!approval) return res.status(404).json({ error: 'Approval not found' });
    if (approval.status !== 'pending') return res.status(400).json({ error: `Approval is already ${approval.status}` });

    const isRequester = String(approval.requestedBy) === requesterId;
    const ctx = getTeamAccessContext(team, requesterId);
    if (!isRequester && !ctx.isOwner) {
      return res.status(403).json({ error: 'Only the requester or team owner can cancel' });
    }

    approval.status = 'cancelled';
    await approval.save();

    await logTeamAudit({
      teamId: team._id,
      actorId: requesterId,
      action: 'approval_cancelled',
      metadata: { approvalId: approval._id, approvalAction: approval.action },
      req,
    });

    res.json({ message: 'Approval cancelled' });
  } catch (err) {
    console.error('Cancel approval error:', err.message);
    res.status(500).json({ error: 'Failed to cancel approval' });
  }
});

// ── PATCH /api/teams/:id/spend-controls ── update spend controls (owner only)
router.patch('/:id/spend-controls', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const ctx = getTeamAccessContext(team, requesterId);
    if (!ctx.isOwner) return res.status(403).json({ error: 'Only the team owner can manage spend controls' });

    const { spendControls, approvalThresholds } = req.body;

    if (spendControls) {
      if (spendControls.monthlyCap !== undefined && spendControls.monthlyCap < 0) {
        return res.status(400).json({ error: 'Monthly cap must be >= 0' });
      }
      if (spendControls.alertThreshold !== undefined && (spendControls.alertThreshold < 0 || spendControls.alertThreshold > 1)) {
        return res.status(400).json({ error: 'Alert threshold must be between 0 and 1' });
      }

      const before = team.spendControls ? team.spendControls.toObject() : {};

      if (spendControls.monthlyCapEnabled !== undefined) team.spendControls.monthlyCapEnabled = spendControls.monthlyCapEnabled;
      if (spendControls.monthlyCap !== undefined) {
        const capChanged = team.spendControls.monthlyCap !== spendControls.monthlyCap;
        team.spendControls.monthlyCap = spendControls.monthlyCap;
        if (capChanged) {
          team.spendControls.currentMonthSpend = 0;
          const now = new Date();
          team.spendControls.capResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }
      }
      if (spendControls.alertThreshold !== undefined) team.spendControls.alertThreshold = spendControls.alertThreshold;
    }

    if (approvalThresholds) {
      if (approvalThresholds.payoutThresholdAmount !== undefined && approvalThresholds.payoutThresholdAmount < 0) {
        return res.status(400).json({ error: 'Payout threshold must be >= 0' });
      }
      if (approvalThresholds.payoutRequiresApproval !== undefined) team.approvalThresholds.payoutRequiresApproval = approvalThresholds.payoutRequiresApproval;
      if (approvalThresholds.payoutThresholdAmount !== undefined) team.approvalThresholds.payoutThresholdAmount = approvalThresholds.payoutThresholdAmount;
      if (approvalThresholds.requireDualControl !== undefined) team.approvalThresholds.requireDualControl = approvalThresholds.requireDualControl;
    }

    await team.save();

    await logTeamAudit({
      teamId: team._id,
      actorId: requesterId,
      action: 'spend_controls_updated',
      after: { spendControls: team.spendControls, approvalThresholds: team.approvalThresholds },
      req,
    });

    res.json({ spendControls: team.spendControls, approvalThresholds: team.approvalThresholds });
  } catch (err) {
    console.error('Update spend controls error:', err.message);
    res.status(500).json({ error: 'Failed to update spend controls' });
  }
});

// ── GET /api/teams/:id/spend-controls ── read spend controls (owner/admin)
router.get('/:id/spend-controls', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_audit_logs' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const { resolveTeamSettings } = require('../utils/teamSettings');
    const Organization = require('../models/Organization');
    let org = null;
    if (team.organization) {
      org = await Organization.findById(team.organization);
    }
    const effective = resolveTeamSettings(team, org);

    res.json(effective);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load spend controls' });
  }
});

// ── GET /api/teams/:id/analytics ── team analytics (owner/admin)
router.get('/:id/analytics', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id)
      .populate('members.user', 'firstName lastName')
      .lean();
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_audit_logs' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const activeMembers = (team.members || []).filter(m => m.status === 'active');
    const pendingInvites = (team.members || []).filter(m => m.status === 'invited');
    const memberIds = activeMembers.map(m => m.user?._id || m.user);

    const Job = require('../models/Job');

    const [assignmentCount, approvalStats, recentActivity, jobsByMember] = await Promise.all([
      Job.countDocuments({ team: team._id, assignedTo: { $in: memberIds } }),
      TeamApproval.aggregate([
        { $match: { team: team._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      TeamAuditLog.find({ team: team._id })
        .populate('actor', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Job.aggregate([
        { $match: { team: team._id, assignedTo: { $in: memberIds.map(id => new mongoose.Types.ObjectId(String(id))) } } },
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
      ]),
    ]);

    const approvalStatsObj = { pending: 0, approved: 0, rejected: 0, expired: 0 };
    approvalStats.forEach(s => { if (approvalStatsObj.hasOwnProperty(s._id)) approvalStatsObj[s._id] = s.count; });

    const sc = team.spendControls || {};
    const spendCapUtilization = sc.monthlyCapEnabled && sc.monthlyCap > 0
      ? Math.round(((sc.currentMonthSpend || 0) / sc.monthlyCap) * 100) / 100
      : null;

    const memberActivity = activeMembers.map(m => {
      const uid = String(m.user?._id || m.user);
      const match = jobsByMember.find(j => String(j._id) === uid);
      return {
        userId: uid,
        name: `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim(),
        role: m.role,
        assignmentCount: match ? match.count : 0,
      };
    });

    res.json({
      memberCount: activeMembers.length,
      activeMembers: activeMembers.length,
      pendingInvites: pendingInvites.length,
      assignmentCount,
      totalSpend: sc.currentMonthSpend || 0,
      spendCapUtilization,
      approvalStats: approvalStatsObj,
      recentActivity: recentActivity.map(a => ({
        actor: `${a.actor?.firstName || ''} ${a.actor?.lastName || ''}`.trim(),
        action: a.action,
        createdAt: a.createdAt,
      })),
      memberActivity,
    });
  } catch (err) {
    console.error('Analytics error:', err.message);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// ── GET /api/teams/:id/user-lookup?q=term ── lookup users for linking clients
router.get('/:id/user-lookup', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_audit_logs' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const q = String(req.query?.q || '').trim();
    if (!q || q.length < 2) return res.json({ users: [] });

    const memberIds = new Set((team.members || []).map((m) => String(getId(m.user))).filter(Boolean));
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const users = await User.find({
      isActive: true,
      isSuspended: { $ne: true },
      $or: [
        { email: regex },
        { firstName: regex },
        { lastName: regex },
      ],
    })
      .select('_id firstName lastName email profileImage')
      .limit(10)
      .lean();

    const filtered = users.filter((u) => !memberIds.has(String(u._id)));
    res.json({ users: filtered });
  } catch (err) {
    res.status(500).json({ error: 'Failed to lookup users' });
  }
});

// ── GET /api/teams/:id/custom-roles ── list custom roles
router.get('/:id/custom-roles', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'invite_member' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    res.json({ customRoles: team.customRoles || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load custom roles' });
  }
});

// ── POST /api/teams/:id/custom-roles ── create custom role
router.post('/:id/custom-roles', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'invite_member' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const name = String(req.body?.name || '').trim();
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
    if (!name) return res.status(400).json({ error: 'Role name is required' });
    if (permissions.some((p) => !TEAM_PERMISSION_KEYS.includes(p))) return res.status(400).json({ error: 'Invalid permissions' });

    const dup = (team.customRoles || []).some((r) => String(r.name || '').toLowerCase() === name.toLowerCase());
    if (dup) return res.status(400).json({ error: 'Role name already exists' });

    team.customRoles.push({ name, permissions });
    await team.save();

    await logTeamAudit({ teamId: team._id, actorId: requesterId, action: 'custom_role_created', after: { name, permissions }, req });

    res.status(201).json({ customRoles: team.customRoles || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create custom role' });
  }
});

// ── PATCH /api/teams/:id/custom-roles/:roleId ── update custom role
router.patch('/:id/custom-roles/:roleId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'invite_member' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const role = (team.customRoles || []).id(req.params.roleId);
    if (!role) return res.status(404).json({ error: 'Custom role not found' });

    const name = req.body?.name !== undefined ? String(req.body.name || '').trim() : role.name;
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : role.permissions;

    if (!name) return res.status(400).json({ error: 'Role name is required' });
    if ((permissions || []).some((p) => !TEAM_PERMISSION_KEYS.includes(p))) return res.status(400).json({ error: 'Invalid permissions' });

    const dup = (team.customRoles || []).some((r) => String(r._id) !== String(role._id) && String(r.name || '').toLowerCase() === name.toLowerCase());
    if (dup) return res.status(400).json({ error: 'Role name already exists' });

    role.name = name;
    role.permissions = permissions;
    await team.save();

    await logTeamAudit({ teamId: team._id, actorId: requesterId, action: 'custom_role_updated', after: { name, permissions }, req });

    res.json({ customRoles: team.customRoles || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update custom role' });
  }
});

// ── DELETE /api/teams/:id/custom-roles/:roleId ── delete custom role
router.delete('/:id/custom-roles/:roleId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'invite_member' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const role = (team.customRoles || []).id(req.params.roleId);
    if (!role) return res.status(404).json({ error: 'Custom role not found' });

    const roleName = role.name;
    const inUse = (team.members || []).some((m) => m.status === 'active' && m.customRoleName === roleName);
    if (inUse) return res.status(400).json({ error: 'Role is currently assigned to active members' });

    role.deleteOne();
    await team.save();

    await logTeamAudit({ teamId: team._id, actorId: requesterId, action: 'custom_role_deleted', before: { name: roleName }, req });

    res.json({ customRoles: team.customRoles || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete custom role' });
  }
});

// ── PATCH /api/teams/:id/members/:userId/custom-role ── assign custom role
router.patch('/:id/members/:userId/custom-role', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'update_member_role' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const member = team.members.find((m) => getId(m.user) === String(req.params.userId) && m.status === 'active');
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const customRoleName = String(req.body?.customRoleName || '').trim();
    if (customRoleName) {
      const exists = (team.customRoles || []).some((r) => r.name === customRoleName);
      if (!exists) return res.status(400).json({ error: 'Custom role not found' });
    }

    member.customRoleName = customRoleName;
    await team.save();

    await logTeamAudit({ teamId: team._id, actorId: requesterId, action: 'member_custom_role_assigned', targetUser: member.user, after: { customRoleName }, req });

    res.json({ member });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign custom role' });
  }
});

// ── GET /api/teams/:id/clients ── list linked clients
router.get('/:id/clients', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_audit_logs' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const clients = await TeamClient.findActiveForTeam(team._id);
    res.json({ clients });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load linked clients' });
  }
});

// ── POST /api/teams/:id/clients ── link client
router.post('/:id/clients', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_audit_logs' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const { clientUserId, accessLevel = 'view_assigned', projectLabel = '' } = req.body || {};
    if (!clientUserId) return res.status(400).json({ error: 'clientUserId is required' });
    if (!['view_assigned', 'view_all', 'collaborate'].includes(accessLevel)) return res.status(400).json({ error: 'Invalid accessLevel' });

    const client = await User.findById(clientUserId);
    if (!client) return res.status(404).json({ error: 'Client user not found' });

    const isActiveMember = (team.members || []).some((m) => getId(m.user) === String(clientUserId) && m.status === 'active');
    if (isActiveMember) return res.status(400).json({ error: 'User is already an active team member' });

    const relationship = await TeamClient.findOneAndUpdate(
      { team: team._id, client: client._id },
      { $set: { isActive: true, accessLevel, projectLabel, addedBy: requesterId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('client', 'firstName lastName email profileImage').populate('addedBy', 'firstName lastName email');

    await logTeamAudit({ teamId: team._id, actorId: requesterId, action: 'client_linked', targetUser: client._id, after: { accessLevel, projectLabel }, req });

    res.status(201).json({ client: relationship });
  } catch (err) {
    res.status(500).json({ error: 'Failed to link client' });
  }
});

// ── PATCH /api/teams/:id/clients/:clientId ── update linked client
router.patch('/:id/clients/:clientId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_audit_logs' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const updates = {};
    if (req.body?.accessLevel) {
      if (!['view_assigned', 'view_all', 'collaborate'].includes(req.body.accessLevel)) return res.status(400).json({ error: 'Invalid accessLevel' });
      updates.accessLevel = req.body.accessLevel;
    }
    if (req.body?.projectLabel !== undefined) updates.projectLabel = String(req.body.projectLabel || '');

    const relationship = await TeamClient.findOneAndUpdate(
      { team: team._id, client: req.params.clientId, isActive: true },
      { $set: updates },
      { new: true }
    ).populate('client', 'firstName lastName email profileImage').populate('addedBy', 'firstName lastName email');

    if (!relationship) return res.status(404).json({ error: 'Linked client not found' });

    res.json({ client: relationship });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update linked client' });
  }
});

// ── DELETE /api/teams/:id/clients/:clientId ── unlink client
router.delete('/:id/clients/:clientId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_audit_logs' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const relationship = await TeamClient.findOneAndUpdate(
      { team: team._id, client: req.params.clientId, isActive: true },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!relationship) return res.status(404).json({ error: 'Linked client not found' });

    await logTeamAudit({ teamId: team._id, actorId: requesterId, action: 'client_unlinked', targetUser: relationship.client, req });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlink client' });
  }
});

// ── GET /api/teams/:id/clients/:clientId/access ── client-access snapshot
router.get('/:id/clients/:clientId/access', async (req, res) => {
  try {
    const requesterId = String(req.user?.userId || req.user?._id || req.user?.id || '');
    if (!requesterId) return res.status(401).json({ error: 'Unauthorized' });

    if (String(req.params.clientId) !== requesterId) return res.status(403).json({ error: 'Forbidden' });

    const relationship = await TeamClient.findOne({ team: req.params.id, client: req.params.clientId, isActive: true });
    if (!relationship) return res.status(404).json({ error: 'Client relationship not found' });

    const team = await Team.findById(req.params.id).select('name');
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const Job = require('../models/Job');
    const assignedWork = await Job.find({ team: team._id })
      .select('title status createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({
      accessLevel: relationship.accessLevel,
      projectLabel: relationship.projectLabel,
      team: { id: team._id, name: team.name },
      assignedWork,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load client access' });
  }
});

// Middleware helper: check team approval threshold before order/job proceeds
// Export for use in other routes
router.checkTeamApproval = async function(userId, teamId, amount) {
  if (!teamId) return { needsApproval: false };

  const team = await Team.findById(teamId);
  if (!team || !team.isActive) return { needsApproval: false };
  if (!team.settings?.requireApproval) return { needsApproval: false };
  if (!team.approvalThreshold || amount < team.approvalThreshold) return { needsApproval: false };

  return {
    needsApproval: true,
    team,
    threshold: team.approvalThreshold,
  };
};

module.exports = router;


