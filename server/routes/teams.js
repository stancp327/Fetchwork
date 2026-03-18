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
const TeamNote = require('../models/TeamNote');
const Job = require('../models/Job');
const TeamSubtask = require('../models/TeamSubtask');
const TeamJobRole = require('../models/TeamJobRole');
const TeamJobChat = require('../models/TeamJobChat');
const TeamTask = require('../models/TeamTask');
const TeamPayout = require('../models/TeamPayout');
const emailService = require('../services/emailService');
const stripeService = require('../services/stripeService');
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
    canManageMembers:   isOwner || isAdmin || resolvedPermissions.has('manage_members'),
    canManageBilling:   isOwner || isAdmin || resolvedPermissions.has('manage_billing'),
    canApproveOrders:   isOwner || isAdmin || resolvedPermissions.has('approve_orders'),
    canAssignWork:      isOwner || isAdmin || resolvedPermissions.has('assign_work'),
    canManagePortfolio: isOwner || isAdmin || resolvedPermissions.has('manage_services'),
    canReadBilling:     isOwner || isAdmin || resolvedPermissions.has('manage_billing') || resolvedPermissions.has('view_analytics'),
    canViewWallet:      isOwner || isAdmin || resolvedPermissions.has('view_wallet') || resolvedPermissions.has('manage_billing'),
    canApprovePayouts:  isOwner || isAdmin || resolvedPermissions.has('approve_payouts'),
    canApproveOutsourcing: isOwner || resolvedPermissions.has('approve_outsourcing'),
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
    read_audit_logs:       ctx.isOwner || ctx.isAdmin,
    manage_tasks:          ctx.canAssignWork,
    read_tasks:            ctx.isMember,
    view_wallet:           ctx.canViewWallet,
    approve_payouts:       ctx.canApprovePayouts,
    approve_outsourcing:   ctx.canApproveOutsourcing,
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

    // Notify new owner
    Notification.notify({
      recipient: targetMember.user,
      type: 'team_ownership_transferred',
      title: 'You are now team owner',
      message: `${req.user.firstName || 'A team admin'} transferred ownership of ${team.name} to you.`,
      link: '/teams',
    }).catch(() => {});

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
    const { page = 1, specialty } = req.query;
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 100); // cap at 100
    const query = { type: 'agency', isPublic: true, isActive: true };
    if (specialty) query.specialties = specialty;

    const [agencies, total] = await Promise.all([
      Team.find(query)
        .populate('owner', 'firstName lastName profileImage')
        .populate('members.user', 'firstName lastName profileImage')
        .select('name slug description logo specialties members portfolio')
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * limit)
        .limit(limit)
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
    if (!team.stripeCustomerId) {
      const customer = await stripeService.createCustomer(
        team.billingEmail || undefined,
        team.name,
        { teamId: team._id.toString() }
      );
      team.stripeCustomerId = customer.id;
      await team.save();
    }

    const session = await stripeService.createPaymentSession(
      team.stripeCustomerId,
      Math.round(amount * 100),
      `${team.name} — Wallet Top-Up`,
      `${process.env.CLIENT_URL || 'https://www.fetchwork.net'}/teams/${team._id}?funded=true`,
      `${process.env.CLIENT_URL || 'https://www.fetchwork.net'}/teams/${team._id}`,
      { type: 'team_wallet', teamId: team._id.toString(), amount: String(amount) },
      false
    );

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

      // Notify assigned member
      Notification.notify({
        recipient: memberId,
        type: 'team_work_assigned',
        title: 'Work assigned to you',
        message: `${req.user.firstName || 'A team admin'} assigned you a job on ${team.name}: "${job.title}"${note ? ` — ${note}` : ''}`,
        link: `/jobs/${job._id}`,
      }).catch(() => {});

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

      // Notify assigned member
      Notification.notify({
        recipient: memberId,
        type: 'team_work_assigned',
        title: 'Order assigned to you',
        message: `${req.user.firstName || 'A team admin'} assigned you a service order on ${team.name}${note ? ` — ${note}` : ''}`,
        link: '/orders',
      }).catch(() => {});

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
    // Notify owner + admins: cap exceeded
    const recipients = team.members.filter(m => m.status === 'active' && ['owner', 'admin'].includes(m.role));
    recipients.forEach(m => {
      Notification.notify({
        recipient: m.user,
        type: 'team_spend_cap_exceeded',
        title: '⚠️ Team spend cap exceeded',
        message: `${team.name} has reached its monthly spend cap of $${sc.monthlyCap}. This spend was blocked.`,
        link: '/teams',
      }).catch(() => {});
    });
    return { blocked: true, reason: `Exceeds monthly spend cap ($${sc.monthlyCap})`, alert: true };
  }
  const utilization = projected / sc.monthlyCap;
  if (utilization >= (sc.alertThreshold || 0.8)) {
    // Notify owner + admins: approaching cap
    const recipients = team.members.filter(m => m.status === 'active' && ['owner', 'admin'].includes(m.role));
    recipients.forEach(m => {
      Notification.notify({
        recipient: m.user,
        type: 'team_spend_alert',
        title: '💰 Team spend alert',
        message: `${team.name} is at ${Math.round(utilization * 100)}% of its $${sc.monthlyCap} monthly spend cap.`,
        link: '/teams',
      }).catch(() => {});
    });
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

    // Notify all owners + admins (except requester)
    const approvers = team.members.filter(m =>
      m.status === 'active' &&
      ['owner', 'admin'].includes(m.role) &&
      m.user.toString() !== requesterId
    );
    approvers.forEach(m => {
      Notification.notify({
        recipient: m.user,
        type: 'team_approval_requested',
        title: 'Approval required',
        message: `${req.user.firstName || 'A team member'} requested approval for ${action}${amount ? ` ($${amount})` : ''} on ${team.name}`,
        link: `/teams`,
      }).catch(() => {});
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

    // Notify requester their request was approved
    Notification.notify({
      recipient: approval.requestedBy,
      type: 'team_approval_approved',
      title: 'Approval granted',
      message: `Your ${approval.action} request on ${team.name} was approved${approval.status === 'approved' ? ' and is ready to execute' : ' (awaiting additional approvers)'}.`,
      link: '/teams',
    }).catch(() => {});

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

    // Notify requester their request was rejected
    Notification.notify({
      recipient: approval.requestedBy,
      type: 'team_approval_rejected',
      title: 'Approval denied',
      message: `Your ${approval.action} request on ${team.name} was denied${req.body.reason ? `: ${req.body.reason}` : '.'}`,
      link: '/teams',
    }).catch(() => {});

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

// Phase 2 analytics removed — replaced by comprehensive Phase 3 analytics below

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

// ── GET /api/teams/:id/notes ── list team notes (members only)
router.get('/:id/notes', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_activity' });
    if (!authz.ok) return res.status(403).json({ error: 'Not a team member' });

    const notes = await TeamNote.find({ team: team._id })
      .populate('author', 'firstName lastName email profileImage')
      .sort({ pinned: -1, createdAt: -1 })
      .lean();

    res.json({ notes });
  } catch (err) {
    console.error('List notes error:', err.message);
    res.status(500).json({ error: 'Failed to load notes' });
  }
});

// ── POST /api/teams/:id/notes ── create a team note
router.post('/:id/notes', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_activity' });
    if (!authz.ok) return res.status(403).json({ error: 'Not a team member' });

    const { content, relatedTo } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });
    if (content.length > 1000) return res.status(400).json({ error: 'Content must be 1000 characters or fewer' });

    const note = await TeamNote.create({
      team: team._id,
      author: requesterId,
      content: content.trim(),
      relatedTo: {
        type: relatedTo?.type || 'general',
        id: relatedTo?.id || undefined,
      },
    });

    const populated = await TeamNote.findById(note._id)
      .populate('author', 'firstName lastName email profileImage')
      .lean();

    res.status(201).json({ note: populated });
  } catch (err) {
    console.error('Create note error:', err.message);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// ── PATCH /api/teams/:id/notes/:noteId ── toggle pin
router.patch('/:id/notes/:noteId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_activity' });
    if (!authz.ok) return res.status(403).json({ error: 'Not a team member' });

    const note = await TeamNote.findOne({ _id: req.params.noteId, team: team._id });
    if (!note) return res.status(404).json({ error: 'Note not found' });

    if (req.body.pinned !== undefined) note.pinned = Boolean(req.body.pinned);
    await note.save();

    res.json({ note });
  } catch (err) {
    console.error('Update note error:', err.message);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// ── DELETE /api/teams/:id/notes/:noteId ── delete (author or admin only)
router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const note = await TeamNote.findOne({ _id: req.params.noteId, team: team._id });
    if (!note) return res.status(404).json({ error: 'Note not found' });

    const isAuthor = String(note.author) === requesterId;
    const ctx = getTeamAccessContext(team, requesterId);
    if (!isAuthor && !ctx.isOwner && !ctx.isAdmin) {
      return res.status(403).json({ error: 'Only the author or an admin can delete this note' });
    }

    await TeamNote.deleteOne({ _id: note._id });
    res.json({ message: 'Note deleted' });
  } catch (err) {
    console.error('Delete note error:', err.message);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// ══════════════════════════════════════════════════════════════════
// Phase 3 — Analytics & Pipeline
// ══════════════════════════════════════════════════════════════════

// ── GET /api/teams/:id/analytics — comprehensive team analytics ──
router.get('/:id/analytics', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'manage_team' });
    if (!authz.ok) return res.status(403).json({ error: 'Owner or admin access required' });

    const teamId = team._id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Fetch all team jobs once (avoid N+1 — was 3 separate queries)
    const allTeamJobs = await Job.find({ team: teamId }).lean();

    // ── Hiring analytics ──
    let hiring = {
      totalJobsPosted: 0, totalProposalsReceived: 0, avgProposalsPerJob: 0,
      avgTimeToHire: 0, repeatFreelancerRate: 0,
      topFreelancers: [], jobsByMonth: [],
    };

    try {
      const teamJobs = allTeamJobs;
      hiring.totalJobsPosted = teamJobs.length;
      hiring.totalProposalsReceived = teamJobs.reduce((s, j) => s + (j.proposals?.length || 0), 0);
      hiring.avgProposalsPerJob = hiring.totalJobsPosted > 0
        ? Math.round((hiring.totalProposalsReceived / hiring.totalJobsPosted) * 10) / 10
        : 0;

      // Avg time to hire
      const hiredJobs = teamJobs.filter(j => j.freelancer && j.acceptedAt && j.createdAt);
      if (hiredJobs.length > 0) {
        const totalDays = hiredJobs.reduce((s, j) => {
          return s + (new Date(j.acceptedAt) - new Date(j.createdAt)) / (1000 * 60 * 60 * 24);
        }, 0);
        hiring.avgTimeToHire = Math.round((totalDays / hiredJobs.length) * 10) / 10;
      }

      // Repeat freelancer rate
      const freelancerCounts = {};
      teamJobs.forEach(j => {
        if (j.freelancer) {
          const fid = String(j.freelancer);
          freelancerCounts[fid] = (freelancerCounts[fid] || 0) + 1;
        }
      });
      const uniqueFreelancers = Object.keys(freelancerCounts).length;
      const repeatFreelancers = Object.values(freelancerCounts).filter(c => c > 1).length;
      hiring.repeatFreelancerRate = uniqueFreelancers > 0
        ? Math.round((repeatFreelancers / uniqueFreelancers) * 100)
        : 0;

      // Top freelancers
      const topIds = Object.entries(freelancerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      if (topIds.length > 0) {
        const topUsers = await User.find({ _id: { $in: topIds } })
          .select('firstName lastName profileImage')
          .lean();
        const userMap = {};
        topUsers.forEach(u => { userMap[String(u._id)] = u; });

        hiring.topFreelancers = topIds.map(fid => {
          const u = userMap[fid] || {};
          const fJobs = teamJobs.filter(j => String(j.freelancer) === fid);
          const completed = fJobs.filter(j => j.status === 'completed').length;
          const totalPaid = fJobs.reduce((s, j) => s + (j.totalPaid || 0), 0);
          return {
            userId: fid,
            name: [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unknown',
            jobsCompleted: completed,
            totalPaid,
          };
        });
      }

      // Jobs by month (last 6)
      const monthBuckets = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthBuckets[key] = 0;
      }
      teamJobs.forEach(j => {
        if (!j.createdAt) return;
        const d = new Date(j.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key in monthBuckets) monthBuckets[key]++;
      });
      hiring.jobsByMonth = Object.entries(monthBuckets).map(([month, count]) => ({ month, count }));
    } catch (e) {
      console.error('Analytics hiring error:', e.message);
    }

    // ── Spend analytics ──
    let spend = {
      totalAllTime: 0, last30Days: 0, last90Days: 0,
      byMember: [], byCategory: [], byMonth: [],
    };

    try {
      const teamJobs = allTeamJobs;

      spend.totalAllTime = teamJobs.reduce((s, j) => s + (j.totalPaid || 0), 0);
      spend.last30Days = teamJobs
        .filter(j => j.completedAt && new Date(j.completedAt) >= thirtyDaysAgo)
        .reduce((s, j) => s + (j.totalPaid || 0), 0);
      spend.last90Days = teamJobs
        .filter(j => j.completedAt && new Date(j.completedAt) >= ninetyDaysAgo)
        .reduce((s, j) => s + (j.totalPaid || 0), 0);

      // By member (client who posted)
      const memberSpend = {};
      teamJobs.forEach(j => {
        if (!j.client) return;
        const cid = String(j.client);
        memberSpend[cid] = (memberSpend[cid] || 0) + (j.totalPaid || 0);
      });
      const memberIds = Object.keys(memberSpend);
      if (memberIds.length > 0) {
        const memberUsers = await User.find({ _id: { $in: memberIds } })
          .select('firstName lastName')
          .lean();
        const mMap = {};
        memberUsers.forEach(u => { mMap[String(u._id)] = u; });
        spend.byMember = Object.entries(memberSpend)
          .map(([mid, amount]) => {
            const u = mMap[mid] || {};
            return {
              memberId: mid,
              name: [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unknown',
              amount,
            };
          })
          .sort((a, b) => b.amount - a.amount);
      }

      // By category
      const catSpend = {};
      teamJobs.forEach(j => {
        const cat = j.category || 'Uncategorized';
        catSpend[cat] = (catSpend[cat] || 0) + (j.totalPaid || 0);
      });
      spend.byCategory = Object.entries(catSpend)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      // By month (last 6)
      const spendBuckets = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        spendBuckets[key] = 0;
      }
      teamJobs.forEach(j => {
        if (!j.completedAt) return;
        const d = new Date(j.completedAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key in spendBuckets) spendBuckets[key] += (j.totalPaid || 0);
      });
      spend.byMonth = Object.entries(spendBuckets).map(([month, amount]) => ({ month, amount }));
    } catch (e) {
      console.error('Analytics spend error:', e.message);
    }

    // ── Performance ──
    let performance = {
      completionRate: 0, disputeRate: 0, avgJobDuration: 0, onTimeDeliveryRate: 0,
    };

    try {
      const teamJobs = allTeamJobs;
      const finishedJobs = teamJobs.filter(j => ['completed', 'cancelled'].includes(j.status));
      const completedJobs = finishedJobs.filter(j => j.status === 'completed');
      const disputedJobs = teamJobs.filter(j => j.disputeStatus && j.disputeStatus !== 'none');

      if (finishedJobs.length > 0) {
        performance.completionRate = Math.round((completedJobs.length / finishedJobs.length) * 100);
      }
      if (teamJobs.length > 0) {
        performance.disputeRate = Math.round((disputedJobs.length / teamJobs.length) * 100);
      }

      // Avg job duration
      const durJobs = completedJobs.filter(j => j.createdAt && j.completedAt);
      if (durJobs.length > 0) {
        const totalDur = durJobs.reduce((s, j) => {
          return s + (new Date(j.completedAt) - new Date(j.createdAt)) / (1000 * 60 * 60 * 24);
        }, 0);
        performance.avgJobDuration = Math.round((totalDur / durJobs.length) * 10) / 10;
      }

      // On-time delivery rate
      const deadlineJobs = completedJobs.filter(j => j.deadline);
      if (deadlineJobs.length > 0) {
        const onTime = deadlineJobs.filter(j => new Date(j.completedAt) <= new Date(j.deadline)).length;
        performance.onTimeDeliveryRate = Math.round((onTime / deadlineJobs.length) * 100);
      }
    } catch (e) {
      console.error('Analytics performance error:', e.message);
    }

    // ── Team growth ──
    let teamData = {
      memberCount: 0, activeMembers: 0, pendingInvites: 0, memberGrowth: [],
    };

    try {
      const members = team.members || [];
      teamData.memberCount = members.length;
      teamData.activeMembers = members.filter(m => m.status === 'active').length;
      teamData.pendingInvites = members.filter(m => m.status === 'invited').length;

      // Member growth by month (last 6 — use joinedAt)
      const growthBuckets = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        growthBuckets[key] = 0;
      }
      members.forEach(m => {
        const joinDate = m.joinedAt || m.invitedAt;
        if (!joinDate) return;
        const d = new Date(joinDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key in growthBuckets) growthBuckets[key]++;
      });
      teamData.memberGrowth = Object.entries(growthBuckets).map(([month, count]) => ({ month, count }));
    } catch (e) {
      console.error('Analytics team error:', e.message);
    }

    res.json({
      hiring,
      spend,
      performance,
      team: teamData,
    });
  } catch (err) {
    console.error('Analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ── GET /api/teams/:id/pipeline — list pipeline entries ──
router.get('/:id/pipeline', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id)
      .populate('talentPipeline.freelancer', 'firstName lastName email profileImage skills')
      .populate('talentPipeline.addedBy', 'firstName lastName');
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_team' });
    if (!authz.ok) return res.status(403).json({ error: 'Not a team member' });

    res.json({ pipeline: team.talentPipeline || [] });
  } catch (err) {
    console.error('Pipeline list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
});

// ── POST /api/teams/:id/pipeline — add freelancer to pipeline ──
router.post('/:id/pipeline', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const { freelancerId, stage = 'sourced', notes = '' } = req.body;
    if (!freelancerId) return res.status(400).json({ error: 'freelancerId is required' });

    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'manage_team' });
    if (!authz.ok) return res.status(403).json({ error: 'Admin access required' });

    // Check freelancer exists
    const freelancer = await User.findById(freelancerId).select('_id firstName lastName');
    if (!freelancer) return res.status(404).json({ error: 'Freelancer not found' });

    // Check duplicate
    const exists = (team.talentPipeline || []).some(
      e => String(e.freelancer) === String(freelancerId)
    );
    if (exists) return res.status(400).json({ error: 'Freelancer already in pipeline' });

    const validStages = ['sourced', 'reviewing', 'shortlisted', 'interviewing', 'offer', 'hired', 'archived'];
    const safeStage = validStages.includes(stage) ? stage : 'sourced';

    team.talentPipeline.push({
      freelancer: freelancerId,
      stage: safeStage,
      notes,
      addedBy: requesterId,
    });

    await team.save();

    const updated = await Team.findById(team._id)
      .populate('talentPipeline.freelancer', 'firstName lastName email profileImage skills')
      .populate('talentPipeline.addedBy', 'firstName lastName');

    res.status(201).json({ pipeline: updated.talentPipeline });
  } catch (err) {
    console.error('Pipeline add error:', err.message);
    res.status(500).json({ error: 'Failed to add to pipeline' });
  }
});

