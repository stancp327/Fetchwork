const mongoose = require('mongoose');

const teamJobRoleSchema = new mongoose.Schema({
  team:       { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  job:        { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: {
    type: String,
    enum: ['designer', 'developer', 'reviewer', 'pm', 'writer', 'other'],
    default: 'other',
  },
  customRole: { type: String, default: '', trim: true, maxlength: 50 },
}, { timestamps: true });

teamJobRoleSchema.index({ team: 1, job: 1 });
teamJobRoleSchema.index({ user: 1 });

module.exports = mongoose.model('TeamJobRole', teamJobRoleSchema);
