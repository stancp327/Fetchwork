const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const AgencyRelationship = require('../models/AgencyRelationship');
const Team = require('../models/Team');
const Notification = require('../models/Notification');

router.use(authenticateToken);

// GET /api/agency-relationships — list my relationships (as client or agency member)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find teams where user is active member
    const myTeams = await Team.find({
      members: { $elemMatch: { user: userId, status: 'active' } },
      type: 'agency',
    }).select('_id').lean();
    const myTeamIds = myTeams.map(t => t._id);

    const relationships = await AgencyRelationship.find({
      $or: [
        { client: userId },
        { agency: { $in: myTeamIds } },
      ],
    })
      .populate('client', 'firstName lastName profilePicture email')
      .populate('agency', 'name slug logo description type')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ relationships });
  } catch (err) {
    console.error('List agency relationships error:', err);
    res.status(500).json({ error: 'Failed to load relationships' });
  }
});

// POST /api/agency-relationships — invite agency to relationship
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { agencyId, relationshipType, retainerTerms } = req.body;

    if (!agencyId) return res.status(400).json({ error: 'agencyId is required' });

    const agency = await Team.findById(agencyId);
    if (!agency || agency.type !== 'agency') {
      return res.status(404).json({ error: 'Agency not found' });
    }

    // Prevent duplicate
    const existing = await AgencyRelationship.findOne({ client: userId, agency: agencyId });
    if (existing) {
      return res.status(409).json({ error: 'Relationship already exists', relationship: existing });
    }

    const relationship = await AgencyRelationship.create({
      client: userId,
      agency: agencyId,
      relationshipType: relationshipType || 'preferred',
      retainerTerms: relationshipType === 'retainer' ? retainerTerms : undefined,
      initiatedBy: 'client',
      status: 'pending',
    });

    // Notify team owner
    const ownerId = agency.owner;
    await Notification.notify({
      recipient: ownerId,
      type: 'agency_relationship_invite',
      title: 'New agency relationship invite',
      message: `A client wants to add your agency "${agency.name}" as a ${relationshipType || 'preferred'} partner.`,
      link: `/teams/${agency._id}/clients`,
    });

    const populated = await AgencyRelationship.findById(relationship._id)
      .populate('client', 'firstName lastName profilePicture email')
      .populate('agency', 'name slug logo description type');

    res.status(201).json({ relationship: populated });
  } catch (err) {
    console.error('Create agency relationship error:', err);
    res.status(500).json({ error: 'Failed to create relationship' });
  }
});

// PUT /api/agency-relationships/:id — update terms or status
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const relationship = await AgencyRelationship.findById(req.params.id);
    if (!relationship) return res.status(404).json({ error: 'Relationship not found' });

    // Only client or agency owner/admin can update
    const agency = await Team.findById(relationship.agency);
    const isClient = relationship.client.toString() === userId;
    const isAgencyAdmin = agency && agency.isOwnerOrAdmin(userId);

    if (!isClient && !isAgencyAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { relationshipType, retainerTerms, notes, status } = req.body;
    if (relationshipType) relationship.relationshipType = relationshipType;
    if (retainerTerms) relationship.retainerTerms = retainerTerms;
    if (notes !== undefined && isClient) relationship.notes = notes;
    if (status && ['active', 'paused', 'ended'].includes(status)) {
      relationship.status = status;
    }

    await relationship.save();

    const populated = await AgencyRelationship.findById(relationship._id)
      .populate('client', 'firstName lastName profilePicture email')
      .populate('agency', 'name slug logo description type');

    res.json({ relationship: populated });
  } catch (err) {
    console.error('Update agency relationship error:', err);
    res.status(500).json({ error: 'Failed to update relationship' });
  }
});

// POST /api/agency-relationships/:id/accept — agency accepts
router.post('/:id/accept', async (req, res) => {
  try {
    const userId = req.user.userId;
    const relationship = await AgencyRelationship.findById(req.params.id);
    if (!relationship) return res.status(404).json({ error: 'Relationship not found' });
    if (relationship.status !== 'pending') {
      return res.status(400).json({ error: 'Relationship is not pending' });
    }

    const agency = await Team.findById(relationship.agency);
    if (!agency || !agency.isOwnerOrAdmin(userId)) {
      return res.status(403).json({ error: 'Only team owner or admin can accept' });
    }

    relationship.status = 'active';
    await relationship.save();

    // Notify client
    await Notification.notify({
      recipient: relationship.client,
      type: 'agency_relationship_accepted',
      title: 'Agency accepted your invite',
      message: `${agency.name} accepted your ${relationship.relationshipType} relationship invite.`,
      link: '/preferred-agencies',
    });

    const populated = await AgencyRelationship.findById(relationship._id)
      .populate('client', 'firstName lastName profilePicture email')
      .populate('agency', 'name slug logo description type');

    res.json({ relationship: populated });
  } catch (err) {
    console.error('Accept agency relationship error:', err);
    res.status(500).json({ error: 'Failed to accept relationship' });
  }
});

// POST /api/agency-relationships/:id/pause — pause retainer
router.post('/:id/pause', async (req, res) => {
  try {
    const userId = req.user.userId;
    const relationship = await AgencyRelationship.findById(req.params.id);
    if (!relationship) return res.status(404).json({ error: 'Relationship not found' });

    const isClient = relationship.client.toString() === userId;
    const agency = await Team.findById(relationship.agency);
    const isAgencyAdmin = agency && agency.isOwnerOrAdmin(userId);

    if (!isClient && !isAgencyAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (relationship.status !== 'active') {
      return res.status(400).json({ error: 'Can only pause active relationships' });
    }

    relationship.status = 'paused';
    await relationship.save();

    const populated = await AgencyRelationship.findById(relationship._id)
      .populate('client', 'firstName lastName profilePicture email')
      .populate('agency', 'name slug logo description type');

    res.json({ relationship: populated });
  } catch (err) {
    console.error('Pause agency relationship error:', err);
    res.status(500).json({ error: 'Failed to pause relationship' });
  }
});

// POST /api/agency-relationships/:id/end — end relationship
router.post('/:id/end', async (req, res) => {
  try {
    const userId = req.user.userId;
    const relationship = await AgencyRelationship.findById(req.params.id);
    if (!relationship) return res.status(404).json({ error: 'Relationship not found' });

    const isClient = relationship.client.toString() === userId;
    const agency = await Team.findById(relationship.agency);
    const isAgencyAdmin = agency && agency.isOwnerOrAdmin(userId);

    if (!isClient && !isAgencyAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    relationship.status = 'ended';
    await relationship.save();

    const populated = await AgencyRelationship.findById(relationship._id)
      .populate('client', 'firstName lastName profilePicture email')
      .populate('agency', 'name slug logo description type');

    res.json({ relationship: populated });
  } catch (err) {
    console.error('End agency relationship error:', err);
    res.status(500).json({ error: 'Failed to end relationship' });
  }
});

module.exports = router;
