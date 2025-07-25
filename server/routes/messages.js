const express = require('express');
const router = express.Router();
const { Message, Conversation, ChatRoom } = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');
const { validateMessage, validateQueryParams, validateConversationIdParam } = require('../middleware/validation');

router.get('/conversations', authenticateToken, validateQueryParams, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
      isActive: true
    })
    .populate('participants', 'firstName lastName profilePicture')
    .populate('lastMessage')
    .populate('job', 'title')
    .sort({ lastActivity: -1 });
    
    res.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.get('/conversations/:conversationId', authenticateToken, validateConversationIdParam, validateQueryParams, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId)
      .populate('participants', 'firstName lastName profilePicture');
    
    if (!conversation || !conversation.participants.some(p => p._id.toString() === req.user._id.toString())) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const messages = await Message.find({
      conversation: req.params.conversationId,
      isDeleted: false
    })
    .populate('sender', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    const total = await Message.countDocuments({
      conversation: req.params.conversationId,
      isDeleted: false
    });
    
    await Message.updateMany(
      {
        conversation: req.params.conversationId,
        recipient: req.user._id,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );
    
    res.json({
      conversation,
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/conversations', authenticateToken, validateMessage, async (req, res) => {
  try {
    const { recipientId, jobId, content } = req.body;
    
    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot send message to yourself' });
    }
    
    let conversation = await Conversation.findByParticipants(req.user._id, recipientId);
    
    if (!conversation) {
      conversation = new Conversation({
        participants: [req.user._id, recipientId],
        job: jobId || null
      });
      await conversation.save();
    }
    
    const message = new Message({
      conversation: conversation._id,
      sender: req.user._id,
      recipient: recipientId,
      content
    });
    
    await message.save();
    
    conversation.lastMessage = message._id;
    await conversation.updateLastActivity();
    
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'firstName lastName profilePicture');
    
    res.status(201).json({
      message: 'Message sent successfully',
      data: populatedMessage,
      conversationId: conversation._id
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/conversations/:conversationId/messages', authenticateToken, validateConversationIdParam, validateMessage, async (req, res) => {
  try {
    const { content } = req.body;
    
    const conversation = await Conversation.findById(req.params.conversationId);
    
    if (!conversation || !conversation.participants.some(p => p.toString() === req.user._id.toString())) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const recipientId = conversation.participants.find(
      p => p.toString() !== req.user._id.toString()
    );
    
    const message = new Message({
      conversation: conversation._id,
      sender: req.user._id,
      recipient: recipientId,
      content
    });
    
    await message.save();
    
    conversation.lastMessage = message._id;
    await conversation.updateLastActivity();
    
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'firstName lastName profilePicture');
    
    res.status(201).json({
      message: 'Message sent successfully',
      data: populatedMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const unreadCount = await Message.countDocuments({
      recipient: req.user._id,
      isRead: false,
      isDeleted: false
    });
    
    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

module.exports = router;
