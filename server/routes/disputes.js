const express = require('express');
const router = express.Router();
const { authenticateToken, authenticateAdmin, requirePermission } = require('../middleware/auth');
const Dispute = require('../models/Dispute');
const Job = require('../models/Job');
const User = require('../models/User');

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
    
    const dispute = new Dispute({
      job: jobId,
      client: job.client,
      freelancer: job.freelancer,
      filedBy: req.user.userId,
      reason,
      description,
      evidence: evidence || []
    });
    
    await dispute.save();
    
    job.status = 'disputed';
    job.disputeStatus = 'pending';
    job.disputeReason = reason;
    await job.save();
    
    res.status(201).json({
      message: 'Dispute filed successfully',
      dispute
    });
  } catch (error) {
    console.error('Error filing dispute:', error);
    res.status(500).json({ error: 'Failed to file dispute' });
  }
});

router.get('/user', authenticateToken, async (req, res) => {
  try {
    const disputes = await Dispute.find({
      $or: [
        { client: req.user.userId },
        { freelancer: req.user.userId }
      ]
    })
    .populate('job', 'title budget')
    .populate('client freelancer', 'firstName lastName email')
    .sort({ createdAt: -1 });
    
    res.json({ disputes });
  } catch (error) {
    console.error('Error fetching user disputes:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

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

router.patch('/:id/status', authenticateAdmin, requirePermission('dispute_resolution'), async (req, res) => {
  try {
    const { status, resolution, resolutionAmount, adminNotes } = req.body;
    
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }
    
    dispute.status = status;
    if (resolution) dispute.resolution = resolution;
    if (resolutionAmount !== undefined) dispute.resolutionAmount = resolutionAmount;
    if (adminNotes) dispute.adminNotes = adminNotes;
    
    if (status === 'resolved') {
      dispute.resolvedBy = req.admin._id;
      dispute.resolvedAt = new Date();
      
      const job = await Job.findById(dispute.job);
      if (job) {
        job.disputeStatus = 'resolved';
        await job.save();
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

module.exports = router;
