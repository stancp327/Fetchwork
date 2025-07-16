const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Job = require('../models/Job');
const User = require('../models/User');
const auth = require('../middleware/auth');

router.post('/escrow', auth, async (req, res) => {
  try {
    const { jobId, amount, paymentMethod } = req.body;

    if (!jobId || !amount || !paymentMethod) {
      return res.status(400).json({ message: 'Job ID, amount, and payment method are required' });
    }

    const job = await Job.findById(jobId).populate('client freelancer');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.client._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the client can make payments for this job' });
    }

    if (job.status !== 'in-progress') {
      return res.status(400).json({ message: 'Job must be in progress to make payment' });
    }

    const existingPayment = await Payment.findOne({ job: jobId });
    if (existingPayment) {
      return res.status(400).json({ message: 'Payment already exists for this job' });
    }

    const payment = new Payment({
      job: jobId,
      client: job.client._id,
      freelancer: job.freelancer._id,
      amount,
      paymentMethod,
      status: 'escrowed',
      escrowedAt: new Date(),
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    await payment.save();

    job.paymentStatus = 'escrowed';
    await job.save();

    res.status(201).json({
      message: 'Payment escrowed successfully',
      payment: {
        id: payment._id,
        amount: payment.amount,
        platformFee: payment.platformFee,
        freelancerAmount: payment.freelancerAmount,
        status: payment.status,
        transactionId: payment.transactionId
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:paymentId/release', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId).populate('job client freelancer');
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.client._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the client can release payment' });
    }

    if (payment.status !== 'escrowed') {
      return res.status(400).json({ message: 'Payment must be escrowed to release' });
    }

    if (payment.job.status !== 'completed') {
      return res.status(400).json({ message: 'Job must be completed to release payment' });
    }

    payment.coolingOffPeriod = {
      startDate: new Date(),
      endDate: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
      isActive: true
    };

    await payment.save();

    setTimeout(async () => {
      try {
        const updatedPayment = await Payment.findById(payment._id);
        if (updatedPayment && updatedPayment.status === 'escrowed' && updatedPayment.coolingOffPeriod.isActive) {
          updatedPayment.status = 'released';
          updatedPayment.releasedAt = new Date();
          updatedPayment.coolingOffPeriod.isActive = false;
          await updatedPayment.save();

          await User.findByIdAndUpdate(updatedPayment.freelancer, {
            $inc: { totalEarnings: updatedPayment.freelancerAmount, completedJobs: 1 }
          });

          const job = await Job.findById(updatedPayment.job);
          job.paymentStatus = 'released';
          await job.save();
        }
      } catch (error) {
        console.error('Error auto-releasing payment:', error);
      }
    }, 72 * 60 * 60 * 1000);

    res.json({
      message: 'Payment release initiated. Funds will be released after 72-hour cooling-off period.',
      coolingOffPeriod: payment.coolingOffPeriod
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:paymentId/dispute', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: 'Dispute reason is required' });
    }

    const payment = await Payment.findById(req.params.paymentId).populate('client freelancer');
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const isAuthorized = payment.client._id.toString() === req.user.id || 
                        payment.freelancer._id.toString() === req.user.id;
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to dispute this payment' });
    }

    if (payment.status === 'released' || payment.status === 'refunded') {
      return res.status(400).json({ message: 'Cannot dispute a payment that has been released or refunded' });
    }

    payment.dispute = {
      isDisputed: true,
      disputedBy: req.user.id,
      disputeReason: reason,
      disputedAt: new Date()
    };
    payment.status = 'disputed';
    payment.coolingOffPeriod.isActive = false;

    await payment.save();

    res.json({ message: 'Payment disputed successfully. An admin will review the case.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:paymentId/admin-override', auth, async (req, res) => {
  try {
    const { action, reason } = req.body;
    
    if (!action || !reason) {
      return res.status(400).json({ message: 'Action and reason are required' });
    }

    const user = await User.findById(req.user.id);
    if (user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const payment = await Payment.findById(req.params.paymentId).populate('freelancer');
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const originalStatus = payment.status;
    
    payment.adminOverride = {
      overriddenBy: req.user.id,
      reason,
      overriddenAt: new Date(),
      originalStatus
    };

    if (action === 'release') {
      payment.status = 'released';
      payment.releasedAt = new Date();
      payment.coolingOffPeriod.isActive = false;
      
      await User.findByIdAndUpdate(payment.freelancer._id, {
        $inc: { totalEarnings: payment.freelancerAmount, completedJobs: 1 }
      });
    } else if (action === 'refund') {
      payment.status = 'refunded';
      payment.refundedAt = new Date();
      payment.coolingOffPeriod.isActive = false;
    }

    await payment.save();

    const job = await Job.findById(payment.job);
    job.paymentStatus = payment.status;
    await job.save();

    res.json({ message: `Payment ${action} completed by admin override` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/job/:jobId', auth, async (req, res) => {
  try {
    const payment = await Payment.findOne({ job: req.params.jobId })
      .populate('client', 'name email')
      .populate('freelancer', 'name email');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found for this job' });
    }

    const isAuthorized = payment.client._id.toString() === req.user.id || 
                        payment.freelancer._id.toString() === req.user.id;
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to view this payment' });
    }

    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/user/history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { client: req.user.id },
        { freelancer: req.user.id }
      ]
    };

    if (status) {
      query.status = status;
    }

    const payments = await Payment.find(query)
      .populate('job', 'title')
      .populate('client', 'name')
      .populate('freelancer', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    res.json({
      payments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
