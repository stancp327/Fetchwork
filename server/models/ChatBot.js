const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: {
      confidence: Number,
      intent: String,
      entities: mongoose.Schema.Types.Mixed
    }
  }],
  status: {
    type: String,
    enum: ['active', 'resolved', 'escalated', 'closed'],
    default: 'active'
  },
  escalatedToHuman: {
    type: Boolean,
    default: false
  },
  escalatedAt: Date,
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  category: {
    type: String,
    enum: ['general', 'payment', 'technical', 'dispute', 'account', 'other'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  satisfaction: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    ratedAt: Date
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: Date,
  tags: [String]
}, {
  timestamps: true
});

const knowledgeBaseSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['general', 'payment', 'technical', 'dispute', 'account', 'getting_started'],
    required: true
  },
  keywords: [String],
  priority: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usage_count: {
    type: Number,
    default: 0
  },
  last_used: Date,
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

chatSessionSchema.index({ user: 1, createdAt: -1 });
chatSessionSchema.index({ status: 1 });
chatSessionSchema.index({ escalatedToHuman: 1, status: 1 });

knowledgeBaseSchema.index({ category: 1, isActive: 1 });
knowledgeBaseSchema.index({ keywords: 1 });
knowledgeBaseSchema.index({ priority: -1 });

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);
const KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeBaseSchema);

module.exports = { ChatSession, KnowledgeBase };
