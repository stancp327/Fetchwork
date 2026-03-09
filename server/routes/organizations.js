const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Organization = require('../models/Organization');
const Team = require('../models/Team');

// All routes require auth
router.use(authenticateToken);

function resolveRequester(req) {
  const id = String(req.user?.userId || req.user?._id || req.user?.id || '');
  return { id };
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

async function uniqueSlug(base, excludeId) {
  let slug = base;
  let suffix = 2;
  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Organization.findOne(query);
    if (!exists) return slug;
    slug = `${base}-${suffix}`;
    suffix++;
  }
}

// ── GET /api/organizations ── list orgs user belongs to (owner OR member of a child team)
router.get('/', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);

    // Orgs the user owns
    const ownedOrgs = await Organization.find({ owner: requesterId, isActive: true }).lean();

    // Teams the user is an active member of that belong to an org
    const memberTeams = await Team.find(
      { 'members.user': requesterId, 'members.status': 'active', organization: { $ne: null }, isActive: true },
      'organization'
    ).lean();
    const memberOrgIds = [...new Set(memberTeams.map(t => String(t.organization)))];
    const ownedOrgIds = new Set(ownedOrgs.map(o => String(o._id)));
    const extraOrgIds = memberOrgIds.filter(id => !ownedOrgIds.has(id));
    const memberOrgs = extraOrgIds.length
      ? await Organization.find({ _id: { $in: extraOrgIds }, isActive: true }).lean()
      : [];

    const allOrgs = [...ownedOrgs, ...memberOrgs];

    // Attach team summaries
    const orgIds = allOrgs.map(o => o._id);
    const teams = await Team.find(
      { organization: { $in: orgIds }, isActive: true },
      'name _id organization'
    ).lean();
    const teamsByOrg = {};
    for (const t of teams) {
      const oid = String(t.organization);
      if (!teamsByOrg[oid]) teamsByOrg[oid] = [];
      teamsByOrg[oid].push({ _id: t._id, name: t.name });
    }

    const result = allOrgs.map(o => ({
      ...o,
      teams: teamsByOrg[String(o._id)] || [],
      isOwner: String(o.owner) === requesterId,
    }));

    res.json({ organizations: result });
  } catch (err) {
    console.error('List organizations error:', err.message);
    res.status(500).json({ error: 'Failed to load organizations' });
  }
});

// ── POST /api/organizations ── create org
router.post('/', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const { name, description, logo, website } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const baseSlug = generateSlug(name);
    const slug = await uniqueSlug(baseSlug);

    const org = await Organization.create({
      name: name.trim(),
      slug,
      owner: requesterId,
      description: description || '',
      logo: logo || '',
      website: website || '',
    });

    res.status(201).json({ organization: org });
  } catch (err) {
    console.error('Create organization error:', err.message);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// ── GET /api/organizations/mine ── list my orgs
router.get('/mine', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const orgs = await Organization.findByOwner(requesterId).lean();

    // Attach team summaries to each org
    const orgIds = orgs.map(o => o._id);
    const teams = await Team.find(
      { organization: { $in: orgIds }, isActive: true },
      'name _id organization'
    ).lean();

    const teamsByOrg = {};
    for (const t of teams) {
      const orgId = String(t.organization);
      if (!teamsByOrg[orgId]) teamsByOrg[orgId] = [];
      teamsByOrg[orgId].push({ _id: t._id, name: t.name });
    }

    const result = orgs.map(o => ({
      ...o,
      teams: teamsByOrg[String(o._id)] || [],
    }));

    res.json({ organizations: result });
  } catch (err) {
    console.error('List organizations error:', err.message);
    res.status(500).json({ error: 'Failed to load organizations' });
  }
});

// ── GET /api/organizations/:id ── get org detail
router.get('/:id', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const org = await Organization.findById(req.params.id);
    if (!org || !org.isActive) return res.status(404).json({ error: 'Organization not found' });
    if (String(org.owner) !== requesterId) return res.status(403).json({ error: 'Forbidden' });

    const teams = await Team.find(
      { organization: org._id, isActive: true },
      'name slug members type department inheritOrgSettings'
    ).lean();

    const teamsWithCount = teams.map(t => ({
      ...t,
      memberCount: (t.members || []).filter(m => m.status === 'active').length,
    }));

    res.json({ organization: org.toObject(), teams: teamsWithCount });
  } catch (err) {
    console.error('Get organization error:', err.message);
    res.status(500).json({ error: 'Failed to load organization' });
  }
});