// ── PATCH /api/teams/:id/pipeline/:entryId — move stage or update notes ──
router.patch('/:id/pipeline/:entryId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'manage_team' });
    if (!authz.ok) return res.status(403).json({ error: 'Admin access required' });

    const entry = (team.talentPipeline || []).id(req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Pipeline entry not found' });

    const validStages = ['sourced', 'reviewing', 'shortlisted', 'interviewing', 'offer', 'hired', 'archived'];
    if (req.body.stage !== undefined) {
      if (!validStages.includes(req.body.stage)) {
        return res.status(400).json({ error: 'Invalid stage' });
      }
      entry.stage = req.body.stage;
    }
    if (req.body.notes !== undefined) {
      entry.notes = req.body.notes;
    }
    entry.updatedAt = new Date();

    await team.save();

    const updated = await Team.findById(team._id)
      .populate('talentPipeline.freelancer', 'firstName lastName email profileImage skills')
      .populate('talentPipeline.addedBy', 'firstName lastName');

    res.json({ pipeline: updated.talentPipeline });
  } catch (err) {
    console.error('Pipeline update error:', err.message);
    res.status(500).json({ error: 'Failed to update pipeline entry' });
  }
});

// ── DELETE /api/teams/:id/pipeline/:entryId — remove from pipeline ──
router.delete('/:id/pipeline/:entryId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'manage_team' });
    if (!authz.ok) return res.status(403).json({ error: 'Admin access required' });

    const idx = (team.talentPipeline || []).findIndex(
      e => String(e._id) === req.params.entryId
    );
    if (idx === -1) return res.status(404).json({ error: 'Pipeline entry not found' });

    team.talentPipeline.splice(idx, 1);
    await team.save();

    res.json({ message: 'Removed from pipeline' });
  } catch (err) {
    console.error('Pipeline delete error:', err.message);
    res.status(500).json({ error: 'Failed to remove from pipeline' });
  }
});

