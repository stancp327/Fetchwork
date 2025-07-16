const express = require('express');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
      isActive: true
    })
    .populate('participants', 'name email')
    .populate('lastMessage')
    .populate('job', 'title')
    .sort({ lastActivity: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/conversations', auth, async (req, res) => {
  try {
    const { participantId, jobId } = req.body;
    
    let existingConversation = await Conversation.findOne({
      participants: { $all: [req.user._id, participantId] },
      job: jobId || { $exists: false }
    });

    if (existingConversation) {
      return res.json(existingConversation);
    }

    const conversation = new Conversation({
      participants: [req.user._id, participantId],
      job: jobId
    });

    await conversation.save();
    await conversation.populate('participants', 'name email');
    
    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation || !conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { page = 1, limit = 50 } = req.query;
    
    const messages = await Message.find({ 
      conversation: req.params.id,
      deletedAt: { $exists: false }
    })
    .populate('sender', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    await Message.updateMany(
      { 
        conversation: req.params.id,
        sender: { $ne: req.user._id },
        'readBy.user': { $ne: req.user._id }
      },
      { 
        $push: { 
          readBy: { 
            user: req.user._id,
            readAt: new Date()
          }
        }
      }
    );

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const { content, messageType = 'text', fileUrl, fileName, fileSize } = req.body;
    
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation || !conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const message = new Message({
      conversation: req.params.id,
      sender: req.user._id,
      content,
      messageType,
      fileUrl,
      fileName,
      fileSize,
      readBy: [{
        user: req.user._id,
        readAt: new Date()
      }]
    });

    await message.save();
    await message.populate('sender', 'name email');

    conversation.lastMessage = message._id;
    conversation.lastActivity = new Date();
    await conversation.save();

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/messages/:id', auth, async (req, res) => {
  try {
    const { content } = req.body;
    
    const message = await Message.findById(req.params.id);
    
    if (!message || message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    message.content = content;
    message.editedAt = new Date();
    await message.save();

    res.json(message);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/messages/:id', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message || message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    message.deletedAt = new Date();
    await message.save();

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/conversations/:id/typing', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation || !conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const existingTyping = conversation.typingUsers.find(
      typing => typing.user.toString() === req.user._id.toString()
    );

    if (existingTyping) {
      existingTyping.lastTyping = new Date();
    } else {
      conversation.typingUsers.push({
        user: req.user._id,
        lastTyping: new Date()
      });
    }

    conversation.typingUsers = conversation.typingUsers.filter(
      typing => new Date() - typing.lastTyping < 5000
    );

    await conversation.save();

    res.json({ message: 'Typing status updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
