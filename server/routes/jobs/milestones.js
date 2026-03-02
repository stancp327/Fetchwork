const express = require('express');
const router = express.Router({ mergeParams: true });
const Job = require('../../models/Job');
const { Message, Conversation } = require('../../models/Message');
const { authenticateToken } = require('../../middleware/auth');
const { validateMongoId } = require('../../middleware/validation');
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const stripeService = require('../../services/stripeService');
const Payment = require('../../models/Payment');

// ── Milestone Change Requests ──────────────────────────────────

// POST /milestones/request — client proposes milestone changes
router.post('/milestones/request', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('client',     'firstName lastName')
      .populate('freelancer', 'firstName lastName');
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = (req.user._id || req.user.userId)?.toString();
    if (job.client._id.toString() !== userId) {
      return res.status(403).json({ error: 'Only the client can propose milestone changes' });
    }
    if (job.status !== 'in_progress') {
      return res.status(400).json({ error: 'Job must be in progress' });
    }

    const { proposedMilestones, note } = req.body;
    if (!Array.isArray(proposedMilestones) || proposedMilestones.length === 0) {
      return res.status(400).json({ error: 'At least one milestone is required' });
    }

    const conversation = await Conversation.findOne({ job: job._id });
    if (!conversation) return res.status(404).json({ error: 'No conversation found for this job' });

    const clientName = `${job.client.firstName} ${job.client.lastName}`.trim();
    const totalAmount = proposedMilestones.reduce((s, m) => s + (Number(m.amount) || 0), 0);

    const sysMsg = new Message({
      conversation: conversation._id,
      sender:    job.client._id,
      recipient: job.freelancer._id,
      content:   `📋 ${clientName} is proposing a milestone update for "${job.title}"\n${note ? `\nNote: ${note}` : ''}\n\n${proposedMilestones.map((m, i) => `${i + 1}. ${m.title} — $${m.amount}`).join('\n')}`,
      messageType: 'system',
      metadata: {
        type: 'milestone_change_request',
        jobId:   job._id,
        jobTitle: job.title,
        proposedMilestones,
        totalAmount,
        requestedBy: job.client._id,
        clientName,
        note: note || '',
        status: 'pending',
      }
    });
    await sysMsg.save();
    conversation.lastMessage = sysMsg._id;
    await conversation.updateLastActivity();

    await Notification.create({
      recipient:  job.freelancer._id,
      type:       'job_update',
      title:      'Milestone update proposed',
      message:    `${clientName} has proposed new milestones for "${job.title}". Review and accept or decline in Messages.`,
      relatedJob: job._id,
      link:  '/messages',
    });

    res.json({ message: 'Milestone change request sent', messageId: sysMsg._id });
  } catch (err) {
    console.error('Error proposing milestones:', err);
    res.status(500).json({ error: 'Failed to send milestone request' });
  }
});

// POST /milestones/request/accept — freelancer accepts
router.post('/milestones/request/accept', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'messageId required' });

    const job = await Job.findById(req.params.id).populate('client', 'firstName lastName');
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = (req.user._id || req.user.userId)?.toString();
    if (job.freelancer.toString() !== userId) {
      return res.status(403).json({ error: 'Only the freelancer can accept milestone changes' });
    }

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: 'Request not found' });
    if (msg.metadata?.status !== 'pending') {
      return res.status(400).json({ error: 'This request has already been actioned' });
    }

    const proposed = msg.metadata.proposedMilestones || [];
    const kept = (job.milestones || []).filter(m =>
      m.status === 'completed' || m.status === 'approved' || (m.escrowAmount || 0) > 0
    );
    job.milestones = [
      ...kept,
      ...proposed.map(m => ({
        title: m.title, description: m.description || '', amount: Number(m.amount) || 0,
        dueDate: m.dueDate ? new Date(m.dueDate) : undefined, status: 'pending',
      }))
    ];
    await job.save();

    msg.metadata = { ...msg.metadata, status: 'accepted' };
    msg.markModified('metadata');
    await msg.save();

    const freelancerUser = await User.findById(req.user.userId || req.user._id).select('firstName lastName');
    const freelancerName = freelancerUser ? `${freelancerUser.firstName} ${freelancerUser.lastName}`.trim() : 'Freelancer';
    await Notification.create({
      recipient: job.client._id, type: 'job_update', title: 'Milestone changes accepted',
      message: `${freelancerName} accepted your proposed milestones for "${job.title}".`,
      relatedJob: job._id, link: '/projects?view=client',
    });

    res.json({ message: 'Milestones updated', milestones: job.milestones });
  } catch (err) {
    console.error('Error accepting milestones:', err);
    res.status(500).json({ error: 'Failed to accept milestone changes' });
  }
});

