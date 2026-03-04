const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { Message, Conversation, ChatRoom, ReceiptCursor } = require('../models/Message');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { validateMessage, validateQueryParams, validateConversationIdParam } = require('../middleware/validation');

const getCorrelationId = (req) => req.headers['x-correlation-id'] || req.headers['x-request-id'] || crypto.randomUUID();
const logRouteError = (req, scope, error) => {
  const correlationId = req.correlationId || getCorrelationId(req);
  console.error(`[messages:${scope}] cid=${correlationId} user=${req.user?.userId || req.user?._id || 'anon'} err=${error.message}`);
};

router.use((req, res, next) => {
  req.correlationId = getCorrelationId(req);
  res.setHeader('x-correlation-id', req.correlationId);
  next();
});

router.get('/conversations', authenticateToken, validateQueryParams, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
      isActive: true
    })
    .populate('participants', 'firstName lastName profilePicture')
    .populate('lastMessage')
    .populate('job', '_id title status')
    .populate('service', '_id title pricing')
    .sort({ lastActivity: -1 });

    res.json({ conversations });
  } catch (error) {
    logRouteError(req, 'get_conversations', error);
    res.status(500).json({ error: 'Failed to fetch conversations', correlationId: req.correlationId });
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
    logRouteError(req, 'get_conversation_messages', error);
    res.status(500).json({ error: 'Failed to fetch messages', correlationId: req.correlationId });
  }
});

// Find or create a conversation without sending a message.
// Use this when opening a chat from a profile/card - let the user type their own first message.
router.post('/conversations/find-or-create', authenticateToken, async (req, res) => {
  try {
    const { recipientId, jobId } = req.body;
    if (!recipientId) return res.status(400).json({ error: 'recipientId is required' });
    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot start a conversation with yourself' });
    }

    const recipient = await User.findOne({ _id: recipientId, isActive: true, isSuspended: { $ne: true } })
      .select('_id')
      .lean();
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    let conversation = await Conversation.findByParticipants(req.user._id, recipientId);
    if (!conversation) {
      conversation = new Conversation({
        participants: [req.user._id, recipientId],
        job: jobId || null
      });
      await conversation.save();
    }

    res.status(200).json({ conversationId: conversation._id });
  } catch (error) {
    logRouteError(req, 'find_or_create_conversation', error);
    res.status(500).json({ error: 'Server error', correlationId: req.correlationId });
  }
});

router.post('/conversations', authenticateToken, validateMessage, async (req, res) => {
  try {
    const { recipientId, jobId, content } = req.body;

    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot send message to yourself' });
    }

    const recipient = await User.findOne({ _id: recipientId, isActive: true, isSuspended: { $ne: true } })
      .select('_id')
      .lean();
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

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
    logRouteError(req, 'create_conversation_and_send', error);
    res.status(500).json({ error: 'Failed to send message', correlationId: req.correlationId });
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

    // Handle file attachments if present
    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      url: file.path?.startsWith('http') ? file.path : `/uploads/${file.filename}`,
      size: file.size,
      mimeType: file.mimetype
    })) : [];

    const message = new Message({
      conversation: conversation._id,
      sender: req.user._id,
      recipient: recipientId,
      content: content || (attachments.length > 0 ? `📎 Sent ${attachments.length} file${attachments.length > 1 ? 's' : ''}` : ''),
      ...(attachments.length > 0 ? { attachments } : {})
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
    logRouteError(req, 'send_to_existing_conversation', error);
    res.status(500).json({ error: 'Failed to send message', correlationId: req.correlationId });
  }
});

// POST /conversations/:conversationId/messages/upload - send message with file attachments
const { uploadMessageAttachments } = require('../middleware/upload');
const { watermarkAttachments } = require('../services/watermarkService');