// ── GET /:id/jobs ── Jobs this team is working on (or has proposals for)
router.get('/:id/jobs', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    const Job = require('../models/Job');

    // Jobs assigned to this team (won proposals)
    const assignedJobs = await Job.find({ team: team._id, status: { $in: ['accepted','pending_start','in_progress','delivered'] } })
      .select('title status budget assignedTo client createdAt deliveredAt autoReleaseAt kanbanColumn deadline urgent')
      .populate('client', 'firstName lastName username avatar')
      .populate('assignedTo', 'firstName lastName username avatar')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Jobs where team submitted a proposal (still pending)
    const proposalJobs = await Job.find({ 'proposals.team': team._id, status: 'open' })
      .select('title status budget client proposals createdAt')
      .populate('client', 'firstName lastName username avatar')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // For proposal jobs, extract only this team's proposal
    const pendingProposals = proposalJobs.map(job => {
      const tp = job.proposals.find(p => p.team && p.team.toString() === team._id.toString());
      return { ...job, teamProposal: tp, proposals: undefined };
    });

    const pinnedJobs = (team.pinnedJobs || []).map(String);

    res.json({ assignedJobs, pendingProposals, pinnedJobs });
  } catch (err) {
    console.error('team jobs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch team jobs' });
  }
});

// POST /api/teams/:id/proposals/:proposalId/withdraw
router.post('/:id/proposals/:proposalId/withdraw', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const job = await Job.findOne({
      'proposals._id': req.params.proposalId,
      'proposals.team': team._id,
    });
    if (!job) return res.status(404).json({ error: 'Proposal not found' });

    const proposal = job.proposals.id(req.params.proposalId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status !== 'pending') return res.status(400).json({ error: `Cannot withdraw: proposal is ${proposal.status}` });

    proposal.status = 'withdrawn';
    await job.save();

    res.json({ message: 'Proposal withdrawn', jobId: job._id });
  } catch (err) {
    console.error('withdraw team proposal error:', err.message);
    res.status(500).json({ error: 'Failed to withdraw proposal' });
  }
});

// PATCH /api/teams/:id/jobs/:jobId/lead — assign a team member as lead
router.patch('/:id/jobs/:jobId/lead', async (req, res) => {
  try {
    const { memberId } = req.body;
    if (!memberId) return res.status(400).json({ error: 'memberId required' });

    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId: req.user.userId, action: 'assign_work' });
    if (!authz.ok) return res.status(403).json({ error: 'No permission to assign work' });

    if (!team.isMember(memberId)) return res.status(400).json({ error: 'User is not a team member' });

    const job = await Job.findOne({ _id: req.params.jobId, team: team._id });
    if (!job) return res.status(404).json({ error: 'Job not found in this team' });

    job.assignedTo = memberId;
    await job.save();

    const updatedJob = await Job.findById(job._id)
      .populate('assignedTo', 'firstName lastName username avatar')
      .lean();

    TeamAuditLog.logSafe({
      team: team._id,
      job: job._id,
      actor: req.user._id,
      action: 'job_lead_assigned',
      after: { assignedTo: memberId },
    });

    res.json({ message: 'Lead assigned', job: updatedJob });
  } catch (err) {
    console.error('assign team lead error:', err.message);
    res.status(500).json({ error: 'Failed to assign lead' });
  }
});

// ── Team job workspace routes ──

// ════════════════════════════════════════════════════════════════
// SUBTASKS – lite Trello per job
// ════════════════════════════════════════════════════════════════

// GET subtasks for a job
router.get('/:id/jobs/:jobId/subtasks', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const subtasks = await TeamSubtask.find({ team: team._id, job: req.params.jobId })
      .populate('assignedTo', 'firstName lastName username avatar')
      .populate('createdBy', 'firstName lastName')
      .sort({ order: 1, createdAt: 1 })
      .lean();

    res.json({ subtasks });
  } catch (err) {
    console.error('get subtasks error:', err.message);
    res.status(500).json({ error: 'Failed to fetch subtasks' });
  }
});

// CREATE subtask
router.post('/:id/jobs/:jobId/subtasks', async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate, priority } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const job = await Job.findOne({ _id: req.params.jobId, team: team._id });
    if (!job) return res.status(404).json({ error: 'Job not found in this team' });

    // Get max order to append at end
    const last = await TeamSubtask.findOne({ team: team._id, job: job._id }).sort({ order: -1 }).lean();
    const order = last ? last.order + 1 : 0;

    const subtask = await TeamSubtask.create({
      team: team._id,
      job: job._id,
      title: title.trim(),
      description: description || '',
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
      priority: priority || 'medium',
      createdBy: req.user.userId,
      order,
    });

    const populated = await TeamSubtask.findById(subtask._id)
      .populate('assignedTo', 'firstName lastName username avatar')
      .populate('createdBy', 'firstName lastName')
      .lean();

    TeamAuditLog.logSafe({
      team: team._id, job: job._id, actor: req.user._id,
      action: 'subtask_created', metadata: { subtaskId: subtask._id, title: title.trim() },
    });

    res.status(201).json({ subtask: populated });
  } catch (err) {
    console.error('create subtask error:', err.message);
    res.status(500).json({ error: 'Failed to create subtask' });
  }
});

