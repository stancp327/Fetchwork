const mongoose = require('mongoose');

const teamJobChatSchema = new mongoose.Schema({
  team:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  job:      { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  author:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:  { type: String, required: true, maxlength: 2000 },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  editedAt:  { type: Date, default: null },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

teamJobChatSchema.index({ team: 1, job: 1, createdAt: -1 });
teamJobChatSchema.index({ mentions: 1 });

module.exports = mongoose.model('TeamJobChat', teamJobChatSchema);