router.post('/conversations/:conversationId/messages/upload', authenticateToken, uploadMessageAttachments, async (req, res) => {
  try {
    const { content } = req.body;
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || !conversation.participants.some(p => p.toString() === req.user._id.toString())) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const recipientId = conversation.participants.find(p => p.toString() !== req.user._id.toString());

    if (!content && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: 'Message or attachment required' });
    }

    // Watermark images - originals stored separately, watermarked versions served
    // Watermarks are removed when the associated job is completed
    const attachments = req.files?.length > 0
      ? await watermarkAttachments(req.files, req.files.map(f => f.filename))
      : [];

    const message = new Message({
      conversation: conversation._id,
      sender: req.user._id,
      recipient: recipientId,
      content: content || `📎 Sent ${attachments.length} file${attachments.length > 1 ? 's' : ''}`,
      attachments
    });

    await message.save();
    conversation.lastMessage = message._id;
    await conversation.updateLastActivity();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'firstName lastName profilePicture');

    res.status(201).json({ message: 'Message sent', data: populatedMessage });
  } catch (error) {
    logRouteError(req, 'send_upload_message', error);
    res.status(500).json({ error: 'Failed to send message', correlationId: req.correlationId });
  }
});

// GET /conversations/:conversationId/sync?sinceSeq=123
router.get('/conversations/:conversationId/sync', authenticateToken, validateConversationIdParam, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const sinceSeq = Math.max(parseInt(req.query.sinceSeq, 10) || 0, 0);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);

    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'firstName lastName profilePicture')
      .lean();

    if (!conversation || !conversation.participants.some((p) => p._id.toString() === req.user._id.toString())) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await Message.find({
      conversation: conversationId,
      isDeleted: false,
      seq: { $gt: sinceSeq },
    })
      .populate('sender', 'firstName lastName profilePicture')
      .sort({ seq: 1 })
      .limit(limit)
      .lean();

    const lastSeq = messages.length ? messages[messages.length - 1].seq : sinceSeq;

    const myCursor = await ReceiptCursor.findOne({ conversationId, userId: req.user._id })
      .select('lastDeliveredSeq lastReadSeq')
      .lean();

    res.json({
      conversation: {
        _id: conversation._id,
        participants: conversation.participants,
        seq: conversation.seq || 0,
        lastMessageSeq: conversation.lastMessageSeq || 0,
        lastActivity: conversation.lastActivity,
      },
      messages,
      cursors: {
        me: {
          lastDeliveredSeq: myCursor?.lastDeliveredSeq || 0,
          lastReadSeq: myCursor?.lastReadSeq || 0,
        },
      },
      sync: {
        sinceSeq,
        lastSeq,
        hasMore: messages.length === limit,
      },
      correlationId: req.correlationId,
    });
  } catch (error) {
    logRouteError(req, 'sync_conversation', error);
    res.status(500).json({ error: 'Failed to sync conversation', correlationId: req.correlationId });
  }
});

// POST /conversations/:conversationId/receipts
router.post('/conversations/:conversationId/receipts', authenticateToken, validateConversationIdParam, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const { lastDeliveredSeq, lastReadSeq } = req.body || {};

    const conversation = await Conversation.findById(conversationId).select('participants').lean();
    if (!conversation || !conversation.participants.some((p) => p.toString() === req.user._id.toString())) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const delivered = Number.isFinite(Number(lastDeliveredSeq)) ? Number(lastDeliveredSeq) : undefined;
    const read = Number.isFinite(Number(lastReadSeq)) ? Number(lastReadSeq) : undefined;

    await ReceiptCursor.updateOne(
      { conversationId, userId: req.user._id },
      {
        $max: {
          ...(delivered !== undefined ? { lastDeliveredSeq: delivered } : {}),
          ...(read !== undefined ? { lastReadSeq: read } : {}),
        },
      },
      { upsert: true }
    );

    res.json({ ok: true, correlationId: req.correlationId });
  } catch (error) {
    logRouteError(req, 'update_receipts', error);
    res.status(500).json({ error: 'Failed to update receipts', correlationId: req.correlationId });
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
    logRouteError(req, 'get_unread_count', error);
    res.status(500).json({ error: 'Failed to fetch unread count', correlationId: req.correlationId });
  }
});

module.exports = router;
