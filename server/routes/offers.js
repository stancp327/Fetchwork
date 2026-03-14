const express = require('express');
const router = express.Router();
const CustomOffer = require('../models/CustomOffer');
const Job = require('../models/Job');
const Service = require('../models/Service');
const { Message, Conversation } = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');

// ── GET /api/offers — list my offers (sent + received) ──────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const userId = req.user.userId;

    const filters = {
      $or: [{ sender: userId }, { recipient: userId }]
    };

    if (req.query.status && req.query.status !== 'all') {
      filters.status = req.query.status;
    }

    if (req.query.type === 'sent') {
      filters.$or = [{ sender: userId }];
    } else if (req.query.type === 'received') {
      filters.$or = [{ recipient: userId }];
    } else if (req.query.type === 'action_needed') {
      filters.awaitingResponseFrom = userId;
      filters.status = { $in: ['pending', 'countered'] };
    }

    const offers = await CustomOffer.find(filters)
      .populate('sender', 'firstName lastName profilePicture')
      .populate('recipient', 'firstName lastName profilePicture')
      .populate('job', 'title budget')
      .populate('service', 'title pricing')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CustomOffer.countDocuments(filters);

    res.json({
      offers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// ── GET /api/offers/:id — single offer with full history ────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const offer = await CustomOffer.findById(req.params.id)
      .populate('sender', 'firstName lastName profilePicture rating')
      .populate('recipient', 'firstName lastName profilePicture rating')
      .populate('job', 'title description budget category')
      .populate('service', 'title description pricing category')
      .populate('revisionHistory.by', 'firstName lastName');

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Only sender or recipient can view
    const userId = req.user.userId;
    if (offer.sender._id.toString() !== userId && offer.recipient._id.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this offer' });
    }

    res.json({ offer });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

// ── POST /api/offers — create a new custom offer ────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      recipientId,
      jobId,
      serviceId,
      proposalId,
      offerType,
      terms,
      message
    } = req.body;

    const senderId = req.user.userId;

    // Validate
    if (!recipientId) {
      return res.status(400).json({ error: 'Recipient is required' });
    }
    if (recipientId === senderId) {
      return res.status(400).json({ error: 'Cannot send offer to yourself' });
    }
    if (!terms?.amount || !terms?.deliveryTime || !terms?.description) {
      return res.status(400).json({ error: 'Amount, delivery time, and description are required' });
    }
    if (!offerType) {
      return res.status(400).json({ error: 'Offer type is required' });
    }

    // Validate job/service exists if referenced
    if (jobId) {
      const job = await Job.findById(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
    }
    if (serviceId) {
      const service = await Service.findById(serviceId);
      if (!service) return res.status(404).json({ error: 'Service not found' });
    }

    const offer = new CustomOffer({
      sender: senderId,
      recipient: recipientId,
      job: jobId || null,
      service: serviceId || null,
      proposal: proposalId || null,
      offerType,
      terms: {
        amount: terms.amount,
        currency: terms.currency || 'USD',
        deliveryTime: terms.deliveryTime,
        deadline: terms.deadline || null,
        description: terms.description,
        revisions: terms.revisions || 1,
        milestones: terms.milestones || []
      },
      awaitingResponseFrom: recipientId,
      revisionHistory: [{
        by: senderId,
        terms: {
          amount: terms.amount,
          currency: terms.currency || 'USD',
          deliveryTime: terms.deliveryTime,
          deadline: terms.deadline || null,
          description: terms.description,
          revisions: terms.revisions || 1,
          milestones: terms.milestones || []
        },
        message: message || '',
        action: 'created'
      }]
    });

    await offer.save();

    // Send a system message to the conversation
    try {
      let conversation = await Conversation.findByParticipants(senderId, recipientId);
      if (!conversation) {
        conversation = new Conversation({
          participants: [senderId, recipientId],
          job: jobId || undefined,
          service: serviceId || undefined
        });
        await conversation.save();
      }

      const sysMsg = new Message({
        conversation: conversation._id,
        sender: senderId,
        recipient: recipientId,
        content: `📋 New Custom Offer\n\nAmount: $${terms.amount}\nDelivery: ${terms.deliveryTime} day${terms.deliveryTime > 1 ? 's' : ''}\n${terms.deadline ? `Deadline: ${new Date(terms.deadline).toLocaleDateString()}\n` : ''}Revisions: ${terms.revisions || 1}\n\n${terms.description.substring(0, 200)}${terms.description.length > 200 ? '...' : ''}\n\n${message ? `Message: ${message}` : ''}\n\n[offer:${offer._id}]`,
        messageType: 'system'
      });
      await sysMsg.save();
      conversation.lastMessage = sysMsg._id;
      await conversation.updateLastActivity();
    } catch (msgErr) {
      console.error('Failed to send offer notification message:', msgErr);
    }

    const populated = await CustomOffer.findById(offer._id)
      .populate('sender', 'firstName lastName profilePicture')
      .populate('recipient', 'firstName lastName profilePicture');

    res.status(201).json({ message: 'Offer sent successfully', offer: populated });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

// ── POST /api/offers/:id/counter — counter an offer ─────────────
router.post('/:id/counter', authenticateToken, async (req, res) => {
  try {
    const offer = await CustomOffer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    const userId = req.user.userId;
    if (offer.awaitingResponseFrom?.toString() !== userId) {
      return res.status(403).json({ error: 'It\'s not your turn to respond' });
    }
    if (!['pending', 'countered'].includes(offer.status)) {
      return res.status(400).json({ error: 'Offer cannot be countered in current status' });
    }

    const { terms, message } = req.body;
    if (!terms?.amount || !terms?.deliveryTime || !terms?.description) {
      return res.status(400).json({ error: 'Amount, delivery time, and description are required' });
    }

    await offer.counter(userId, {
      amount: terms.amount,
      currency: terms.currency || offer.terms.currency,
      deliveryTime: terms.deliveryTime,
      deadline: terms.deadline || offer.terms.deadline,
      description: terms.description,
      revisions: terms.revisions ?? offer.terms.revisions,
      milestones: terms.milestones || offer.terms.milestones || []
    }, message);

    const populated = await CustomOffer.findById(offer._id)
      .populate('sender', 'firstName lastName profilePicture')
      .populate('recipient', 'firstName lastName profilePicture');

    res.json({ message: 'Counter offer sent', offer: populated });
  } catch (error) {
    console.error('Error countering offer:', error);
    res.status(500).json({ error: 'Failed to counter offer' });
  }
});

// ── POST /api/offers/:id/accept — accept an offer ──────────────
router.post('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const offer = await CustomOffer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    const userId = req.user.userId;
    if (offer.awaitingResponseFrom?.toString() !== userId) {
      return res.status(403).json({ error: 'It\'s not your turn to respond' });
    }
    if (!['pending', 'countered'].includes(offer.status)) {
      return res.status(400).json({ error: 'Offer cannot be accepted in current status' });
    }

    await offer.accept(userId);

    // If it's tied to a job, optionally mark proposal as accepted
    if (offer.job && offer.proposal) {
      try {
        const job = await Job.findById(offer.job);
        if (job && job.status === 'open') {
          const freelancerId = offer.sender.toString() === userId 
            ? offer.recipient 
            : offer.sender;
          await job.acceptProposal(offer.proposal, freelancerId);
        }
      } catch (jobErr) {
        console.error('Failed to auto-accept proposal:', jobErr);
      }
    }

    res.json({ message: 'Offer accepted!', offer });
  } catch (error) {
    console.error('Error accepting offer:', error);
    res.status(500).json({ error: 'Failed to accept offer' });
  }
});