// POST /milestones/request/decline — freelancer declines
router.post('/milestones/request/decline', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const { messageId, reason } = req.body;
    if (!messageId) return res.status(400).json({ error: 'messageId required' });

    const job = await Job.findById(req.params.id).populate('client', 'firstName lastName');
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = (req.user._id || req.user.userId)?.toString();
    if (job.freelancer.toString() !== userId) {
      return res.status(403).json({ error: 'Only the freelancer can decline milestone changes' });
    }

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: 'Request not found' });
    if (msg.metadata?.status !== 'pending') {
      return res.status(400).json({ error: 'This request has already been actioned' });
    }

    msg.metadata = { ...msg.metadata, status: 'declined', declineReason: reason || '' };
    msg.markModified('metadata');
    await msg.save();

    const freelancerUser2 = await User.findById(req.user.userId || req.user._id).select('firstName lastName');
    const freelancerName = freelancerUser2 ? `${freelancerUser2.firstName} ${freelancerUser2.lastName}`.trim() : 'Freelancer';
    await Notification.create({
      recipient: job.client._id, type: 'job_update', title: 'Milestone changes declined',
      message: `${freelancerName} declined your proposed milestones for "${job.title}".${reason ? ` Reason: ${reason}` : ''}`,
      relatedJob: job._id, link: '/messages',
    });

    res.json({ message: 'Milestone request declined' });
  } catch (err) {
    console.error('Error declining milestones:', err);
    res.status(500).json({ error: 'Failed to decline milestone request' });
  }
});

// ── Milestone Payments ──────────────────────────────────────────

// POST /milestones/:index/fund
router.post('/milestones/:index/fund', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('freelancer', '_id firstName lastName');
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.client) !== String(req.user._id)) return res.status(403).json({ error: 'Only the client can fund milestones' });

    const idx = parseInt(req.params.index);
    if (isNaN(idx) || idx < 0 || idx >= job.milestones.length) return res.status(404).json({ error: 'Milestone not found' });
    const milestone = job.milestones[idx];
    if (milestone.escrowAmount > 0) return res.status(400).json({ error: 'Already funded' });
    if (milestone.status === 'approved') return res.status(400).json({ error: 'Already completed and paid' });

    const paymentIntent = await stripeService.chargeForJob(milestone.amount, 'usd', {
      jobId: String(job._id), milestoneIndex: String(idx), milestoneTitle: milestone.title,
      clientId: String(req.user._id), freelancerId: String(job.freelancer._id), type: 'milestone',
    });

    res.json({
      clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id,
      milestoneIndex: idx, milestoneTitle: milestone.title, amount: milestone.amount,
    });
  } catch (error) {
    console.error('Error funding milestone:', error);
    res.status(500).json({ error: 'Failed to fund milestone' });
  }
});

// POST /milestones/:index/fund/confirm
router.post('/milestones/:index/fund/confirm', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId required' });

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.client) !== String(req.user._id)) return res.status(403).json({ error: 'Unauthorized' });

    const idx = parseInt(req.params.index);
    const milestone = job.milestones[idx];
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    milestone.stripePaymentIntentId = paymentIntentId;
    milestone.escrowAmount = milestone.amount;
    milestone.fundedAt = new Date();
    await job.save();

    await Payment.create({
      job: job._id, client: req.user._id, freelancer: job.freelancer,
      amount: milestone.amount, type: 'escrow', status: 'processing',
      paymentMethod: 'stripe', stripePaymentIntentId: paymentIntentId,
      transactionId: paymentIntentId, platformFee: Math.round(milestone.amount * 0.10 * 100) / 100,
    });

    await Notification.create({
      recipient: job.freelancer, type: 'payment_received', title: 'Milestone funded',
      message: `Milestone "${milestone.title}" has been funded ($${milestone.amount}).`,
      relatedJob: job._id, link: `/jobs/${job._id}/progress`,
    });

    res.json({ message: 'Milestone funded', milestone: { ...milestone.toObject(), _id: String(milestone._id) } });
  } catch (error) {
    console.error('Error confirming milestone funding:', error);
    res.status(500).json({ error: 'Failed to confirm milestone funding' });
  }
});

