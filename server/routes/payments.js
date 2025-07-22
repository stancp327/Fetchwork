const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const Job = require('../models/Job');
const User = require('../models/User');
const auth = require('../middleware/auth');

router.post('/create-escrow', auth, async (req, res) => {
  try {
    const { jobId, amount, paymentMethod } = req.body;
    
    const job = await Job.findById(jobId).populate('postedBy assignedTo');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    if (job.postedBy._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only job poster can create escrow payment' });
    }
    
    if (!job.assignedTo) {
      return res.status(400).json({ message: 'Job must be assigned to a freelancer first' });
    }
    
    const existingPayment = await Payment.findOne({ jobId, status: { $in: ['pending', 'escrowed'] } });
    if (existingPayment) {
      return res.status(400).json({ message: 'Payment already exists for this job' });
    }
    
    const payment = new Payment({
      jobId,
      clientId: job.postedBy._id,
      freelancerId: job.assignedTo._id,
      amount,
      paymentMethod,
      status: 'pending'
    });
    
    payment.calculateFees();
    await payment.save();
    
    const transaction = new Transaction({
      paymentId: payment._id,
      type: 'payment',
      amount: payment.amount,
      fromUserId: payment.clientId,
      toUserId: null,
      description: `Escrow payment for job: ${job.title}`,
      status: 'pending'
    });
    
    await transaction.save();
    
    res.status(201).json({
      message: 'Escrow payment created successfully',
      payment: await Payment.findById(payment._id).populate('clientId freelancerId jobId'),
      transaction,
      fees: payment.calculateFees()
    });
    
  } catch (error) {
    console.error('Create escrow error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/confirm-payment/:paymentId', auth, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { stripePaymentIntentId, paypalOrderId } = req.body;
    
    const payment = await Payment.findById(paymentId).populate('clientId freelancerId jobId');
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    if (payment.clientId._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    if (payment.status !== 'pending') {
      return res.status(400).json({ message: 'Payment is not in pending status' });
    }
    
    payment.status = 'escrowed';
    payment.escrowDate = new Date();
    payment.coolingOffExpiry = new Date(Date.now() + payment.coolingOffPeriod * 60 * 60 * 1000);
    
    if (stripePaymentIntentId) {
      payment.stripePaymentIntentId = stripePaymentIntentId;
    }
    if (paypalOrderId) {
      payment.paypalOrderId = paypalOrderId;
    }
    
    await payment.save();
    
    const escrowTransaction = new Transaction({
      paymentId: payment._id,
      type: 'escrow',
      amount: payment.amount,
      fromUserId: payment.clientId._id,
      toUserId: null,
      description: `Funds escrowed for job: ${payment.jobId.title}`,
      status: 'completed',
      processedAt: new Date(),
      externalTransactionId: stripePaymentIntentId || paypalOrderId
    });
    
    await escrowTransaction.save();
    
    res.json({
      message: 'Payment confirmed and funds escrowed',
      payment,
      transaction: escrowTransaction
    });
    
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/release/:paymentId', auth, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { forceRelease } = req.body;
    
    const payment = await Payment.findById(paymentId).populate('clientId freelancerId jobId');
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    const isClient = payment.clientId._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isClient && !isAdmin) {
      return res.status(403).json({ message: 'Only client or admin can release payment' });
    }
    
    if (payment.status !== 'escrowed') {
      return res.status(400).json({ message: 'Payment is not in escrowed status' });
    }
    
    if (!forceRelease && payment.isInCoolingOff() && !isAdmin) {
      return res.status(400).json({ 
        message: 'Payment is still in cooling-off period',
        coolingOffExpiry: payment.coolingOffExpiry
      });
    }
    
    payment.status = 'released';
    payment.releaseDate = new Date();
    
    if (isAdmin && forceRelease) {
      payment.adminOverride.overridden = true;
      payment.adminOverride.adminId = req.user.id;
      payment.adminOverride.reason = req.body.reason || 'Admin force release';
      payment.adminOverride.overrideDate = new Date();
    }
    
    await payment.save();
    
    const fees = payment.calculateFees();
    
    const releaseTransaction = new Transaction({
      paymentId: payment._id,
      type: 'release',
      amount: fees.freelancerReceives,
      fromUserId: null,
      toUserId: payment.freelancerId._id,
      description: `Payment released for job: ${payment.jobId.title}`,
      status: 'completed',
      processedAt: new Date()
    });
    
    await releaseTransaction.save();
    
    if (fees.platformFee > 0) {
      const feeTransaction = new Transaction({
        paymentId: payment._id,
        type: 'fee_collection',
        amount: fees.platformFee,
        fromUserId: null,
        toUserId: null,
        description: `Platform fee for job: ${payment.jobId.title}`,
        status: 'completed',
        processedAt: new Date()
      });
      
      await feeTransaction.save();
    }
    
    res.json({
      message: 'Payment released successfully',
      payment,
      releaseTransaction,
      amountReleased: fees.freelancerReceives,
      platformFee: fees.platformFee
    });
    
  } catch (error) {
    console.error('Release payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/refund/:paymentId', auth, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;
    
    const payment = await Payment.findById(paymentId).populate('clientId freelancerId jobId');
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    const isClient = payment.clientId._id.toString() === req.user.id;
    const isFreelancer = payment.freelancerId._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isClient && !isFreelancer && !isAdmin) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    if (payment.status !== 'escrowed') {
      return res.status(400).json({ message: 'Payment is not in escrowed status' });
    }
    
    payment.status = 'refunded';
    payment.notes = reason || 'Refund requested';
    
    if (isAdmin) {
      payment.adminOverride.overridden = true;
      payment.adminOverride.adminId = req.user.id;
      payment.adminOverride.reason = reason || 'Admin refund';
      payment.adminOverride.overrideDate = new Date();
    }
    
    await payment.save();
    
    const refundTransaction = new Transaction({
      paymentId: payment._id,
      type: 'refund',
      amount: payment.amount,
      fromUserId: null,
      toUserId: payment.clientId._id,
      description: `Refund for job: ${payment.jobId.title}`,
      status: 'completed',
      processedAt: new Date()
    });
    
    await refundTransaction.save();
    
    res.json({
      message: 'Payment refunded successfully',
      payment,
      refundTransaction
    });
    
  } catch (error) {
    console.error('Refund payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/dispute/:paymentId', auth, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;
    
    const payment = await Payment.findById(paymentId).populate('clientId freelancerId jobId');
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    const isClient = payment.clientId._id.toString() === req.user.id;
    const isFreelancer = payment.freelancerId._id.toString() === req.user.id;
    
    if (!isClient && !isFreelancer) {
      return res.status(403).json({ message: 'Only client or freelancer can dispute payment' });
    }
    
    if (payment.status !== 'escrowed') {
      return res.status(400).json({ message: 'Payment is not in escrowed status' });
    }
    
    payment.status = 'disputed';
    payment.disputeInfo.disputed = true;
    payment.disputeInfo.disputeReason = reason;
    payment.disputeInfo.disputeDate = new Date();
    payment.disputeInfo.disputedBy = req.user.id;
    
    await payment.save();
    
    res.json({
      message: 'Payment dispute created successfully',
      payment
    });
    
  } catch (error) {
    console.error('Dispute payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/job/:jobId', auth, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    const isJobParticipant = job.postedBy.toString() === req.user.id || 
                            (job.assignedTo && job.assignedTo.toString() === req.user.id);
    const isAdmin = req.user.role === 'admin';
    
    if (!isJobParticipant && !isAdmin) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const payments = await Payment.find({ jobId })
      .populate('clientId', 'email profile')
      .populate('freelancerId', 'email profile')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 });
    
    res.json({ payments });
    
  } catch (error) {
    console.error('Get job payments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/user', auth, async (req, res) => {
  try {
    const payments = await Payment.find({
      $or: [
        { clientId: req.user.id },
        { freelancerId: req.user.id }
      ]
    })
    .populate('clientId', 'email profile')
    .populate('freelancerId', 'email profile')
    .populate('jobId', 'title')
    .sort({ createdAt: -1 });
    
    res.json({ payments });
    
  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/transactions/:paymentId', auth, async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    const isPaymentParticipant = payment.clientId.toString() === req.user.id || 
                                payment.freelancerId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isPaymentParticipant && !isAdmin) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const transactions = await Transaction.find({ paymentId })
      .populate('fromUserId', 'email profile')
      .populate('toUserId', 'email profile')
      .sort({ createdAt: -1 });
    
    res.json({ transactions });
    
  } catch (error) {
    console.error('Get payment transactions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
