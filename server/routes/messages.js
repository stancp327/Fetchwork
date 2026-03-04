const express = require('express');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const router = express.Router();
const { Message, Conversation, ChatRoom, ReceiptCursor } = require('../models/Message');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { validateMessage, validateQueryParams, validateConversationIdParam } = require('../middleware/validation');
const { detectOffPlatform } = require('../services/offPlatformDetector');
const ModerationEvent = require('../models/ModerationEvent');

const getCorrelationId = (req) => req.headers['x-correlation-id'] || req.headers['x-request-id'] || crypto.randomUUID();
const logRouteError = (req, scope, error) => {
  const correlationId = req.correlationId || getCorrelationId(req);
  console.error(`[messages:${scope}] cid=${correlationId} user=${req.user?.userId || req.user?._id || 'anon'} err=${error.message}`);
};

const recordModerationEvent = async ({ conversationId = null, roomId = null, messageId = null, userId, safety, source = 'rest' }) => {
  if (!safety || !userId) return;
  if ((safety.score || 0) <= 0 && (!safety.hits || safety.hits.length === 0)) return;
  await ModerationEvent.create({
    conversationId,
    roomId,
    messageId,
    userId,
    score: safety.score || 0,
    confidence: safety.confidence || 'low',
    action: safety.action || 'allow',
    ruleIds: safety.hits || [],
    source,
  });
};

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

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
    .sort({ lastActivity: -1 })
    .lean();

    const convoIds = conversations.map(c => c._id);
    const cursors = await ReceiptCursor.find({
      conversationId: { $in: convoIds },
      userId: req.user._id,
    }).select('conversationId lastReadSeq lastDeliveredSeq').lean();

    const cursorMap = new Map(cursors.map(c => [c.conversationId.toString(), c]));
    const withUnread = conversations.map((c) => {
      const cursor = cursorMap.get(c._id.toString());
      const lastReadSeq = cursor?.lastReadSeq || 0;
      const lastMessageSeq = c.lastMessageSeq || 0;
      const unreadSeqCount = Math.max(0, lastMessageSeq - lastReadSeq);
      return {
        ...c,
        cursor: {
          lastReadSeq,
          lastDeliveredSeq: cursor?.lastDeliveredSeq || 0,
        },
        unreadSeqCount,
      };
    });

    res.json({ conversations: withUnread });
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

    const safety = detectOffPlatform(content);
    const message = new Message({
      conversation: conversation._id,
      sender: req.user._id,
      recipient: recipientId,
      content,
      safety,
    });

    await message.save();
    await recordModerationEvent({ conversationId: conversation._id, messageId: message._id, userId: req.user._id, safety, source: 'rest' });

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

    const safeContent = content || (attachments.length > 0 ? `📎 Sent ${attachments.length} file${attachments.length > 1 ? 's' : ''}` : '');
    const safety = detectOffPlatform(safeContent);
    const message = new Message({
      conversation: conversation._id,
      sender: req.user._id,
      recipient: recipientId,
      content: safeContent,
      safety,
      ...(attachments.length > 0 ? { attachments } : {})
    });

    await message.save();
    await recordModerationEvent({ conversationId: conversation._id, messageId: message._id, userId: req.user._id, safety, source: 'rest' });

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

    const safeContent = content || `📎 Sent ${attachments.length} file${attachments.length > 1 ? 's' : ''}`;
    const safety = detectOffPlatform(safeContent);
    const message = new Message({
      conversation: conversation._id,
      sender: req.user._id,
      recipient: recipientId,
      content: safeContent,
      attachments,
      safety,
    });

    await message.save();
    await recordModerationEvent({ conversationId: conversation._id, messageId: message._id, userId: req.user._id, safety, source: 'rest' });
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

// POST /assets/sign - signed upload contract (Cloudinary when configured)
router.post('/assets/sign', authenticateToken, async (req, res) => {
  try {
    const { filename, mime, size, sha256 } = req.body || {};
    if (!filename || !mime || !size) {
      return res.status(400).json({ error: 'filename, mime, size are required' });
    }

    const assetId = `asset_${crypto.randomUUID()}`;
    const expiresAtUnix = Math.floor(Date.now() / 1000) + 10 * 60;

    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const folder = process.env.CLOUDINARY_MESSAGE_FOLDER || 'fetchwork/messages';
      const paramsToSign = {
        timestamp: expiresAtUnix,
        folder,
        public_id: assetId,
      };
      const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

      return res.json({
        assetId,
        provider: 'cloudinary',
        uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
        method: 'POST',
        fields: {
          api_key: process.env.CLOUDINARY_API_KEY,
          timestamp: String(expiresAtUnix),
          folder,
          public_id: assetId,
          signature,
        },
        metadata: { mime, size, sha256: sha256 || null },
        expiresAt: new Date(expiresAtUnix * 1000).toISOString(),
        correlationId: req.correlationId,
      });
    }

    // Fallback scaffold if provider config missing
    return res.json({
      assetId,
      provider: 'stub',
      uploadUrl: null,
      method: 'POST',
      headers: {},
      metadata: { mime, size, sha256: sha256 || null },
      expiresAt: new Date(expiresAtUnix * 1000).toISOString(),
      note: 'Upload signing fallback active; storage provider config missing.',
      correlationId: req.correlationId,
    });
  } catch (error) {
    logRouteError(req, 'assets_sign', error);
    res.status(500).json({ error: 'Failed to sign asset upload', correlationId: req.correlationId });
  }
});

// POST /assets/:assetId/finalize - scaffold for upload finalize contract
router.post('/assets/:assetId/finalize', authenticateToken, async (req, res) => {
  try {
    const { assetId } = req.params;
    const { uploadProof, url, thumbUrl } = req.body || {};

    return res.json({
      asset: {
        assetId,
        url: url || null,
        thumbUrl: thumbUrl || null,
        uploadProof: uploadProof || null,
        status: 'finalized_stub',
      },
      correlationId: req.correlationId,
    });
  } catch (error) {
    logRouteError(req, 'assets_finalize', error);
    res.status(500).json({ error: 'Failed to finalize asset', correlationId: req.correlationId });
  }
});

// GET /moderation/events - basic triage endpoint for admins
router.get('/moderation/events', authenticateToken, async (req, res) => {
  try {
    if (!req.user?.isAdmin && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const events = await ModerationEvent.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ events, correlationId: req.correlationId });
  } catch (error) {
    logRouteError(req, 'moderation_events', error);
    res.status(500).json({ error: 'Failed to fetch moderation events', correlationId: req.correlationId });
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