// ── POST /api/offers/:id/decline — decline an offer ─────────────
router.post('/:id/decline', authenticateToken, async (req, res) => {
  try {
    const offer = await CustomOffer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    const userId = req.user.userId;
    if (offer.sender.toString() !== userId && offer.recipient.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (['accepted', 'declined', 'withdrawn'].includes(offer.status)) {
      return res.status(400).json({ error: 'Offer already resolved' });
    }

    await offer.decline(userId, req.body.message);
    res.json({ message: 'Offer declined', offer });
  } catch (error) {
    console.error('Error declining offer:', error);
    res.status(500).json({ error: 'Failed to decline offer' });
  }
});

// ── POST /api/offers/:id/withdraw — withdraw your own offer ─────
router.post('/:id/withdraw', authenticateToken, async (req, res) => {
  try {
    const offer = await CustomOffer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    const userId = req.user.userId;
    if (offer.sender.toString() !== userId) {
      return res.status(403).json({ error: 'Only the sender can withdraw' });
    }
    if (['accepted', 'declined', 'withdrawn'].includes(offer.status)) {
      return res.status(400).json({ error: 'Offer already resolved' });
    }

    await offer.withdraw(userId);
    res.json({ message: 'Offer withdrawn', offer });
  } catch (error) {
    console.error('Error withdrawing offer:', error);
    res.status(500).json({ error: 'Failed to withdraw offer' });
  }
});

module.exports = router;
