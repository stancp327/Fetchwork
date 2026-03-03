const mongoose = require('mongoose');

const teamApprovalSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: {
    type: String,
    enum: ['payout', 'spend', 'role_change', 'member_remove'],
    required: true,
  },
  amount: { type: Number },
  metadata: { type: mongoose.Schema.Types.Mixed },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired', 'cancelled'],
    default: 'pending',
    index: true,
  },
  requiredApprovals: { type: Number, default: 1 },
  approvals: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    note: { type: String, default: '' },
  }],
  rejections: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date },
    reason: { type: String, default: '' },
  }],
  expiresAt: { type: Date },
  executedAt: { type: Date },
  executionResult: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

teamApprovalSchema.index({ team: 1, status: 1 });

teamApprovalSchema.statics.pendingForTeam = function(teamId) {
  return this.find({ team: teamId, status: 'pending' });
};

teamApprovalSchema.methods.isQuorumMet = function() {
  return this.approvals.length >= this.requiredApprovals;
};

module.exports = mongoose.model('TeamApproval', teamApprovalSchema);
