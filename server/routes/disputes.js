const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticateToken, authenticateAdmin, requirePermission } = require('../middleware/auth');

// Rate limiter for dispute messages — 20 per 15 min per user
const disputeMessageLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: { error: 'Too many messages. Please wait before sending more.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for filing disputes — 5 per hour
const disputeFileLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 50,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: { error: 'Too many dispute filings. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
const Dispute = require('../models/Dispute');
const AuditLog = require('../models/AuditLog');
const Job = require('../models/Job');
const User = require('../models/User');
const Notification = require('../models/Notification');

// ── Helper: send notification + email ───────────────────────────
const notifyUser = async (recipientId, type, title, message, link, refs = {}) => {
  try {
    await Notification.notify({
      recipient: recipientId,
      type, title, message, link,
      relatedDispute: refs.disputeId,
      relatedJob: refs.jobId
    });
  } catch (e) {
    console.warn('In-app notification failed:', e.message);
  }
};

const sendDisputeEmail = async (action, ...args) => {
  try {
    const emailService = require('../services/emailService');
    if (emailService[action]) await emailService[action](...args);
  } catch (e) {
    console.warn(`Dispute email (${action}) failed:`, e.message);
  }
};

const STATUS_LABELS = {
  opened: 'Open', needs_info: 'More Info Needed', under_review: 'Under Review',
  escalated: 'Escalated', proposed_resolution: 'Resolution Proposed',
  resolved: 'Resolved', closed: 'Closed'
};

// ── Helper: get actor role for a dispute ────────────────────────
const getRole = (dispute, userId) => {
  const clientId = (dispute.client?._id || dispute.client)?.toString();
  const freelancerId = (dispute.freelancer?._id || dispute.freelancer)?.toString();
  if (clientId === userId) return 'client';
  if (freelancerId === userId) return 'freelancer';
  return null;
};

// ══════════════════════════════════════════════════════════════════
// USER ROUTES
// ══════════════════════════════════════════════════════════════════

// ── File a Dispute ──────────────────────────────────────────────
router.post('/', authenticateToken, disputeFileLimit, async (req, res) => {
  try {
    const { jobId, milestoneId, reason, description } = req.body;

    // Validate required fields
    if (!jobId) return res.status(400).json({ error: 'Job ID is required' });
    if (!reason) return res.status(400).json({ error: 'Reason is required' });
    if (!description || description.trim().length < 20) {
      return res.status(400).json({ error: 'Description must be at least 20 characters' });
    }
    if (description.length > 2000) {
      return res.status(400).json({ error: 'Description cannot exceed 2000 characters' });
    }

    const validReasons = ['non_delivery', 'quality_issues', 'missed_deadline', 'payment_fraud', 'scope_creep', 'abusive_communication', 'other'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid dispute reason' });
    }

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = req.user.userId;
    if (job.client.toString() !== userId && job.freelancer?.toString() !== userId) {
      return res.status(403).json({ error: 'You are not authorized to dispute this job' });
    }

    // Prevent duplicate active disputes per job (or milestone)
    const dupQuery = {
      job: jobId,
      status: { $nin: ['resolved', 'closed'] }
    };
    if (milestoneId) dupQuery.milestone = milestoneId;
    const existing = await Dispute.findOne(dupQuery);
    if (existing) {
      return res.status(400).json({ error: 'An active dispute already exists for this job' });
    }

    const filedByRole = job.client.toString() === userId ? 'client' : 'freelancer';

    const dispute = new Dispute({
      job: jobId,
      milestone: milestoneId || null,
      client: job.client,
      freelancer: job.freelancer,
      filedBy: userId,
      reason,
      description,
      status: 'opened',
      payoutHold: true,
      escrowAmount: job.budget?.amount || 0,
      messages: [{
        sender: userId,
        senderRole: filedByRole,
        visibility: 'all',
        message: description
      }]
    });

    await dispute.save();

    // Update job status
    await Job.updateOne({ _id: jobId }, {
      $set: { status: 'disputed', disputeStatus: 'pending', disputeReason: reason }
    });

    // Audit log
    await AuditLog.log({
      dispute: dispute._id,
      actor: userId,
      actorRole: filedByRole,
      action: 'dispute_opened',
      metadata: { reason, notes: description },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Notify other party (in-app + email)
    const otherPartyId = job.client.toString() === userId ? job.freelancer : job.client;
    const otherParty = await User.findById(otherPartyId);
    const filer = await User.findById(userId);
    
    await notifyUser(otherPartyId, 'dispute_opened',
      'Dispute Filed',
      `${filer.firstName} ${filer.lastName} filed a dispute for "${job.title}"`,
      `/disputes`,
      { disputeId: dispute._id, jobId: job._id }
    );

    if (otherParty && filer) {
      await sendDisputeEmail('sendDisputeNotification', otherParty, filer, dispute, job);
    }

    res.status(201).json({ message: 'Dispute filed successfully', dispute });
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

    // Strip admin-only data
    const sanitized = disputes.map(d => {
      const obj = d.toObject();
      obj.adminNotes = undefined;
      obj.messages = obj.messages.filter(m => {
        if (m.isInternal) return false;
        if (m.visibility === 'admin_only') return false;
        if (m.visibility === 'client_only' && (d.client?._id || d.client)?.toString() !== req.user.userId) return false;
        if (m.visibility === 'freelancer_only' && (d.freelancer?._id || d.freelancer)?.toString() !== req.user.userId) return false;
        return true;
      });
      // Strip original URLs from evidence — users only see watermarked
      obj.evidence = (obj.evidence || []).map(e => ({
        ...e,
        originalUrl: undefined
      }));
      obj.financialActions = undefined;
      return obj;
    });

    res.json({ disputes: sanitized });
  } catch (error) {
    console.error('Error fetching user disputes:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// ── User: Upload Evidence ───────────────────────────────────────
router.post('/:id/evidence', authenticateToken, async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    const userId = req.user.userId;
    const role = getRole(dispute, userId);
    if (!role) return res.status(403).json({ error: 'Not authorized' });

    if (['resolved', 'closed'].includes(dispute.status)) {
      return res.status(400).json({ error: 'Cannot upload evidence to a resolved/closed dispute' });
    }

    const { filename, url, mimeType, size, description, isFinalDeliverable } = req.body;

    // TODO: Phase 3 — watermark the file here
    // For now, store as-is with watermarked = false
    const evidence = {
      uploadedBy: userId,
      uploaderRole: role,
      filename,
      originalUrl: url,
      watermarkedUrl: url,  // Same until watermarking is implemented
      mimeType,
      size,
      watermarked: false,
      isFinalDeliverable: isFinalDeliverable || false,
      description
    };

    dispute.evidence.push(evidence);
    dispute.lastActivityAt = new Date();
    await dispute.save();

    await AuditLog.log({
      dispute: dispute._id,
      actor: userId,
      actorRole: role,
      action: 'evidence_uploaded',
      metadata: { filename, fileId: dispute.evidence[dispute.evidence.length - 1]._id },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ message: 'Evidence uploaded', evidence: dispute.evidence[dispute.evidence.length - 1] });
  } catch (error) {
    console.error('Error uploading evidence:', error);
    res.status(500).json({ error: 'Failed to upload evidence' });
  }
});

// ── User: Add Message ───────────────────────────────────────────
router.post('/:id/messages', authenticateToken, disputeMessageLimit, async (req, res) => {
  try {
    const { message, attachments } = req.body;
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    const userId = req.user.userId;
    const role = getRole(dispute, userId);
    const isAdmin = req.user.isAdmin || req.user.role === 'admin';

    if (!role && !isAdmin) return res.status(403).json({ error: 'Not authorized' });

    if (['resolved', 'closed'].includes(dispute.status) && !isAdmin) {
      return res.status(400).json({ error: 'Cannot message on a resolved/closed dispute' });
    }

    const senderRole = role || 'admin';

    dispute.messages.push({
      sender: userId,
      senderRole,
      visibility: 'all',
      message,
      attachments: attachments || [],
      isInternal: false
    });

    // If awaiting response and the other party responds, move to under_review
    if (dispute.status === 'needs_info') {
      dispute.status = 'under_review';
      dispute.lastActivityAt = new Date();
    }

    dispute.lastActivityAt = new Date();
    await dispute.save();

    await AuditLog.log({
      dispute: dispute._id,
      actor: userId,
      actorRole: senderRole,
      action: 'message_sent',
      metadata: { recipientType: 'all', messageId: dispute.messages[dispute.messages.length - 1]._id },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    const populated = await Dispute.findById(dispute._id)
      .populate('messages.sender', 'firstName lastName profilePicture');
    const newMessage = populated.messages[populated.messages.length - 1];

    res.status(201).json({ message: newMessage });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// ── User: Escalate Dispute ──────────────────────────────────────
router.post('/:id/escalate', authenticateToken, async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    const userId = req.user.userId;
    const role = getRole(dispute, userId);
    if (!role) return res.status(403).json({ error: 'Not authorized' });

    if (!dispute.canTransitionTo('escalated')) {
      return res.status(400).json({ error: `Cannot escalate from status: ${dispute.status}` });
    }

    const prevStatus = dispute.status;
    dispute.transitionTo('escalated');
    dispute.messages.push({
      sender: userId,
      senderRole: role,
      visibility: 'all',
      message: 'Dispute has been escalated for priority admin review.'
    });

    await dispute.save();

    await AuditLog.log({
      dispute: dispute._id,
      actor: userId,
      actorRole: role,
      action: 'dispute_escalated',
      metadata: { fromStatus: prevStatus, toStatus: 'escalated' },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: 'Dispute escalated successfully', dispute });
  } catch (error) {
    console.error('Error escalating dispute:', error);
    res.status(500).json({ error: 'Failed to escalate dispute' });
  }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN ROUTES — must come BEFORE /:id
// ══════════════════════════════════════════════════════════════════

// ── Admin: List All Disputes ────────────────────────────────────
router.get('/admin/all', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, reason, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    let query = {};
    if (status && status !== 'all') query.status = status;
    if (reason && reason !== 'all') query.reason = reason;
    if (search) {
      // Search by job title or party email — requires populate, so use aggregation
      // For now, simple text search on description
      query.description = { $regex: search, $options: 'i' };
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const disputes = await Dispute.find(query)
      .populate('job', 'title budget status')
      .populate('client freelancer filedBy', 'firstName lastName email')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Dispute.countDocuments(query);

    res.json({
      disputes,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching admin disputes:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// Backward compat
router.get('/admin', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  req.query.page = req.query.page || 1;
  req.query.limit = req.query.limit || 20;
  // Forward to /admin/all handler
  const { page = 1, limit = 20, status } = req.query;
  try {
    let query = {};
    if (status && status !== 'all') query.status = status;

    const disputes = await Dispute.find(query)
      .populate('job', 'title budget status')
      .populate('client freelancer filedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Dispute.countDocuments(query);

    res.json({
      disputes,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching admin disputes:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// ── Admin: Get Dispute Detail ───────────────────────────────────
router.get('/admin/:id', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate('job', 'title budget status category description client freelancer')
      .populate('client freelancer filedBy', 'firstName lastName email profilePicture')
      .populate('resolution.resolvedBy', 'firstName lastName email')
      .populate('messages.sender', 'firstName lastName profilePicture')
      .populate('evidence.uploadedBy', 'firstName lastName')
      .populate('adminNotes.author', 'firstName lastName')
      .populate('financialActions.actor', 'firstName lastName');

    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    // Get audit log
    const auditLog = await AuditLog.find({ dispute: dispute._id })
      .populate('actor', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ dispute, auditLog });
  } catch (error) {
    console.error('Error fetching admin dispute detail:', error);
    res.status(500).json({ error: 'Failed to fetch dispute detail' });
  }
});

// ── Admin: Change Status ────────────────────────────────────────
router.patch('/admin/:id/status', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const { status, reason } = req.body;
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    const prevStatus = dispute.status;
    if (!dispute.canTransitionTo(status)) {
      return res.status(400).json({
        error: `Invalid transition: ${dispute.status} → ${status}`,
        allowedTransitions: Dispute.VALID_TRANSITIONS[dispute.status]
      });
    }

    dispute.transitionTo(status);
    await dispute.save();

    await AuditLog.log({
      dispute: dispute._id,
      actor: req.admin._id,
      actorRole: 'admin',
      action: 'status_change',
      metadata: { fromStatus: prevStatus, toStatus: status, reason },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Notify both parties of status change
    const job = await Job.findById(dispute.job);
    const client = await User.findById(dispute.client);
    const freelancer = await User.findById(dispute.freelancer);
    const jobTitle = job?.title || 'your job';
    const statusLabel = STATUS_LABELS[status] || status;

    for (const party of [dispute.client, dispute.freelancer]) {
      await notifyUser(party, 'dispute_status_changed',
        `Dispute Update: ${statusLabel}`,
        `Your dispute for "${jobTitle}" is now ${statusLabel}`,
        `/disputes`,
        { disputeId: dispute._id, jobId: dispute.job }
      );
    }
    
    if (client) await sendDisputeEmail('sendDisputeStatusChange', client, dispute, prevStatus, status, job);
    if (freelancer) await sendDisputeEmail('sendDisputeStatusChange', freelancer, dispute, prevStatus, status, job);

    res.json({ message: `Status changed: ${prevStatus} → ${status}`, dispute });
  } catch (error) {
    console.error('Error changing dispute status:', error);
    res.status(500).json({ error: 'Failed to change status' });
  }
});

// ── Admin: Send Message to Party ────────────────────────────────
router.post('/admin/:id/message', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const { message, visibility, isInternal } = req.body;
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    dispute.messages.push({
      sender: req.admin._id,
      senderRole: 'admin',
      visibility: visibility || 'all',  // all, client_only, freelancer_only, admin_only
      message,
      isInternal: isInternal || false
    });
    dispute.lastActivityAt = new Date();
    await dispute.save();

    // Determine audit action based on visibility
    let auditAction = 'message_sent_to_both';
    if (visibility === 'client_only') auditAction = 'message_sent_to_client';
    else if (visibility === 'freelancer_only') auditAction = 'message_sent_to_freelancer';
    else if (isInternal || visibility === 'admin_only') auditAction = 'message_sent';

    await AuditLog.log({
      dispute: dispute._id,
      actor: req.admin._id,
      actorRole: 'admin',
      action: auditAction,
      metadata: { recipientType: visibility || 'all', messageId: dispute.messages[dispute.messages.length - 1]._id },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ message: 'Message sent', disputeMessage: dispute.messages[dispute.messages.length - 1] });
  } catch (error) {
    console.error('Error sending admin message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ── Admin: Add Note ─────────────────────────────────────────────
router.post('/admin/:id/notes', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const { content } = req.body;
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    dispute.adminNotes.push({ author: req.admin._id, content });
    await dispute.save();

    await AuditLog.log({
      dispute: dispute._id,
      actor: req.admin._id,
      actorRole: 'admin',
      action: 'admin_note_added',
      metadata: { notes: content.substring(0, 200) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ message: 'Note added', note: dispute.adminNotes[dispute.adminNotes.length - 1] });
  } catch (error) {
    console.error('Error adding admin note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// ── Admin: Toggle Payout Hold ───────────────────────────────────
router.patch('/admin/:id/hold', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const { hold } = req.body;  // true or false
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    dispute.payoutHold = hold;
    dispute.lastActivityAt = new Date();
    await dispute.save();

    await AuditLog.log({
      dispute: dispute._id,
      actor: req.admin._id,
      actorRole: 'admin',
      action: hold ? 'payout_hold_enabled' : 'payout_hold_removed',
      metadata: {},
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: `Payout hold ${hold ? 'enabled' : 'removed'}`, payoutHold: dispute.payoutHold });
  } catch (error) {
    console.error('Error toggling payout hold:', error);
    res.status(500).json({ error: 'Failed to toggle hold' });
  }
});

// ── Admin: Propose Resolution ───────────────────────────────────
router.post('/admin/:id/propose-resolution', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const { resolutionType, amountToFreelancer, amountToClient, adminFee, summary } = req.body;
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    if (!dispute.canTransitionTo('proposed_resolution')) {
      return res.status(400).json({ error: `Cannot propose resolution from status: ${dispute.status}` });
    }

    const prevStatus = dispute.status;
    dispute.transitionTo('proposed_resolution');
    dispute.resolution = {
      type: resolutionType,
      amounts: {
        toFreelancer: amountToFreelancer || 0,
        toClient: amountToClient || 0,
        adminFee: adminFee || 0
      },
      summary,
      proposedAt: new Date()
    };

    // Add system message visible to all
    dispute.messages.push({
      sender: req.admin._id,
      senderRole: 'admin',
      visibility: 'all',
      message: `Resolution proposed: ${resolutionType.replace(/_/g, ' ')}. ${summary || ''}`,
      isInternal: false
    });

    await dispute.save();

    await AuditLog.log({
      dispute: dispute._id,
      actor: req.admin._id,
      actorRole: 'admin',
      action: 'resolution_proposed',
      metadata: {
        fromStatus: prevStatus,
        toStatus: 'proposed_resolution',
        resolutionType,
        amountToFreelancer,
        amountToClient,
        adminFee,
        notes: summary
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: 'Resolution proposed', dispute });
  } catch (error) {
    console.error('Error proposing resolution:', error);
    res.status(500).json({ error: 'Failed to propose resolution' });
  }
});

// ── Admin: Execute Resolution ───────────────────────────────────
router.post('/admin/:id/resolve', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const { resolutionType, amountToFreelancer, amountToClient, adminFee, summary, idempotencyKey } = req.body;
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    if (!dispute.canTransitionTo('resolved')) {
      return res.status(400).json({ error: `Cannot resolve from status: ${dispute.status}` });
    }

    // Check idempotency — prevent double resolution
    if (idempotencyKey) {
      const existingAction = dispute.financialActions.find(a => a.idempotencyKey === idempotencyKey);
      if (existingAction) {
        return res.json({ message: 'Resolution already executed (idempotent)', dispute });
      }
    }

    const prevStatus = dispute.status;
    dispute.transitionTo('resolved');
    dispute.payoutHold = false;
    dispute.resolution = {
      type: resolutionType || dispute.resolution?.type,
      amounts: {
        toFreelancer: amountToFreelancer || dispute.resolution?.amounts?.toFreelancer || 0,
        toClient: amountToClient || dispute.resolution?.amounts?.toClient || 0,
        adminFee: adminFee || dispute.resolution?.amounts?.adminFee || 0
      },
      summary: summary || dispute.resolution?.summary,
      proposedAt: dispute.resolution?.proposedAt,
      resolvedAt: new Date(),
      resolvedBy: req.admin._id
    };

    // Record financial action
    const financialAction = {
      type: resolutionType === 'refund_to_client' ? 'refund' :
            resolutionType === 'release_to_freelancer' ? 'release' :
            resolutionType === 'split' ? 'split' : 'release',
      actor: req.admin._id,
      amountToFreelancer: amountToFreelancer || 0,
      amountToClient: amountToClient || 0,
      adminFee: adminFee || 0,
      idempotencyKey: idempotencyKey || `resolve_${dispute._id}_${Date.now()}`,
      status: 'pending',  // TODO Phase 4: execute Stripe action, then mark completed
      notes: summary
    };
    dispute.financialActions.push(financialAction);

    // System message
    dispute.messages.push({
      sender: req.admin._id,
      senderRole: 'admin',
      visibility: 'all',
      message: `Dispute resolved: ${(resolutionType || 'no_action').replace(/_/g, ' ')}${amountToFreelancer ? ` — $${amountToFreelancer} to freelancer` : ''}${amountToClient ? ` — $${amountToClient} refund to client` : ''}${summary ? `\n\n${summary}` : ''}`,
      isInternal: false
    });

    await dispute.save();

    // Update job
    const job = await Job.findById(dispute.job);
    if (job) {
      await Job.updateOne({ _id: job._id }, {
        $set: {
          disputeStatus: 'resolved',
          status: resolutionType === 'refund_to_client' ? 'cancelled' : 'completed'
        }
      });
    }

    await AuditLog.log({
      dispute: dispute._id,
      actor: req.admin._id,
      actorRole: 'admin',
      action: 'resolution_executed',
      metadata: {
        fromStatus: prevStatus,
        toStatus: 'resolved',
        resolutionType,
        amountToFreelancer,
        amountToClient,
        adminFee,
        idempotencyKey: financialAction.idempotencyKey,
        notes: summary
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Notify both parties (in-app + email)
    const client = await User.findById(dispute.client);
    const freelancer = await User.findById(dispute.freelancer);
    const resLabel = (resolutionType || 'no_action').replace(/_/g, ' ');

    for (const party of [dispute.client, dispute.freelancer]) {
      await notifyUser(party, 'dispute_resolved',
        'Dispute Resolved',
        `Your dispute has been resolved: ${resLabel}`,
        `/disputes`,
        { disputeId: dispute._id, jobId: dispute.job }
      );
    }

    if (client) await sendDisputeEmail('sendDisputeResolutionNotification', client, dispute);
    if (freelancer) await sendDisputeEmail('sendDisputeResolutionNotification', freelancer, dispute);

    res.json({ message: 'Dispute resolved', dispute });
  } catch (error) {
    console.error('Error resolving dispute:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

// ── Admin: Get Audit Log ────────────────────────────────────────
router.get('/admin/:id/audit', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const auditLog = await AuditLog.find({ dispute: req.params.id })
      .populate('actor', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({ auditLog });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ── Admin: Set Response Deadline ────────────────────────────────
router.patch('/admin/:id/deadline', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const { responseDeadline, deadline } = req.body;
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    if (responseDeadline) dispute.responseDeadline = new Date(responseDeadline);
    if (deadline) dispute.deadline = new Date(deadline);
    await dispute.save();

    await AuditLog.log({
      dispute: dispute._id,
      actor: req.admin._id,
      actorRole: 'admin',
      action: responseDeadline ? 'response_deadline_set' : 'deadline_extended',
      metadata: { notes: `Deadline set: ${responseDeadline || deadline}` },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: 'Deadline updated', dispute });
  } catch (error) {
    console.error('Error updating deadline:', error);
    res.status(500).json({ error: 'Failed to update deadline' });
  }
});

// ══════════════════════════════════════════════════════════════════
// PARAMETERIZED ROUTES — must come AFTER /admin/*
// ══════════════════════════════════════════════════════════════════

// ── Get Single Dispute (for participants + admin) ───────────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate('job', 'title budget status category description')
      .populate('client freelancer filedBy', 'firstName lastName email profilePicture')
      .populate('messages.sender', 'firstName lastName profilePicture')
      .populate('evidence.uploadedBy', 'firstName lastName');

    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    const userId = req.user.userId;
    const isParticipant = getRole(dispute, userId) !== null;
    const isAdmin = req.user.isAdmin || req.user.role === 'admin';

    if (!isParticipant && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to view this dispute' });
    }

    const disputeObj = dispute.toObject();

    // Filter for non-admin users
    if (!isAdmin) {
      disputeObj.adminNotes = undefined;
      disputeObj.financialActions = undefined;
      disputeObj.messages = disputeObj.messages.filter(m => {
        if (m.isInternal) return false;
        if (m.visibility === 'admin_only') return false;
        if (m.visibility === 'client_only' && dispute.client.toString() !== userId) return false;
        if (m.visibility === 'freelancer_only' && dispute.freelancer.toString() !== userId) return false;
        return true;
      });
      disputeObj.evidence = (disputeObj.evidence || []).map(e => ({
        ...e,
        originalUrl: undefined
      }));
    }

    res.json({ dispute: disputeObj, isAdmin });
  } catch (error) {
    console.error('Error fetching dispute:', error);
    res.status(500).json({ error: 'Failed to fetch dispute' });
  }
});

module.exports = router;
