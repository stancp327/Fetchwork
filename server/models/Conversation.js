const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: Date.now }
  }],
  relatedJob: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  title: { type: String, trim: true },
  lastMessage: {
    content: String,
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: Date
  },
  isActive: { type: Boolean, default: true },
  conversationType: { type: String, enum: ['job_related', 'general'], default: 'job_related' }
}, { timestamps: true });

conversationSchema.index({ 
  'participants.user': 1, 
  relatedJob: 1 
}, { unique: true, sparse: true });

conversationSchema.index({ 'participants.user': 1 });
conversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