// POST /milestones/:index/release
router.post('/milestones/:index/release', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('freelancer', '_id firstName lastName stripeAccountId');
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.client) !== String(req.user._id)) return res.status(403).json({ error: 'Only the client can release milestone payments' });

    const idx = parseInt(req.params.index);
    const milestone = job.milestones[idx];
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
    if (milestone.escrowAmount === 0) return res.status(400).json({ error: 'No funds to release' });
    if (!['completed', 'approved'].includes(milestone.status)) return res.status(400).json({ error: 'Milestone must be completed' });
    if (!job.freelancer.stripeAccountId) return res.status(400).json({ error: 'Freelancer has not connected their bank account' });

    const platformFee = Math.round(milestone.amount * 0.10 * 100) / 100;
    const payoutAmt = milestone.amount - platformFee;

    const transfer = await stripeService.releasePayment(payoutAmt, job.freelancer.stripeAccountId, milestone.stripePaymentIntentId);

    milestone.status = 'approved';
    milestone.approvedAt = new Date();
    milestone.releasedAt = new Date();
    milestone.escrowAmount = 0;
    await job.save();

    await Payment.findOneAndUpdate({ stripePaymentIntentId: milestone.stripePaymentIntentId }, { status: 'completed' });
    await Payment.create({
      job: job._id, client: req.user._id, freelancer: job.freelancer._id,
      amount: payoutAmt, type: 'release', status: 'completed',
      paymentMethod: 'stripe', transactionId: transfer.id, platformFee,
    });

    await Notification.create({
      recipient: job.freelancer._id, type: 'payment_received', title: 'Milestone payment released',
      message: `$${payoutAmt.toFixed(2)} released for milestone "${milestone.title}".`,
      relatedJob: job._id, link: `/jobs/${job._id}/progress`,
    });

    res.json({ message: 'Milestone payment released', payoutAmt, transfer: transfer.id });
  } catch (error) {
    console.error('Error releasing milestone payment:', error);
    res.status(500).json({ error: 'Failed to release milestone payment' });
  }
});

// ── Milestone CRUD ──────────────────────────────────────────────

// POST /milestones — add milestones (client only)
router.post('/milestones', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.client.toString() !== req.user.userId) return res.status(403).json({ error: 'Only the client can manage milestones' });

    const { milestones } = req.body;
    if (!Array.isArray(milestones) || milestones.length === 0) return res.status(400).json({ error: 'At least one milestone is required' });

    for (const m of milestones) {
      if (!m.title || m.amount === undefined) return res.status(400).json({ error: 'Each milestone needs a title and amount' });
      job.milestones.push({ title: m.title, description: m.description || '', amount: m.amount, dueDate: m.dueDate || null, status: 'pending' });
    }

    job.progressUpdates.push({
      author: req.user.userId, type: 'update',
      message: `Added ${milestones.length} milestone${milestones.length > 1 ? 's' : ''}: ${milestones.map(m => m.title).join(', ')}`
    });

    await job.save();
    res.json({ message: 'Milestones added', job });
  } catch (error) {
    console.error('Error adding milestones:', error);
    res.status(500).json({ error: 'Failed to add milestones' });
  }
});

