const express = require('express');
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      'participants.user': req.user._id,
      isActive: true
    })
    .populate('participants.user', 'firstName lastName profilePicture')
    .populate('relatedJob', 'title')
    .populate('lastMessage.sender', 'firstName lastName')
    .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation || !conversation.participants.some(p => p.user.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const messages = await Message.find({
      conversation: req.params.id,
      isDeleted: false
    })
    .populate('sender', 'firstName lastName profilePicture')
    .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/conversations', auth, [
  body('participantId').notEmpty().withMessage('Participant ID is required'),
  body('jobId').optional().isMongoId().withMessage('Valid job ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { participantId, jobId } = req.body;
    
    let conversation = await Conversation.findOne({
      'participants.user': { $all: [req.user._id, participantId] },
      relatedJob: jobId || null
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [
          { user: req.user._id },
          { user: participantId }
        ],
        relatedJob: jobId || null
      });
      await conversation.save();
    }

    await conversation.populate('participants.user', 'firstName lastName profilePicture');
    await conversation.populate('relatedJob', 'title');

    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/', auth, [
  body('conversationId').notEmpty().withMessage('Conversation ID is required'),
  body('content').trim().notEmpty().withMessage('Message content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { conversationId, content } = req.body;
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.some(p => p.user.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const message = new Message({
      content,
      sender: req.user._id,
      conversation: conversationId
    });

    await message.save();
    await message.populate('sender', 'firstName lastName profilePicture');

    conversation.lastMessage = {
      content,
      sender: req.user._id,
      timestamp: message.createdAt
    };
    conversation.updatedAt = new Date();
    await conversation.save();

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