// ── PUT /api/organizations/:id ── update org (owner only)
router.put('/:id', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const org = await Organization.findById(req.params.id);
    if (!org || !org.isActive) return res.status(404).json({ error: 'Organization not found' });
    if (String(org.owner) !== requesterId) return res.status(403).json({ error: 'Forbidden' });

    const { name, description, logo, website, billingEmail } = req.body;

    if (name !== undefined) {
      org.name = name.trim();
      const baseSlug = generateSlug(name);
      org.slug = await uniqueSlug(baseSlug, org._id);
    }
    if (description !== undefined) org.description = description;
    if (logo !== undefined) org.logo = logo;
    if (website !== undefined) org.website = website;
    if (billingEmail !== undefined) org.billing.billingEmail = billingEmail;

    await org.save();
    res.json({ organization: org });
  } catch (err) {
    console.error('Update organization error:', err.message);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// ── PATCH /api/organizations/:id ── update org
router.patch('/:id', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const org = await Organization.findById(req.params.id);
    if (!org || !org.isActive) return res.status(404).json({ error: 'Organization not found' });
    if (String(org.owner) !== requesterId) return res.status(403).json({ error: 'Forbidden' });

    const { name, description, logo, website } = req.body;
    const billingEmail = req.body['billing.billingEmail'] ?? req.body.billingEmail;

    if (name !== undefined) {
      org.name = name.trim();
      const baseSlug = generateSlug(name);
      org.slug = await uniqueSlug(baseSlug, org._id);
    }
    if (description !== undefined) org.description = description;
    if (logo !== undefined) org.logo = logo;
    if (website !== undefined) org.website = website;
    if (billingEmail !== undefined) org.billing.billingEmail = billingEmail;

    await org.save();
    res.json({ organization: org });
  } catch (err) {
    console.error('Update organization error:', err.message);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// ── PATCH /api/organizations/:id/settings ── update org settings
router.patch('/:id/settings', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const org = await Organization.findById(req.params.id);
    if (!org || !org.isActive) return res.status(404).json({ error: 'Organization not found' });
    if (String(org.owner) !== requesterId) return res.status(403).json({ error: 'Forbidden' });

    const { spendControls, approvalThresholds } = req.body;

    if (spendControls) {
      if (spendControls.monthlyCapEnabled !== undefined) {
        org.settings.spendControls.monthlyCapEnabled = Boolean(spendControls.monthlyCapEnabled);
      }
      if (spendControls.monthlyCap !== undefined) {
        const cap = Number(spendControls.monthlyCap);
        if (isNaN(cap) || cap < 0) return res.status(400).json({ error: 'monthlyCap must be >= 0' });
        org.settings.spendControls.monthlyCap = cap;
      }
      if (spendControls.alertThreshold !== undefined) {
        const at = Number(spendControls.alertThreshold);
        if (isNaN(at) || at < 0 || at > 1) return res.status(400).json({ error: 'alertThreshold must be 0-1' });
        org.settings.spendControls.alertThreshold = at;
      }
    }

    if (approvalThresholds) {
      if (approvalThresholds.payoutRequiresApproval !== undefined) {
        org.settings.approvalThresholds.payoutRequiresApproval = Boolean(approvalThresholds.payoutRequiresApproval);
      }
      if (approvalThresholds.payoutThresholdAmount !== undefined) {
        const amt = Number(approvalThresholds.payoutThresholdAmount);
        if (isNaN(amt) || amt < 0) return res.status(400).json({ error: 'payoutThresholdAmount must be >= 0' });
        org.settings.approvalThresholds.payoutThresholdAmount = amt;
      }
      if (approvalThresholds.requireDualControl !== undefined) {
        org.settings.approvalThresholds.requireDualControl = Boolean(approvalThresholds.requireDualControl);
      }
    }

    await org.save();
    res.json({ settings: org.settings });
  } catch (err) {
    console.error('Update org settings error:', err.message);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ── DELETE /api/organizations/:id ── soft delete org
router.delete('/:id', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const org = await Organization.findById(req.params.id);
    if (!org || !org.isActive) return res.status(404).json({ error: 'Organization not found' });
    if (String(org.owner) !== requesterId) return res.status(403).json({ error: 'Forbidden' });

    org.isActive = false;
    await org.save();

    // Unlink all teams from this org
    await Team.updateMany({ organization: org._id }, { organization: null, department: '' });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete organization error:', err.message);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// ── POST /api/organizations/:id/teams ── add team to org
router.post('/:id/teams', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const org = await Organization.findById(req.params.id);
    if (!org || !org.isActive) return res.status(404).json({ error: 'Organization not found' });
    if (String(org.owner) !== requesterId) return res.status(403).json({ error: 'Forbidden' });

    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    const team = await Team.findOne({ _id: teamId, owner: requesterId, isActive: true });
    if (!team) return res.status(404).json({ error: 'Team not found or you are not the owner' });

    team.organization = org._id;
    await team.save();

    res.json({ team: { _id: team._id, name: team.name, organization: team.organization } });
  } catch (err) {
    console.error('Add team to org error:', err.message);
    res.status(500).json({ error: 'Failed to add team to organization' });
  }
});

// ── DELETE /api/organizations/:id/teams/:teamId ── remove team from org
router.delete('/:id/teams/:teamId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const org = await Organization.findById(req.params.id);
    if (!org || !org.isActive) return res.status(404).json({ error: 'Organization not found' });
    if (String(org.owner) !== requesterId) return res.status(403).json({ error: 'Forbidden' });

    const team = await Team.findById(req.params.teamId);
    if (!team || String(team.organization) !== String(org._id)) {
      return res.status(404).json({ error: 'Team not in this organization' });
    }

    team.organization = null;
    team.department = '';
    await team.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Remove team from org error:', err.message);
    res.status(500).json({ error: 'Failed to remove team from organization' });
  }
});

