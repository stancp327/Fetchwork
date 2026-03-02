const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  caller:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:       { type: String, enum: ['video', 'audio'], default: 'video' },
  status:     { type: String, enum: ['ringing', 'active', 'ended', 'missed', 'rejected', 'failed'], default: 'ringing' },
  startedAt:  { type: Date },
  endedAt:    { type: Date },
  duration:   { type: Number, default: 0 }, // seconds
  endReason:  { type: String }, // 'caller_ended', 'recipient_ended', 'timeout', 'network_error'
  job:        { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
}, { timestamps: true });

callSchema.index({ caller: 1, createdAt: -1 });
callSchema.index({ recipient: 1, createdAt: -1 });
callSchema.index({ status: 1 });

module.exports = mongoose.model('Call', callSchema);