// REORDER subtasks (batch)
router.patch('/:id/jobs/:jobId/subtasks/reorder', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });

    const bulkOps = order.map(({ id, order: o }) => ({
      updateOne: { filter: { _id: id, team: team._id, job: req.params.jobId }, update: { $set: { order: o } } },
    }));
    if (bulkOps.length > 0) await TeamSubtask.bulkWrite(bulkOps);

    res.json({ message: 'Order updated' });
  } catch (err) {
    console.error('reorder subtasks error:', err.message);
    res.status(500).json({ error: 'Failed to reorder subtasks' });
  }
});

// UPDATE subtask
router.put('/:id/jobs/:jobId/subtasks/:subtaskId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const subtask = await TeamSubtask.findOne({
      _id: req.params.subtaskId,
      team: team._id,
      job: req.params.jobId,
    });
    if (!subtask) return res.status(404).json({ error: 'Subtask not found' });

    const allowed = ['title', 'description', 'assignedTo', 'dueDate', 'status', 'priority', 'order'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) subtask[key] = req.body[key];
    }

    // Set completedAt when transitioning to done
    if (req.body.status === 'done' && !subtask.completedAt) {
      subtask.completedAt = new Date();
    } else if (req.body.status && req.body.status !== 'done') {
      subtask.completedAt = null;
    }

    await subtask.save();

    // Audit logs for status/assignment changes
    if (req.body.status === 'done') {
      TeamAuditLog.logSafe({
        team: team._id, job: req.params.jobId, actor: req.user._id,
        action: 'subtask_completed', metadata: { subtaskId: subtask._id, title: subtask.title },
      });
    }
    if (req.body.assignedTo !== undefined) {
      TeamAuditLog.logSafe({
        team: team._id, job: req.params.jobId, actor: req.user._id,
        action: 'subtask_assigned', metadata: { subtaskId: subtask._id, assignedTo: req.body.assignedTo },
      });
    }

    const populated = await TeamSubtask.findById(subtask._id)
      .populate('assignedTo', 'firstName lastName username avatar')
      .populate('createdBy', 'firstName lastName')
      .lean();

    res.json({ subtask: populated });
  } catch (err) {
    console.error('update subtask error:', err.message);
    res.status(500).json({ error: 'Failed to update subtask' });
  }
});

// DELETE subtask
router.delete('/:id/jobs/:jobId/subtasks/:subtaskId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const subtask = await TeamSubtask.findOneAndDelete({
      _id: req.params.subtaskId,
      team: team._id,
      job: req.params.jobId,
    });
    if (!subtask) return res.status(404).json({ error: 'Subtask not found' });

    res.json({ message: 'Subtask deleted' });
  } catch (err) {
    console.error('delete subtask error:', err.message);
    res.status(500).json({ error: 'Failed to delete subtask' });
  }
});

// ════════════════════════════════════════════════════════════════
// JOB ROLES – per-job role assignment
// ════════════════════════════════════════════════════════════════

// GET roles for a job
router.get('/:id/jobs/:jobId/roles', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const roles = await TeamJobRole.find({ team: team._id, job: req.params.jobId })
      .populate('user', 'firstName lastName username avatar')
      .lean();

    res.json({ roles });
  } catch (err) {
    console.error('get job roles error:', err.message);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// PUT roles for a job (replace whole array)
router.put('/:id/jobs/:jobId/roles', async (req, res) => {
  try {
    const { roles } = req.body; // [{ userId, role, customRole }]
    if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles must be an array' });

    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId: req.user.userId, action: 'assign_work' });
    if (!authz.ok) return res.status(403).json({ error: 'Not authorized to assign roles' });

    const job = await Job.findOne({ _id: req.params.jobId, team: team._id });
    if (!job) return res.status(404).json({ error: 'Job not found in this team' });

    // Delete existing and bulk insert
    await TeamJobRole.deleteMany({ team: team._id, job: job._id });

    const validRoles = ['designer', 'developer', 'reviewer', 'pm', 'writer', 'other'];
    const docs = roles
      .filter(r => r.userId && validRoles.includes(r.role))
      .map(r => ({
        team: team._id,
        job: job._id,
        user: r.userId,
        role: r.role,
        customRole: r.customRole || '',
      }));

    if (docs.length > 0) await TeamJobRole.insertMany(docs);

    const saved = await TeamJobRole.find({ team: team._id, job: job._id })
      .populate('user', 'firstName lastName username avatar')
      .lean();

    TeamAuditLog.logSafe({
      team: team._id, job: job._id, actor: req.user._id,
      action: 'job_role_set', after: { roles: docs.map(d => ({ user: d.user, role: d.role })) },
    });

    res.json({ roles: saved });
  } catch (err) {
    console.error('set job roles error:', err.message);
    res.status(500).json({ error: 'Failed to set roles' });
  }
});

// ════════════════════════════════════════════════════════════════
// WORKLOAD – member active-job counts
// ════════════════════════════════════════════════════════════════