// PUT /milestones/:index — update milestone status
router.put('/milestones/:index', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = req.user.userId;
    const isClient = job.client.toString() === userId;
    const isFreelancer = job.freelancer?.toString() === userId;
    if (!isClient && !isFreelancer) return res.status(403).json({ error: 'Not authorized' });

    const idx = parseInt(req.params.index);
    if (idx < 0 || idx >= job.milestones.length) return res.status(404).json({ error: 'Milestone not found' });

    const milestone = job.milestones[idx];
    const { status } = req.body;

    if (isFreelancer && ['in_progress', 'completed'].includes(status)) {
      milestone.status = status;
      if (status === 'completed') milestone.completedAt = new Date();
      job.progressUpdates.push({
        author: userId, type: status === 'completed' ? 'milestone_completed' : 'status_change',
        message: `Milestone "${milestone.title}" marked as ${status.replace('_', ' ')}`, milestoneIndex: idx
      });
    }

    if (isClient && status === 'approved' && milestone.status === 'completed') {
      milestone.status = 'approved';
      milestone.approvedAt = new Date();
      job.progressUpdates.push({
        author: userId, type: 'milestone_completed',
        message: `Approved milestone "${milestone.title}" — $${milestone.amount}`, milestoneIndex: idx
      });
    }

    if (isClient && status === 'in_progress' && milestone.status === 'completed') {
      milestone.status = 'in_progress';
      milestone.completedAt = null;
      job.progressUpdates.push({
        author: userId, type: 'revision_requested',
        message: `Requested revision on milestone "${milestone.title}"${req.body.message ? ': ' + req.body.message : ''}`, milestoneIndex: idx
      });
    }

    await job.save();

    try {
      if (isFreelancer && status === 'completed') {
        await Notification.create({ recipient: job.client, type: 'job_update', title: 'Milestone completed',
          message: `Milestone "${milestone.title}" has been marked complete on "${job.title}". Review and approve it.`,
          relatedJob: job._id, link: `/jobs/${job._id}/progress` });
      }
      if (isClient && status === 'approved') {
        await Notification.create({ recipient: job.freelancer, type: 'job_update', title: 'Milestone approved',
          message: `The client approved milestone "${milestone.title}" on "${job.title}".`,
          relatedJob: job._id, link: `/jobs/${job._id}/progress` });
      }
      if (isClient && status === 'in_progress') {
        await Notification.create({ recipient: job.freelancer, type: 'job_update', title: 'Revision requested',
          message: `The client requested a revision on milestone "${milestone.title}" for "${job.title}".`,
          relatedJob: job._id, link: `/jobs/${job._id}/progress` });
      }
    } catch (notifErr) {
      console.error('Failed to create milestone notification:', notifErr.message);
    }

    res.json({ message: 'Milestone updated', job });
  } catch (error) {
    console.error('Error updating milestone:', error);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

// ── Progress Updates ────────────────────────────────────────────

router.get('/progress', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('progressUpdates.author', 'firstName lastName profilePicture')
      .populate('client', 'firstName lastName')
      .populate('freelancer', 'firstName lastName');
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = req.user.userId;
    if (job.client._id.toString() !== userId && job.freelancer?._id?.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      progress: job.progressUpdates || [], milestones: job.milestones || [],
      status: job.status, deadline: job.deadline,
      job: {
        _id: job._id, title: job.title, client: job.client, freelancer: job.freelancer,
        budget: job.budget, escrowAmount: job.escrowAmount || 0, totalPaid: job.totalPaid || 0,
        stripePaymentIntentId: job.stripePaymentIntentId || null
      }
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

router.post('/progress', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const userId = req.user.userId;
    if (job.client.toString() !== userId && job.freelancer?.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { message, type, attachments } = req.body;
    if (!message || message.trim() === '') return res.status(400).json({ error: 'Message is required' });

    job.progressUpdates.push({ author: userId, type: type || 'update', message: message.trim(), attachments: attachments || [] });
    await job.save();

    const updated = await Job.findById(job._id).populate('progressUpdates.author', 'firstName lastName profilePicture');

    res.status(201).json({ message: 'Update posted', update: updated.progressUpdates[updated.progressUpdates.length - 1] });
  } catch (error) {
    console.error('Error posting progress update:', error);
    res.status(500).json({ error: 'Failed to post update' });
  }
});

module.exports = router;
