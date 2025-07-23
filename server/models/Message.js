const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: [100, 'Room name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Room description cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['direct', 'group', 'project', 'system'],
    default: 'group'
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'moderator', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastSeen: {
      type: Date,
      default: Date.now
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  maxMembers: {
    type: Number,
    default: 50
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: function() { return !this.roomId; }
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: function() { return !this.conversation; }
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return !this.roomId; }
  },
  content: {
    type: String,
    required: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  messageType: {
    type: String,
    enum: ['text', 'file', 'system'],
    default: 'text'
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    mimeType: String
  }],
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  deliveredAt: {
    type: Date,
    default: null
  },
  deliveredTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    }
  }],
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date
}, {
  timestamps: true
});

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    default: null
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }
}, {
  timestamps: true
});

chatRoomSchema.index({ members: 1 });
chatRoomSchema.index({ type: 1 });
chatRoomSchema.index({ isActive: 1 });
chatRoomSchema.index({ lastActivity: -1 });
chatRoomSchema.index({ createdBy: 1 });

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ recipient: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ mentions: 1 });

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastActivity: -1 });
conversationSchema.index({ job: 1 });

messageSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

conversationSchema.methods.updateLastActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

conversationSchema.statics.findByParticipants = function(userId1, userId2) {
  return this.findOne({
    participants: { $all: [userId1, userId2] }
  });
};

chatRoomSchema.methods.addMember = function(userId, role = 'member') {
  const existingMember = this.members.find(m => m.user.toString() === userId.toString());
  if (!existingMember) {
    this.members.push({ user: userId, role });
    this.lastActivity = new Date();
  }
  return this.save();
};

chatRoomSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(m => m.user.toString() !== userId.toString());
  this.lastActivity = new Date();
  return this.save();
};

chatRoomSchema.methods.updateLastActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

chatRoomSchema.methods.isMember = function(userId) {
  return this.members.some(m => m.user.toString() === userId.toString());
};

chatRoomSchema.methods.getMemberRole = function(userId) {
  const member = this.members.find(m => m.user.toString() === userId.toString());
  return member ? member.role : null;
};

messageSchema.methods.markAsDelivered = function(userId) {
  const existingDelivery = this.deliveredTo.find(d => d.user.toString() === userId.toString());
  if (!existingDelivery) {
    this.deliveredTo.push({ user: userId });
  }
  return this.save();
};

messageSchema.methods.markAsReadByUser = function(userId) {
  const existingRead = this.readBy.find(r => r.user.toString() === userId.toString());
  if (!existingRead) {
    this.readBy.push({ user: userId });
  }
  if (!this.roomId) {
    this.isRead = true;
    this.readAt = new Date();
  }
  return this.save();
};

const Message = mongoose.model('Message', messageSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);
const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = { Message, Conversation, ChatRoom };
