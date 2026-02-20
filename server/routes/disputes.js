const express = require('express');
const router = express.Router();
const { authenticateToken, authenticateAdmin, requirePermission } = require('../middleware/auth');
const Dispute = require('../models/Dispute');
const Job = require('../models/Job');
const User = require('../models/User');

// ── File a Dispute ──────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { jobId, reason, description, evidence } = req.body;
    
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.client.toString() !== req.user.userId && job.freelancer?.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You are not authorized to dispute this job' });
    }

    // Check for existing active dispute on this job
    const existing = await Dispute.findOne({
      job: jobId,
      status: { $in: ['open', 'under_review', 'awaiting_response', 'escalated'] }
    });
    if (existing) {
      return res.status(400).json({ error: 'An active dispute already exists for this job' });
    }
    
    const dispute = new Dispute({
      job: jobId,
      client: job.client,
      freelancer: job.freelancer,
      filedBy: req.user.userId,
      reason,
      description,
      evidence: evidence || [],
      messages: [{
        sender: req.user.userId,
        senderRole: job.client.toString() === req.user.userId ? 'client' : 'freelancer',
        message: description
      }]
    });
    
    await dispute.save();
    
    job.status = 'disputed';
    job.disputeStatus = 'pending';
    job.disputeReason = reason;
    await job.save();

    // Notify the other party via email
    try {
      const emailService = require('../services/emailService');
      const otherPartyId = job.client.toString() === req.user.userId ? job.freelancer : job.client;
      const otherParty = await User.findById(otherPartyId);
      const filer = await User.findById(req.user.userId);
      if (otherParty && emailService.sendDisputeNotification) {
        await emailService.sendDisputeNotification(otherParty, filer, dispute, job);
      }
    } catch (emailError) {
      console.warn('Could not send dispute notification email:', emailError.message);
    }
    
    res.status(201).json({
      message: 'Dispute filed successfully',
      dispute
    });
  } catch (error) {
    console.error('Error filing dispute:', error);
    res.status(500).json({ error: 'Failed to file dispute' });
  }
});

// ── Get User's Disputes ─────────────────────────────────────────
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const disputes = await Dispute.find({
      $or: [
        { client: req.user.userId },
        { freelancer: req.user.userId }
      ]
    })
    .populate('job', 'title budget status')
    .populate('client freelancer filedBy', 'firstName lastName email profilePicture')
    .sort({ createdAt: -1 });
    
    res.json({ disputes });
  } catch (error) {
    console.error('Error fetching user disputes:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// ── Get Single Dispute (for participants + admin) ───────────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate('job', 'title budget status category description')
      .populate('client freelancer filedBy resolvedBy', 'firstName lastName email profilePicture')
      .populate('messages.sender', 'firstName lastName profilePicture')
      .populate('evidence.uploadedBy', 'firstName lastName');

    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    // Authorization: must be client, freelancer, or admin
    const userId = req.user.userId;
    const isParticipant = 
      dispute.client._id.toString() === userId ||
      dispute.freelancer._id.toString() === userId;
    const isAdmin = req.user.isAdmin || req.user.role === 'admin';

    if (!isParticipant && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to view this dispute' });
    }

    // Filter out internal messages for non-admins
    const disputeObj = dispute.toObject();
    if (!isAdmin) {
      disputeObj.messages = disputeObj.messages.filter(m => !m.isInternal);
    }

    res.json({ dispute: disputeObj, isAdmin });
  } catch (error) {
    console.error('Error fetching dispute:', error);
    res.status(500).json({ error: 'Failed to fetch dispute' });
  }
});