router.get('/:id/members/workload', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const activeMembers = team.members.filter(m => m.status === 'active').map(m => getId(m.user));

    // Count jobs where member is lead
    const leadCounts = await Job.aggregate([
      { $match: { team: team._id, status: { $in: ['accepted', 'pending_start', 'in_progress', 'delivered'] } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
    ]);

    // Count subtasks assigned to members (not done)
    const subtaskCounts = await TeamSubtask.aggregate([
      { $match: { team: team._id, status: { $ne: 'done' }, assignedTo: { $ne: null } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
    ]);

    const workload = {};
    for (const mid of activeMembers) {
      workload[mid] = 0;
    }
    for (const lc of leadCounts) {
      if (lc._id) workload[String(lc._id)] = (workload[String(lc._id)] || 0) + lc.count;
    }
    for (const sc of subtaskCounts) {
      if (sc._id) workload[String(sc._id)] = (workload[String(sc._id)] || 0) + sc.count;
    }

    res.json({ workload });
  } catch (err) {
    console.error('workload error:', err.message);
    res.status(500).json({ error: 'Failed to fetch workload' });
  }
});

// ════════════════════════════════════════════════════════════════
// JOB CHAT – internal team thread per job
// ════════════════════════════════════════════════════════════════

// GET chat messages (paginated, cursor-based)
router.get('/:id/jobs/:jobId/chat', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const limit = Math.min(parseInt(req.query.limit) || 30, 50);
    const query = { team: team._id, job: req.params.jobId };
    if (req.query.before) {
      query.createdAt = { $lt: new Date(req.query.before) };
    }

    const messages = await TeamJobChat.find(query)
      .populate('author', 'firstName lastName username avatar')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // For soft-deleted messages, redact the message body
    const cleaned = messages.map(m => {
      if (m.deletedAt) return { ...m, message: 'This message was deleted' };
      return m;
    });

    res.json({ messages: cleaned.reverse(), hasMore: messages.length === limit });
  } catch (err) {
    console.error('get chat error:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST send message
router.post('/:id/jobs/:jobId/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });
    if (message.length > 2000) return res.status(400).json({ error: 'Message too long (max 2000 chars)' });

    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    // Parse @mentions — match @firstName against team members (single query)
    const mentions = [];
    const mentionMatches = [...message.matchAll(/@(\w+)/g)];
    if (mentionMatches.length > 0) {
      const activeMemberIds = team.members.filter(m => m.status === 'active').map(m => getId(m.user));
      const memberUsers = await User.find({ _id: { $in: activeMemberIds } }).select('_id firstName').lean();
      for (const mm of mentionMatches) {
        const name = mm[1].toLowerCase();
        for (const u of memberUsers) {
          if (u.firstName && u.firstName.toLowerCase() === name) {
            mentions.push(String(u._id));
          }
        }
      }
    }

    const chatMsg = await TeamJobChat.create({
      team: team._id,
      job: req.params.jobId,
      author: req.user.userId,
      message: message.trim(),
      mentions: [...new Set(mentions)],
    });

    const populated = await TeamJobChat.findById(chatMsg._id)
      .populate('author', 'firstName lastName username avatar')
      .lean();

    TeamAuditLog.logSafe({
      team: team._id, job: req.params.jobId, actor: req.user._id,
      action: 'chat_message_sent',
    });

    res.status(201).json({ message: populated });
  } catch (err) {
    console.error('send chat error:', err.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT edit message (author only, within 15 min)
router.put('/:id/jobs/:jobId/chat/:msgId', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });
    if (message.length > 2000) return res.status(400).json({ error: 'Message too long' });

    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const chatMsg = await TeamJobChat.findOne({
      _id: req.params.msgId,
      team: team._id,
      job: req.params.jobId,
      deletedAt: null,
    });
    if (!chatMsg) return res.status(404).json({ error: 'Message not found' });
    if (String(chatMsg.author) !== String(req.user.userId)) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    const ageMs = Date.now() - chatMsg.createdAt.getTime();
    if (ageMs > 15 * 60 * 1000) {
      return res.status(400).json({ error: 'Can only edit messages within 15 minutes' });
    }

    chatMsg.message = message.trim();
    chatMsg.editedAt = new Date();
    await chatMsg.save();

    const populated = await TeamJobChat.findById(chatMsg._id)
      .populate('author', 'firstName lastName username avatar')
      .lean();

    res.json({ message: populated });
  } catch (err) {
    console.error('edit chat error:', err.message);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// DELETE soft-delete message
router.delete('/:id/jobs/:jobId/chat/:msgId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const chatMsg = await TeamJobChat.findOne({
      _id: req.params.msgId,
      team: team._id,
      job: req.params.jobId,
      deletedAt: null,
    });
    if (!chatMsg) return res.status(404).json({ error: 'Message not found' });

    // Author or team admin/owner can delete
    const isAuthor = String(chatMsg.author) === String(req.user.userId);
    const isAdminOrOwner = team.isOwnerOrAdmin(req.user.userId);
    if (!isAuthor && !isAdminOrOwner) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    chatMsg.deletedAt = new Date();
    await chatMsg.save();

    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('delete chat error:', err.message);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// ════════════════════════════════════════════════════════════════
// JOB-SCOPED PROGRESS NOTES
// ════════════════════════════════════════════════════════════════

// GET progress notes for a job
router.get('/:id/jobs/:jobId/notes', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const notes = await TeamNote.find({ team: team._id, job: req.params.jobId })
      .populate('author', 'firstName lastName username avatar')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ notes });
  } catch (err) {
    console.error('get job notes error:', err.message);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// POST create progress note for a job
router.post('/:id/jobs/:jobId/notes', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });
    if (content.length > 1000) return res.status(400).json({ error: 'Content must be 1000 characters or fewer' });

    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const job = await Job.findOne({ _id: req.params.jobId, team: team._id });
    if (!job) return res.status(404).json({ error: 'Job not found in this team' });

    // Parse @mentions (single query, team members only)
    const mentions = [];
    const mentionMatches = [...content.matchAll(/@(\w+)/g)];
    if (mentionMatches.length > 0) {
      const activeMemberIds = team.members.filter(m => m.status === 'active').map(m => getId(m.user));
      const memberUsers = await User.find({ _id: { $in: activeMemberIds } }).select('_id firstName').lean();
      for (const mm of mentionMatches) {
        const name = mm[1].toLowerCase();
        for (const u of memberUsers) {
          if (u.firstName && u.firstName.toLowerCase() === name) {
            mentions.push(String(u._id));
          }
        }
      }
    }

    const note = await TeamNote.create({
      team: team._id,
      job: job._id,
      author: req.user.userId,
      content: content.trim(),
      mentions: [...new Set(mentions)],
      relatedTo: { type: 'job', id: job._id },
    });

    const populated = await TeamNote.findById(note._id)
      .populate('author', 'firstName lastName username avatar')
      .lean();

    // Audit log
    TeamAuditLog.logSafe({
      team: team._id,
      job: job._id,
      actor: req.user._id,
      action: 'progress_note_added',
      metadata: { noteId: note._id },
    });

    res.status(201).json({ note: populated });
  } catch (err) {
    console.error('create job note error:', err.message);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// DELETE progress note for a job
router.delete('/:id/jobs/:jobId/notes/:noteId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const note = await TeamNote.findOne({ _id: req.params.noteId, team: team._id, job: req.params.jobId });
    if (!note) return res.status(404).json({ error: 'Note not found' });

    const isAuthor = String(note.author) === requesterId;
    const ctx = getTeamAccessContext(team, requesterId);
    if (!isAuthor && !ctx.isOwner && !ctx.isAdmin) {
      return res.status(403).json({ error: 'Only the author or an admin can delete this note' });
    }

    await TeamNote.deleteOne({ _id: note._id });
    res.json({ message: 'Note deleted' });
  } catch (err) {
    console.error('delete job note error:', err.message);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// ════════════════════════════════════════════════════════════════
// ACTIVITY FEED — per-job audit log entries
// ════════════════════════════════════════════════════════════════

router.get('/:id/jobs/:jobId/activity', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const entries = await TeamAuditLog.find({ team: team._id, job: req.params.jobId })
      .populate('actor', 'firstName lastName username avatar')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ entries });
  } catch (err) {
    console.error('job activity error:', err.message);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ════════════════════════════════════════════════════════════════
// KANBAN COLUMN — update per-job kanban stage
// ════════════════════════════════════════════════════════════════

router.put('/:id/jobs/:jobId/kanban', async (req, res) => {
  try {
    const { column } = req.body;
    const validColumns = ['backlog', 'in_progress', 'review', 'done'];
    if (!validColumns.includes(column)) return res.status(400).json({ error: 'Invalid kanban column' });

    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const job = await Job.findOne({ _id: req.params.jobId, team: team._id });
    if (!job) return res.status(404).json({ error: 'Job not found in this team' });

    job.kanbanColumn = column;
    await job.save();

    TeamAuditLog.logSafe({
      team: team._id,
      job: job._id,
      actor: req.user._id,
      action: 'job_kanban_updated',
      after: { kanbanColumn: column },
    });

    res.json({ message: 'Kanban column updated', kanbanColumn: column });
  } catch (err) {
    console.error('kanban update error:', err.message);
    res.status(500).json({ error: 'Failed to update kanban column' });
  }
});

// ════════════════════════════════════════════════════════════════
// PIN JOBS — float to top
// ════════════════════════════════════════════════════════════════

router.post('/:id/jobs/:jobId/pin', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const job = await Job.findOne({ _id: req.params.jobId, team: team._id });
    if (!job) return res.status(404).json({ error: 'Job not found in this team' });

    const pinnedJobs = team.pinnedJobs || [];
    const jobIdStr = String(job._id);
    const isPinned = pinnedJobs.map(String).includes(jobIdStr);

    if (isPinned) {
      await Team.updateOne({ _id: team._id }, { $pull: { pinnedJobs: job._id } });
      TeamAuditLog.logSafe({ team: team._id, job: job._id, actor: req.user._id, action: 'job_unpinned' });
      res.json({ pinned: false });
    } else {
      await Team.updateOne({ _id: team._id }, { $addToSet: { pinnedJobs: job._id } });
      TeamAuditLog.logSafe({ team: team._id, job: job._id, actor: req.user._id, action: 'job_pinned' });
      res.json({ pinned: true });
    }
  } catch (err) {
    console.error('pin job error:', err.message);
    res.status(500).json({ error: 'Failed to pin/unpin job' });
  }
});

// ════════════════════════════════════════════════════════════════
// QUICK ACTIONS — mark urgent, set deadline
// ════════════════════════════════════════════════════════════════

router.patch('/:id/jobs/:jobId/quick', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const job = await Job.findOne({ _id: req.params.jobId, team: team._id });
    if (!job) return res.status(404).json({ error: 'Job not found in this team' });

    if (req.body.urgent !== undefined) job.urgent = Boolean(req.body.urgent);
    if (req.body.deadline !== undefined) job.deadline = req.body.deadline ? new Date(req.body.deadline) : null;

    await job.save();
    res.json({ message: 'Updated', job: { _id: job._id, urgent: job.urgent, deadline: job.deadline } });
  } catch (err) {
    console.error('quick action error:', err.message);
    res.status(500).json({ error: 'Failed to update job' });
  }
});


// ════════════════════════════════════════════════════════════════
// TEAM TASKS — per_job / per_hour payout system
// ════════════════════════════════════════════════════════════════

// Helper: deduct amount from team wallet (FIFO across BillingCredits)
async function deductTeamWallet(teamId, amount, session = null) {
  const opts = session ? { session } : {};
  const credits = await BillingCredit.find({
    team: teamId,
    status: 'active',
    remaining: { $gt: 0 },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }, null, opts).sort({ createdAt: 1 });

  const balance = credits.reduce((s, c) => s + (c.remaining || 0), 0);
  if (balance < amount) throw Object.assign(new Error('Insufficient wallet balance'), { code: 'INSUFFICIENT_FUNDS', balance });

  let remaining = amount;
  const consumed = [];
  for (const credit of credits) {
    if (remaining <= 0) break;
    const deduct = Math.min(credit.remaining, remaining);
    credit.remaining = Math.round((credit.remaining - deduct) * 100) / 100;
    if (credit.remaining <= 0) credit.status = 'used';
    await credit.save(opts);
    consumed.push(credit._id);
    remaining = Math.round((remaining - deduct) * 100) / 100;
  }
  return consumed;
}

