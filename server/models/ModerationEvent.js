const mongoose = require('mongoose');

const moderationEventSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null, index: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', default: null, index: true },
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  score: { type: Number, default: 0 },
  confidence: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  action: { type: String, enum: ['allow', 'nudge', 'warn', 'block'], default: 'allow' },
  ruleIds: [{ type: String }],
  source: { type: String, enum: ['rest', 'socket'], default: 'socket' },
}, { timestamps: true });

moderationEventSchema.index({ createdAt: -1 });

module.exports = mongoose.models.ModerationEvent || mongoose.model('ModerationEvent', moderationEventSchema);