// ── Add Message / Response ──────────────────────────────────────
router.post('/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { message, attachments, isInternal } = req.body;
    const dispute = await Dispute.findById(req.params.id);

    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const userId = req.user.userId;
    const isClient = dispute.client.toString() === userId;
    const isFreelancer = dispute.freelancer.toString() === userId;
    const isAdmin = req.user.isAdmin || req.user.role === 'admin';

    if (!isClient && !isFreelancer && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Only admins can post internal messages
    if (isInternal && !isAdmin) {
      return res.status(403).json({ error: 'Only admins can post internal notes' });
    }

    let senderRole = 'admin';
    if (isClient) senderRole = 'client';
    else if (isFreelancer) senderRole = 'freelancer';

    dispute.messages.push({
      sender: userId,
      senderRole,
      message,
      attachments: attachments || [],
      isInternal: isInternal || false
    });

    // If the other party responds, update status to under_review
    if (dispute.status === 'awaiting_response') {
      dispute.status = 'under_review';
    }

    await dispute.save();

    const populated = await Dispute.findById(dispute._id)
      .populate('messages.sender', 'firstName lastName profilePicture');

    const newMessage = populated.messages[populated.messages.length - 1];

    res.status(201).json({ message: newMessage });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// ── Admin: List All Disputes ────────────────────────────────────
router.get('/admin/all', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || 'all';
    
    let query = {};
    if (status !== 'all') {
      query.status = status;
    }
    
    const disputes = await Dispute.find(query)
      .populate('job', 'title budget')
      .populate('client freelancer filedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
    
    const total = await Dispute.countDocuments(query);
    
    res.json({
      disputes,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching admin disputes:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// Keep old admin route for backward compat
router.get('/admin', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || 'all';
    
    let query = {};
    if (status !== 'all') {
      query.status = status;
    }
    
    const disputes = await Dispute.find(query)
      .populate('job', 'title budget')
      .populate('client freelancer filedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
    
    const total = await Dispute.countDocuments(query);
    
    res.json({
      disputes,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching admin disputes:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// ── Update Dispute Status (Admin) ───────────────────────────────
router.patch('/:id/status', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const { status, resolution, resolutionAmount, resolutionSummary, adminNotes } = req.body;
    
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }
    
    dispute.status = status;
    if (resolution) dispute.resolution = resolution;
    if (resolutionAmount !== undefined) dispute.resolutionAmount = resolutionAmount;
    if (resolutionSummary) dispute.resolutionSummary = resolutionSummary;
    if (adminNotes) dispute.adminNotes = adminNotes;
    
    if (status === 'resolved') {
      dispute.resolvedBy = req.admin._id;
      dispute.resolvedAt = new Date();

      // Add resolution as a system message
      dispute.messages.push({
        sender: req.admin._id,
        senderRole: 'admin',
        message: `Dispute resolved: ${(resolution || 'no_action').replace(/_/g, ' ')}${resolutionAmount ? ` — Refund amount: $${resolutionAmount}` : ''}${resolutionSummary ? `\n\n${resolutionSummary}` : ''}`,
        isInternal: false
      });
      
      const job = await Job.findById(dispute.job);
      if (job) {
        job.disputeStatus = 'resolved';
        if (resolution === 'freelancer_favor') {
          job.status = 'in_progress';
        } else if (resolution === 'client_favor') {
          job.status = 'cancelled';
        }
        await job.save();
      }

      // Notify both parties
      try {
        const emailService = require('../services/emailService');
        const client = await User.findById(dispute.client);
        const freelancer = await User.findById(dispute.freelancer);
        if (emailService.sendDisputeResolutionNotification) {
          await Promise.all([
            emailService.sendDisputeResolutionNotification(client, dispute),
            emailService.sendDisputeResolutionNotification(freelancer, dispute)
          ]);
        }
      } catch (emailError) {
        console.warn('Could not send resolution notification:', emailError.message);
      }
    }
    
    await dispute.save();
    
    res.json({
      message: 'Dispute updated successfully',
      dispute
    });
  } catch (error) {
    console.error('Error updating dispute:', error);
    res.status(500).json({ error: 'Failed to update dispute' });
  }
});

// ── Escalate Dispute ────────────────────────────────────────────
router.post('/:id/escalate', authenticateToken, async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const userId = req.user.userId;
    if (dispute.client.toString() !== userId && dispute.freelancer.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      return res.status(400).json({ error: 'Cannot escalate a resolved or closed dispute' });
    }

    dispute.status = 'escalated';
    dispute.messages.push({
      sender: userId,
      senderRole: dispute.client.toString() === userId ? 'client' : 'freelancer',
      message: 'Dispute has been escalated for priority admin review.'
    });

    await dispute.save();

    res.json({ message: 'Dispute escalated successfully', dispute });
  } catch (error) {
    console.error('Error escalating dispute:', error);
    res.status(500).json({ error: 'Failed to escalate dispute' });
  }
});

module.exports = router;