// POST /api/teams/:id/tasks — create a task with optional payout config
router.post('/:id/tasks', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'manage_tasks' });
    if (!authz.ok) return res.status(403).json({ error: 'No permission to create tasks' });

    const { title, description, assignedTo, jobId, dueDate, priority,
            payoutType, payoutAmount, hourlyRate, selfApprovePayout } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });

    // Validate payout config
    if (payoutType === 'per_job' && (!payoutAmount || payoutAmount <= 0)) {
      return res.status(400).json({ error: 'payoutAmount required for per_job tasks' });
    }
    if (payoutType === 'per_hour' && (!hourlyRate || hourlyRate <= 0)) {
      return res.status(400).json({ error: 'hourlyRate required for per_hour tasks' });
    }

    if (assignedTo && !team.isMember(assignedTo)) {
      return res.status(400).json({ error: 'assignedTo must be a team member' });
    }
    if (jobId) {
      const job = await Job.findOne({ _id: jobId, team: team._id });
      if (!job) return res.status(400).json({ error: 'Job not found in this team' });
    }

    const task = await TeamTask.create({
      team: team._id,
      job: jobId || null,
      title: title.trim(),
      description: description || '',
      assignedTo: assignedTo || null,
      assignedBy: assignedTo ? requesterId : null,
      assignedAt: assignedTo ? new Date() : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority || 'medium',
      payoutType: payoutType || 'none',
      payoutAmount: payoutType === 'per_job' ? parseFloat(payoutAmount) : null,
      hourlyRate:   payoutType === 'per_hour' ? parseFloat(hourlyRate) : null,
      selfApprovePayout: Boolean(selfApprovePayout),
      createdBy: requesterId,
    });

    await TeamAuditLog.create({
      team: team._id, actor: requesterId, action: 'task_created',
      details: `Task "${task.title}" created${payoutType !== 'none' ? ` (${payoutType})` : ''}`,
      targetEntity: 'task', targetId: task._id,
    }).catch(() => {});

    if (assignedTo) {
      Notification.notify({
        recipient: assignedTo,
        type: 'team_task_assigned',
        title: 'New task assigned',
        message: `You were assigned "${task.title}" on ${team.name}${payoutType !== 'none' ? ` ($${(payoutAmount || hourlyRate)}/hr)` : ''}`,
        link: `/teams/${team._id}`,
      }).catch(() => {});
    }

    const populated = await TeamTask.findById(task._id)
      .populate('assignedTo', 'firstName lastName username avatar')
      .populate('createdBy', 'firstName lastName')
      .lean();

    res.status(201).json({ task: populated });
  } catch (err) {
    console.error('Create team task error:', err.message);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /api/teams/:id/tasks — list tasks (member sees own; admin sees all)
router.get('/:id/tasks', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'read_tasks' });
    if (!authz.ok) return res.status(403).json({ error: 'Not a team member' });

    const ctx = getTeamAccessContext(team, requesterId);
    const filter = { team: team._id };

    // Non-admins only see their own tasks
    if (!ctx.isOwner && !ctx.isAdmin && !ctx.canAssignWork) {
      filter.assignedTo = requesterId;
    }

    // Optional filters
    if (req.query.status) filter.status = req.query.status;
    if (req.query.jobId) filter.job = req.query.jobId;
    if (req.query.payoutStatus) filter.payoutStatus = req.query.payoutStatus;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;

    const tasks = await TeamTask.find(filter)
      .populate('assignedTo', 'firstName lastName username avatar')
      .populate('job', 'title')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load tasks' });
  }
});

// PUT /api/teams/:id/tasks/:taskId — update task metadata
router.put('/:id/tasks/:taskId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const task = await TeamTask.findOne({ _id: req.params.taskId, team: team._id });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const ctx = getTeamAccessContext(team, requesterId);
    const isAssignee = String(task.assignedTo) === requesterId;
    if (!ctx.canAssignWork && !isAssignee) return res.status(403).json({ error: 'No permission' });

    // Assignee can update status and log hours; admins can update everything
    const { title, description, dueDate, priority, status, assignedTo,
            payoutType, payoutAmount, hourlyRate, selfApprovePayout } = req.body;

    if (ctx.canAssignWork) {
      if (title !== undefined) task.title = title.trim();
      if (description !== undefined) task.description = description;
      if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
      if (priority !== undefined) task.priority = priority;
      if (selfApprovePayout !== undefined) task.selfApprovePayout = Boolean(selfApprovePayout);
      if (assignedTo !== undefined) {
        if (assignedTo && !team.isMember(assignedTo)) return res.status(400).json({ error: 'Not a team member' });
        task.assignedTo = assignedTo || null;
        task.assignedBy = assignedTo ? requesterId : null;
        task.assignedAt = assignedTo ? new Date() : null;
      }
      if (payoutType !== undefined) {
        if (payoutType === 'per_job' && (!payoutAmount || payoutAmount <= 0)) return res.status(400).json({ error: 'payoutAmount required' });
        if (payoutType === 'per_hour' && (!hourlyRate || hourlyRate <= 0)) return res.status(400).json({ error: 'hourlyRate required' });
        task.payoutType = payoutType;
        task.payoutAmount = payoutType === 'per_job' ? parseFloat(payoutAmount) : null;
        task.hourlyRate   = payoutType === 'per_hour' ? parseFloat(hourlyRate) : null;
      }
    }

    // Status changes (assignee or admin)
    if (status !== undefined) {
      const validStatuses = ['open', 'in_progress', 'submitted'];
      if (!ctx.canAssignWork && !validStatuses.includes(status)) return res.status(403).json({ error: 'Cannot set that status' });
      task.status = status;
      if (status === 'in_progress' && !task.assignedTo) task.assignedTo = requesterId;
    }

    await task.save();
    const populated = await TeamTask.findById(task._id)
      .populate('assignedTo', 'firstName lastName username avatar')
      .populate('job', 'title')
      .lean();
    res.json({ task: populated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/teams/:id/tasks/:taskId
router.delete('/:id/tasks/:taskId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'manage_tasks' });
    if (!authz.ok) return res.status(403).json({ error: 'No permission' });

    const task = await TeamTask.findOne({ _id: req.params.taskId, team: team._id });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.payoutStatus === 'paid') return res.status(400).json({ error: 'Cannot delete a paid task' });

    await task.deleteOne();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST /api/teams/:id/tasks/:taskId/log-hours — assignee logs hours (per_hour tasks)
router.post('/:id/tasks/:taskId/log-hours', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const task = await TeamTask.findOne({ _id: req.params.taskId, team: team._id });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.payoutType !== 'per_hour') return res.status(400).json({ error: 'Only per_hour tasks support hour logging' });

    const ctx = getTeamAccessContext(team, requesterId);
    const isAssignee = String(task.assignedTo) === requesterId;
    if (!ctx.canAssignWork && !isAssignee) return res.status(403).json({ error: 'No permission' });

    const hours = parseFloat(req.body.hours);
    if (!hours || hours <= 0 || hours > 24) return res.status(400).json({ error: 'Hours must be 0–24' });

    task.hoursLogged = Math.round(((task.hoursLogged || 0) + hours) * 100) / 100;
    if (task.status === 'open') task.status = 'in_progress';
    await task.save();

    res.json({
      task: { _id: task._id, hoursLogged: task.hoursLogged, status: task.status },
      estimatedPayout: Math.round(task.hoursLogged * (task.hourlyRate || 0) * 100) / 100,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log hours' });
  }
});

// POST /api/teams/:id/tasks/:taskId/submit — member submits task for payout
router.post('/:id/tasks/:taskId/submit', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const task = await TeamTask.findOne({ _id: req.params.taskId, team: team._id });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (String(task.assignedTo) !== requesterId) return res.status(403).json({ error: 'Only the assignee can submit' });
    if (!['open', 'in_progress'].includes(task.status)) return res.status(400).json({ error: `Cannot submit from status: ${task.status}` });
    if (task.payoutType === 'none') return res.status(400).json({ error: 'This task has no payout configured' });
    if (task.payoutType === 'per_hour' && (!task.hoursLogged || task.hoursLogged <= 0)) {
      return res.status(400).json({ error: 'Log hours before submitting' });
    }

    task.status = 'submitted';
    task.completedAt = new Date();
    task.submissionNote = req.body.note || '';
    task.payoutStatus = 'requested';
    task.payoutRequestedAt = new Date();
    task.payoutRequestedBy = requesterId;

    // Check if self-approve is allowed
    const amount = task.effectivePayoutAmount;
    const { payoutRequiresApproval, payoutThresholdAmount } = team.approvalThresholds || {};
    const needsApproval = payoutRequiresApproval && amount >= (payoutThresholdAmount || 0);

    if (task.selfApprovePayout && !needsApproval) {
      // Auto-approve — payout execution still needs explicit /pay call
      task.status = 'approved';
      task.payoutStatus = 'approved';
      task.payoutApprovedBy = requesterId;
      task.payoutApprovedAt = new Date();
    }

    await task.save();

    // Notify admins if approval needed
    if (task.payoutStatus === 'requested') {
      const admins = team.members.filter(m => ['owner', 'admin'].includes(m.role) && m.status === 'active');
      for (const admin of admins) {
        Notification.notify({
          recipient: admin.user,
          type: 'team_payout_requested',
          title: 'Payout approval needed',
          message: `${req.user.firstName || 'A member'} submitted "${task.title}" for payout ($${amount.toFixed(2)})`,
          link: `/teams/${team._id}`,
        }).catch(() => {});
      }
    }

    res.json({ task: { _id: task._id, status: task.status, payoutStatus: task.payoutStatus, amount } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

// POST /api/teams/:id/tasks/:taskId/approve — admin approves payout
router.post('/:id/tasks/:taskId/approve', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'approve_payouts' });
    if (!authz.ok) return res.status(403).json({ error: 'No permission to approve payouts' });

    const task = await TeamTask.findOne({ _id: req.params.taskId, team: team._id });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.payoutStatus !== 'requested') return res.status(400).json({ error: `Payout is not pending approval (status: ${task.payoutStatus})` });

    // Approver can override hoursApproved for per_hour tasks
    if (task.payoutType === 'per_hour' && req.body.hoursApproved !== undefined) {
      const h = parseFloat(req.body.hoursApproved);
      if (isNaN(h) || h < 0) return res.status(400).json({ error: 'Invalid hoursApproved' });
      task.hoursApproved = h;
    }

    task.status = 'approved';
    task.payoutStatus = 'approved';
    task.payoutApprovedBy = requesterId;
    task.payoutApprovedAt = new Date();
    await task.save();

    Notification.notify({
      recipient: task.assignedTo,
      type: 'team_payout_approved',
      title: 'Payout approved',
      message: `Your payout for "${task.title}" was approved ($${task.effectivePayoutAmount.toFixed(2)})`,
      link: `/teams/${team._id}`,
    }).catch(() => {});

    res.json({ task: { _id: task._id, status: task.status, payoutStatus: task.payoutStatus, amount: task.effectivePayoutAmount } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve payout' });
  }
});

// POST /api/teams/:id/tasks/:taskId/reject — admin rejects payout request
router.post('/:id/tasks/:taskId/reject', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'approve_payouts' });
    if (!authz.ok) return res.status(403).json({ error: 'No permission' });

    const task = await TeamTask.findOne({ _id: req.params.taskId, team: team._id });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!['requested', 'approved'].includes(task.payoutStatus)) return res.status(400).json({ error: 'Nothing to reject' });

    task.status = 'rejected';
    task.payoutStatus = 'rejected';
    task.payoutRejectedBy = requesterId;
    task.payoutRejectedAt = new Date();
    task.payoutRejectionReason = req.body.reason || '';
    await task.save();

    Notification.notify({
      recipient: task.assignedTo,
      type: 'team_payout_rejected',
      title: 'Payout rejected',
      message: `Your payout for "${task.title}" was rejected${task.payoutRejectionReason ? `: ${task.payoutRejectionReason}` : ''}`,
      link: `/teams/${team._id}`,
    }).catch(() => {});

    res.json({ task: { _id: task._id, status: task.status, payoutStatus: task.payoutStatus } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject payout' });
  }
});

