const mongoose = require('mongoose');

const teamAuditLogSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: {
    type: String,
    enum: [
      'team_deleted',
      'ownership_transfer_started',
      'ownership_transferred',
      'member_role_updated',
      'member_permissions_updated',
      'member_title_updated',
      'approval_requested',
      'approval_approved',
      'approval_rejected',
      'approval_cancelled',
      'spend_controls_updated',
      'custom_role_created',
      'custom_role_updated',
      'custom_role_deleted',
      'member_custom_role_assigned',
      'client_linked',
      'client_unlinked',
    ],
    required: true,
    index: true,
  },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  reason: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },
}, { timestamps: true });

teamAuditLogSchema.index({ team: 1, createdAt: -1 });
teamAuditLogSchema.index({ actor: 1, createdAt: -1 });

teamAuditLogSchema.statics.logSafe = async function(data) {
  try {
    return await this.create(data);
  } catch (error) {
    console.error('Team audit log failed:', error.message);
    return null;
  }
};

module.exports = mongoose.model('TeamAuditLog', teamAuditLogSchema);
