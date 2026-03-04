const mongoose = require('mongoose');
const crypto = require('crypto');

const PARTICIPANT_STATES = ['invited', 'ringing', 'accepted', 'connecting', 'connected', 'disconnected', 'left'];
const CALL_STATES = [
  'created',
  'invited',
  'ringing',
  'accepted',
  'connecting',
  'connected',
  'ending',
  'ended',
  'declined',
  'missed',
  'canceled',
  'failed',
  'timed_out',
  'fraud_blocked',
  // legacy compatibility
  'active',
  'rejected',
];

const callSchema = new mongoose.Schema({
  callId: { type: String, unique: true, index: true },
  roomId: { type: String, unique: true, index: true },
  provider: { type: String, enum: ['p2p', 'livekit', 'twilio', 'daily', 'agora'], default: 'p2p' },

  caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['caller', 'recipient', 'team_member'], required: true },
    state: { type: String, enum: PARTICIPANT_STATES, default: 'invited' },
    joinedAt: { type: Date },
    leftAt: { type: Date },
    disconnectReason: { type: String },
  }],

  type: { type: String, enum: ['video', 'audio'], default: 'video' },
  status: { type: String, enum: CALL_STATES, default: 'ringing', index: true },

  startedAt: { type: Date },
  endedAt: { type: Date },
  duration: { type: Number, default: 0 }, // seconds
  endReason: { type: String },

  iceSelectedCandidateType: { type: String, enum: ['host', 'srflx', 'relay', null], default: null },
  networkDiagnostics: {
    avgRttMs: { type: Number },
    avgJitterMs: { type: Number },
    avgPacketLossPct: { type: Number },
    maxFreezeMs: { type: Number },
    audioFallbackUsed: { type: Boolean, default: false },
  },

  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },

  version: { type: Number, default: 1 },
}, { timestamps: true });

callSchema.index({ caller: 1, createdAt: -1 });
callSchema.index({ recipient: 1, createdAt: -1 });
callSchema.index({ status: 1, updatedAt: -1 });

callSchema.pre('validate', function ensureCallIds(next) {
  if (!this.callId) this.callId = `c_${crypto.randomBytes(8).toString('hex')}`;
  if (!this.roomId) this.roomId = `r_${crypto.randomBytes(8).toString('hex')}`;
  if (!Array.isArray(this.participants) || this.participants.length === 0) {
    this.participants = [
      { userId: this.caller, role: 'caller', state: 'ringing' },
      { userId: this.recipient, role: 'recipient', state: 'ringing' },
    ];
  }
  next();
});

module.exports = mongoose.model('Call', callSchema);