// POST /api/teams/:id/tasks/:taskId/pay — execute payout from team wallet
router.post('/:id/tasks/:taskId/pay', async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id).session(session);
    if (!team || !team.isActive) { await session.abortTransaction(); return res.status(404).json({ error: 'Team not found' }); }

    const authz = authorizeTeamAction({ team, requesterId, action: 'approve_payouts' });
    if (!authz.ok) { await session.abortTransaction(); return res.status(403).json({ error: 'No permission to execute payouts' }); }

    const task = await TeamTask.findOne({ _id: req.params.taskId, team: team._id }).session(session);
    if (!task) { await session.abortTransaction(); return res.status(404).json({ error: 'Task not found' }); }
    if (task.payoutStatus !== 'approved') { await session.abortTransaction(); return res.status(400).json({ error: 'Task must be approved before payout' }); }
    if (!task.assignedTo) { await session.abortTransaction(); return res.status(400).json({ error: 'No assignee to pay' }); }

    const amount = task.effectivePayoutAmount;
    if (amount <= 0) { await session.abortTransaction(); return res.status(400).json({ error: 'Payout amount must be > 0' }); }

    // Deduct from team wallet (FIFO)
    let consumed;
    try {
      consumed = await deductTeamWallet(team._id, amount, session);
    } catch (err) {
      await session.abortTransaction();
      if (err.code === 'INSUFFICIENT_FUNDS') return res.status(402).json({ error: `Insufficient wallet balance ($${(err.balance || 0).toFixed(2)} available, $${amount.toFixed(2)} needed)` });
      throw err;
    }

    // Create payout record
    const payout = await TeamPayout.create([{
      team: team._id,
      type: 'member_payout',
      task: task._id,
      recipientUser: task.assignedTo,
      amount,
      payoutType: task.payoutType,
      hourlyRate: task.hourlyRate || null,
      hoursApproved: task.hoursApproved || task.hoursLogged || null,
      billingCreditIds: consumed,
      status: 'completed',
      approvedBy: task.payoutApprovedBy,
      approvedAt: task.payoutApprovedAt,
      executedBy: requesterId,
      executedAt: new Date(),
      note: req.body.note || '',
      createdBy: requesterId,
    }], { session });

    // Mark task paid
    task.status = 'paid';
    task.payoutStatus = 'paid';
    task.payoutPaidAt = new Date();
    task.payoutTransaction = payout[0]._id;
    await task.save({ session });

    await session.commitTransaction();

    // Credit the recipient's personal wallet for withdrawal
    await BillingCredit.create({
      user: task.assignedTo,
      amount,
      remaining: amount,
      type: 'team_payout',
      reason: `Team payout: ${task.title} (${team.name})`,
      status: 'active',
      metadata: { teamId: team._id.toString(), taskId: task._id.toString(), payoutId: payout[0]._id.toString() },
    }).catch(() => {});

    Notification.notify({
      recipient: task.assignedTo,
      type: 'team_payout_paid',
      title: 'Payment sent',
      message: `$${amount.toFixed(2)} from "${task.title}" has been added to your wallet`,
      link: `/wallet`,
    }).catch(() => {});

    await TeamAuditLog.create({
      team: team._id, actor: requesterId, action: 'payout_executed',
      details: `Paid $${amount.toFixed(2)} for task "${task.title}"`,
      targetEntity: 'task', targetId: task._id,
    }).catch(() => {});

    res.json({ message: 'Payout sent', amount, payoutId: payout[0]._id });
  } catch (err) {
    await session.abortTransaction();
    console.error('Team payout error:', err.message);
    res.status(500).json({ error: 'Payout failed' });
  } finally {
    session.endSession();
  }
});

// GET /api/teams/:id/payouts — payout history (wallet + member payouts)
router.get('/:id/payouts', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'view_wallet' });
    if (!authz.ok) return res.status(403).json({ error: 'No wallet access' });

    const ctx = getTeamAccessContext(team, requesterId);
    const filter = { team: team._id };

    // Non-admins only see their own payouts
    if (!ctx.canViewWallet) filter.recipientUser = requesterId;

    const payouts = await TeamPayout.find(filter)
      .populate('recipientUser', 'firstName lastName username avatar')
      .populate('recipientTeam', 'name slug logo')
      .populate('task', 'title payoutType')
      .populate('job', 'title')
      .populate('executedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit) || 50)
      .lean();

    res.json({ payouts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load payouts' });
  }
});

// ════════════════════════════════════════════════════════════════
// OUTSOURCING — team wallet funds external hires
// ════════════════════════════════════════════════════════════════

