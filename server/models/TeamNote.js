const mongoose = require('mongoose');

const teamNoteSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 1000 },
  relatedTo: {
    type: { type: String, enum: ['member', 'job', 'general'], default: 'general' },
    id: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  pinned: { type: Boolean, default: false },
}, { timestamps: true });

teamNoteSchema.index({ team: 1, createdAt: -1 });
teamNoteSchema.index({ team: 1, pinned: -1, createdAt: -1 });

module.exports = mongoose.model('TeamNote', teamNoteSchema);
