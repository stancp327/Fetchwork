const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Team = require('../models/Team');
const User = require('../models/User');
const BillingCredit = require('../models/BillingCredit');
const emailService = require('../services/emailService');

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

    const inviteLink = `${process.env.CLIENT_URL || 'https://www.fetchwork.net'}/teams`;
    await emailService.sendEmail(
      invitee.email,
      `You're invited to join ${team.name} on FetchWork`,
      `<p>Hi ${invitee.firstName || 'there'},</p>
       <p>${req.user.email || 'A team admin'} invited you to join <strong>${team.name}</strong> as <strong>${role}</strong>.</p>
       <p>Open your Teams page to accept or decline this invite.</p>
       <div style="text-align:center; margin:24px 0;">
         <a href="${inviteLink}" style="background:#4285f4;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">View Team Invitation</a>
       </div>`,
      'Team Invitation'
    );

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

// ═══════════════════════════════════════════════════════════════
// PHASE 2: Agency Profile, Shared Billing, Work Assignment
// ═══════════════════════════════════════════════════════════════

// ── GET /api/teams/agency/:slug — public agency profile ──
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
      Review.find({ reviewee: { $in: memberIds } }).sort({ createdAt: -1 }).limit(10)
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

// ── POST /api/teams/:id/portfolio — add portfolio item (agency only) ──
router.post('/:id/portfolio', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (team.type !== 'agency') return res.status(400).json({ error: 'Only agencies have portfolios' });
    if (!team.hasPermission(req.user.userId, 'manage_services')) return res.status(403).json({ error: 'No permission' });

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

// ── DELETE /api/teams/:id/portfolio/:itemId — remove portfolio item ──
router.delete('/:id/portfolio/:itemId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (!team.hasPermission(req.user.userId, 'manage_services')) return res.status(403).json({ error: 'No permission' });

    team.portfolio = team.portfolio.filter(p => p._id.toString() !== req.params.itemId);
    await team.save();
    res.json({ message: 'Portfolio item removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove portfolio item' });
  }
});

// ── Shared Billing: team wallet top-up ──
router.post('/:id/billing/add-funds', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (!team.hasPermission(req.user.userId, 'manage_billing')) return res.status(403).json({ error: 'No billing permission' });

    const amount = parseFloat(req.body.amount);
    if (!amount || amount < 5 || amount > 500) return res.status(400).json({ error: 'Amount must be $5–$500' });

    const BillingCredit = require('../models/BillingCredit');
    const stripeService = require('../services/stripeService');

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
      line_items: [{ price_data: { currency: 'usd', unit_amount: Math.round(amount * 100), product_data: { name: `${team.name} — Wallet Top-Up` } }, quantity: 1 }],
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

// ── GET /api/teams/:id/billing — team wallet balance + history ──
router.get('/:id/billing', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (!team.hasPermission(req.user.userId, 'manage_billing') && !team.hasPermission(req.user.userId, 'view_analytics')) {
      return res.status(403).json({ error: 'No permission' });
    }

    const BillingCredit = require('../models/BillingCredit');
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

// ── Work Assignment: POST /api/teams/:id/assign ──
router.post('/:id/assign', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (!team.hasPermission(req.user.userId, 'assign_work')) return res.status(403).json({ error: 'No permission to assign work' });

    const { memberId, jobId, serviceOrderId, note } = req.body;
    if (!memberId) return res.status(400).json({ error: 'memberId required' });
    if (!jobId && !serviceOrderId) return res.status(400).json({ error: 'jobId or serviceOrderId required' });

    const member = team.getMember(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found in team' });

    // Assign job
    if (jobId) {
      const Job = require('../models/Job');
      const job = await Job.findById(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

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

// ── GET /api/teams/:id/assignments — view team work assignments ──
router.get('/:id/assignments', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    if (!team.isMember(req.user.userId)) return res.status(403).json({ error: 'Not a team member' });

    const memberIds = team.members.filter(m => m.status === 'active').map(m => m.user);
    const Job = require('../models/Job');

    const jobs = await Job.find({
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

// ── GET /api/teams/:id/activity — combined team activity feed ──
router.get('/:id/activity', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('members.user', 'firstName lastName')
      .lean();

    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });
    const isMember = (team.members || []).some(m => String(m.user?._id || m.user) === String(req.user.userId) && m.status === 'active');
    if (!isMember) return res.status(403).json({ error: 'Not a team member' });

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

// ── Approval Workflow ────────────────────────────────────────────

// GET /api/teams/:id/pending-approvals — list orders needing approval
router.get('/:id/pending-approvals', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const member = team.getMember(req.user.userId);
    if (!member) return res.status(403).json({ error: 'Not a team member' });
    if (!member.permissions.includes('approve_orders') && member.role !== 'owner' && member.role !== 'admin') {
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

// POST /api/teams/:id/approve/:jobId — approve or reject a pending order
router.post('/:id/approve/:jobId', async (req, res) => {
  try {
    const { action, note } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approve or reject' });
    }

    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) return res.status(404).json({ error: 'Team not found' });

    const member = team.getMember(req.user.userId);
    if (!member) return res.status(403).json({ error: 'Not a team member' });
    if (!member.permissions.includes('approve_orders') && member.role !== 'owner' && member.role !== 'admin') {
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