// POST /api/teams/:id/outsource — post a job funded from team wallet
router.post('/:id/outsource', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (!team.outsourcingEnabled) return res.status(403).json({ error: 'Outsourcing is not enabled for this team' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'approve_outsourcing' });
    if (!authz.ok) return res.status(403).json({ error: 'No permission to outsource' });

    const { title, description, budget, category, skills } = req.body;
    if (!title?.trim() || !budget?.amount) return res.status(400).json({ error: 'title and budget.amount required' });

    const amount = parseFloat(budget.amount);

    // Check wallet balance
    const credits = await BillingCredit.find({
      team: team._id, status: 'active', remaining: { $gt: 0 },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).lean();
    const balance = credits.reduce((s, c) => s + (c.remaining || 0), 0);
    if (balance < amount) return res.status(402).json({ error: `Insufficient wallet balance ($${balance.toFixed(2)} available)` });

    // Create the job — posted by team owner, linked to team
    const job = await Job.create({
      title: title.trim(),
      description: description || '',
      budget: { amount, type: budget.type || 'fixed', currency: 'USD' },
      category: category || 'other',
      skills: skills || [],
      postedBy: requesterId,
      team: team._id,
      status: 'open',
      fundedFromWallet: true,
      walletReservedAmount: amount,
    });

    await TeamAuditLog.create({
      team: team._id, actor: requesterId, action: 'outsource_job_created',
      details: `Outsource job "${job.title}" created ($${amount})`,
      targetEntity: 'job', targetId: job._id,
    }).catch(() => {});

    res.status(201).json({ job: { _id: job._id, title: job.title, budget: job.budget } });
  } catch (err) {
    console.error('Team outsource error:', err.message);
    res.status(500).json({ error: 'Failed to create outsource job' });
  }
});

// POST /api/teams/:id/outsource/:jobId/pay — pay hired freelancer/team from wallet
router.post('/:id/outsource/:jobId/pay', async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id).session(session);
    if (!team || !team.isActive) { await session.abortTransaction(); return res.status(404).json({ error: 'Team not found' }); }

    const authz = authorizeTeamAction({ team, requesterId, action: 'approve_outsourcing' });
    if (!authz.ok) { await session.abortTransaction(); return res.status(403).json({ error: 'No permission' }); }

    const job = await Job.findOne({ _id: req.params.jobId, team: team._id }).session(session);
    if (!job) { await session.abortTransaction(); return res.status(404).json({ error: 'Job not found' }); }

    const { recipientUserId, recipientTeamId, amount } = req.body;
    if (!recipientUserId && !recipientTeamId) { await session.abortTransaction(); return res.status(400).json({ error: 'recipientUserId or recipientTeamId required' }); }
    const payAmount = parseFloat(amount || job.budget?.amount);
    if (!payAmount || payAmount <= 0) { await session.abortTransaction(); return res.status(400).json({ error: 'Valid amount required' }); }

    let consumed;
    try {
      consumed = await deductTeamWallet(team._id, payAmount, session);
    } catch (err) {
      await session.abortTransaction();
      if (err.code === 'INSUFFICIENT_FUNDS') return res.status(402).json({ error: `Insufficient wallet balance` });
      throw err;
    }

    const payout = await TeamPayout.create([{
      team: team._id,
      type: recipientTeamId ? 'team_payment' : 'outsource_payment',
      job: job._id,
      recipientUser: recipientUserId || null,
      recipientTeam: recipientTeamId || null,
      amount: payAmount,
      payoutType: 'flat',
      billingCreditIds: consumed,
      status: 'completed',
      executedBy: requesterId,
      executedAt: new Date(),
      note: req.body.note || '',
      createdBy: requesterId,
    }], { session });

    await session.commitTransaction();

    // Credit recipient wallet
    const recipientId = recipientUserId || null;
    if (recipientId) {
      await BillingCredit.create({
        user: recipientId,
        amount: payAmount,
        remaining: payAmount,
        type: 'outsource_payment',
        reason: `Payment from ${team.name} for "${job.title}"`,
        status: 'active',
        metadata: { teamId: team._id.toString(), jobId: job._id.toString() },
      }).catch(() => {});

      Notification.notify({
        recipient: recipientId,
        type: 'outsource_payment_received',
        title: 'Payment received',
        message: `$${payAmount.toFixed(2)} from ${team.name} for "${job.title}" added to your wallet`,
        link: `/wallet`,
      }).catch(() => {});
    }

    if (recipientTeamId) {
      await BillingCredit.create({
        team: recipientTeamId,
        amount: payAmount,
        remaining: payAmount,
        type: 'team_payment',
        reason: `Payment from ${team.name} for "${job.title}"`,
        status: 'active',
        metadata: { fromTeamId: team._id.toString(), jobId: job._id.toString() },
      }).catch(() => {});
    }

    res.json({ message: 'Payment sent', amount: payAmount, payoutId: payout[0]._id });
  } catch (err) {
    await session.abortTransaction();
    console.error('Outsource pay error:', err.message);
    res.status(500).json({ error: 'Payment failed' });
  } finally {
    session.endSession();
  }
});

// ════════════════════════════════════════════════════════════════
// TEAM-TO-TEAM — teams submit proposals on jobs
// ════════════════════════════════════════════════════════════════

// POST /api/teams/:id/proposals — team submits a proposal on a job
router.post('/:id/proposals', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (!team.isPublic) return res.status(403).json({ error: 'Team must be public to submit proposals' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'create_jobs' });
    if (!authz.ok) return res.status(403).json({ error: 'No permission to submit proposals for this team' });

    const { jobId, coverLetter, proposedBudget, proposedDuration } = req.body;
    if (!jobId || !coverLetter || !proposedBudget || !proposedDuration) {
      return res.status(400).json({ error: 'jobId, coverLetter, proposedBudget, and proposedDuration required' });
    }

    const job = await Job.findById(jobId);
    if (!job || job.status !== 'open') return res.status(404).json({ error: 'Job not found or not open' });

    // Prevent duplicate proposal from same team
    const duplicate = job.proposals?.find(p => p.team && String(p.team) === String(team._id));
    if (duplicate) return res.status(409).json({ error: 'This team has already submitted a proposal for this job' });

    const proposal = {
      freelancer: requesterId,  // owner/admin is the point of contact
      team: team._id,
      coverLetter,
      proposedBudget: parseFloat(proposedBudget),
      proposedDuration,
      status: 'pending',
      submittedAt: new Date(),
    };

    job.proposals.push(proposal);
    await job.save();

    const saved = job.proposals[job.proposals.length - 1];
    res.status(201).json({ proposal: { _id: saved._id, team: team._id, job: jobId, status: saved.status } });
  } catch (err) {
    console.error('Team proposal error:', err.message);
    res.status(500).json({ error: 'Failed to submit proposal' });
  }
});

// GET /api/teams/:id/proposals — list all proposals submitted by this team
router.get('/:id/proposals', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'create_jobs' });
    if (!authz.ok) return res.status(403).json({ error: 'No permission' });

    // Find all jobs that have a proposal from this team
    const jobs = await Job.find({ 'proposals.team': team._id })
      .select('title status budget proposals')
      .lean();

    const proposals = jobs.flatMap(j =>
      (j.proposals || [])
        .filter(p => String(p.team) === String(team._id))
        .map(p => ({ ...p, job: { _id: j._id, title: j.title, status: j.status, budget: j.budget } }))
    );

    res.json({ proposals });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load proposals' });
  }
});

// GET /api/teams/:id/wallet — wallet balance + pending payouts summary
router.get('/:id/wallet', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const authz = authorizeTeamAction({ team, requesterId, action: 'view_wallet' });
    if (!authz.ok) return res.status(403).json({ error: 'No wallet access' });

    const [credits, pendingTasks, pendingPayouts] = await Promise.all([
      BillingCredit.find({
        team: team._id, status: 'active', remaining: { $gt: 0 },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      }).lean(),
      TeamTask.find({ team: team._id, payoutStatus: { $in: ['requested', 'approved'] } })
        .populate('assignedTo', 'firstName lastName avatar')
        .lean(),
      TeamPayout.find({ team: team._id, status: 'completed' })
        .sort({ createdAt: -1 }).limit(10)
        .populate('recipientUser', 'firstName lastName avatar')
        .lean(),
    ]);

    const balance = Math.round(credits.reduce((s, c) => s + (c.remaining || 0), 0) * 100) / 100;
    const reserved = pendingTasks.reduce((s, t) => {
      const amt = t.payoutType === 'per_job'
        ? (t.payoutAmount || 0)
        : (t.hoursApproved ?? t.hoursLogged ?? 0) * (t.hourlyRate || 0);
      return s + amt;
    }, 0);

    res.json({
      balance,
      available: Math.round((balance - reserved) * 100) / 100,
      reserved: Math.round(reserved * 100) / 100,
      pendingTasks,
      recentPayouts: pendingPayouts,
      outsourcingEnabled: team.outsourcingEnabled,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load wallet' });
  }
});

module.exports = router;