// ── POST /api/organizations/:id/departments ── add department
router.post('/:id/departments', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const org = await Organization.findById(req.params.id);
    if (!org || !org.isActive) return res.status(404).json({ error: 'Organization not found' });
    if (String(org.owner) !== requesterId) return res.status(403).json({ error: 'Forbidden' });

    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Department name is required' });

    org.departments.push({ name: name.trim(), description: description || '' });
    await org.save();

    res.json({ departments: org.departments });
  } catch (err) {
    console.error('Add department error:', err.message);
    res.status(500).json({ error: 'Failed to add department' });
  }
});

// ── DELETE /api/organizations/:id/departments/:deptId ── remove department
router.delete('/:id/departments/:deptId', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const org = await Organization.findById(req.params.id);
    if (!org || !org.isActive) return res.status(404).json({ error: 'Organization not found' });
    if (String(org.owner) !== requesterId) return res.status(403).json({ error: 'Forbidden' });

    org.departments.pull({ _id: req.params.deptId });
    await org.save();

    res.json({ departments: org.departments });
  } catch (err) {
    console.error('Remove department error:', err.message);
    res.status(500).json({ error: 'Failed to remove department' });
  }
});

// ── GET /api/organizations/:id/teams ── list teams in org
router.get('/:id/teams', async (req, res) => {
  try {
    const { id: requesterId } = resolveRequester(req);
    const org = await Organization.findById(req.params.id);
    if (!org || !org.isActive) return res.status(404).json({ error: 'Organization not found' });
    if (String(org.owner) !== requesterId) return res.status(403).json({ error: 'Forbidden' });

    const teams = await Team.find(
      { organization: org._id, isActive: true },
      'name type department inheritOrgSettings members'
    ).lean();

    const result = teams.map(t => ({
      _id: t._id,
      name: t.name,
      type: t.type,
      department: t.department,
      inheritOrgSettings: t.inheritOrgSettings,
      memberCount: (t.members || []).filter(m => m.status === 'active').length,
    }));

    res.json({ teams: result });
  } catch (err) {
    console.error('List org teams error:', err.message);
    res.status(500).json({ error: 'Failed to load teams' });
  }
});

module.exports = router;
