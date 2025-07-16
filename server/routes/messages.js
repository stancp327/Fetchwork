const express = require('express');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.userId
    })
    .populate('participants', 'email userType profile.firstName profile.lastName profile.avatar')
    .populate('lastMessage')
    .sort({ lastActivity: -1 });

    const conversationsWithDetails = conversations.map(conv => {
      const otherParticipant = conv.participants.find(p => p._id.toString() !== req.user.userId);
      return {
        id: conv._id,
        participant: otherParticipant,
        lastMessage: conv.lastMessage,
        lastActivity: conv.lastActivity,
        unreadCount: 0
      };
    });

    res.json({ conversations: conversationsWithDetails });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.includes(req.user.userId)) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const messages = await Message.find({
      $or: [
        { sender: conversation.participants[0], recipient: conversation.participants[1] },
        { sender: conversation.participants[1], recipient: conversation.participants[0] }
      ],
      isDeleted: false
    })
    .populate('sender', 'email userType profile.firstName profile.lastName profile.avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    await Message.updateMany(
      {
        recipient: req.user.userId,
        sender: { $in: conversation.participants },
        isRead: false
      },
      { isRead: true, readAt: new Date() }
    );

    res.json({ 
      messages: messages.reverse(),
      hasMore: messages.length === limit
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, messageType = 'text' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.includes(req.user.userId)) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const recipient = conversation.participants.find(p => p.toString() !== req.user.userId);

    const message = new Message({
      sender: req.user.userId,
      recipient,
      content: content.trim(),
      messageType
    });

    await message.save();
    await message.populate('sender', 'email userType profile.firstName profile.lastName profile.avatar');

    conversation.lastMessage = message._id;
    conversation.lastActivity = new Date();
    await conversation.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${recipient}`).emit('newMessage', {
        conversationId,
        message
      });
    }

    res.status(201).json({ message });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/conversations', auth, async (req, res) => {
  try {
    const { participantId, jobId } = req.body;

    if (!participantId) {
      return res.status(400).json({ message: 'Participant ID is required' });
    }

    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({ message: 'User not found' });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user.userId, participantId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [req.user.userId, participantId],
        jobId: jobId || null
      });
      await conversation.save();
    }

    await conversation.populate('participants', 'email userType profile.firstName profile.lastName profile.avatar');

    res.status(201).json({ conversation });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/unread-count', auth, async (req, res) => {
  try {
    const unreadCount = await Message.countDocuments({
      recipient: req.user.userId,
      isRead: false,
      isDeleted: false
    });

    res.json({ unreadCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
