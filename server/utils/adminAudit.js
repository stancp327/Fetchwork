/**
 * AdminAuditLog — immutable record of destructive admin actions.
 * Mirrors the pattern used by BillingAuditLog / logBillingAction.
 * Never throws — audit failure must not block the admin action.
 */
const mongoose = require('mongoose');

const adminAuditSchema = new mongoose.Schema({
  adminId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminEmail: { type: String, required: true },
  targetId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action:     { type: String, required: true },
  reason:     { type: String, default: '' },
  oldValue:   { type: mongoose.Schema.Types.Mixed, default: null },
  newValue:   { type: mongoose.Schema.Types.Mixed, default: null },
  metadata:   { type: mongoose.Schema.Types.Mixed, default: null },
  ip:         { type: String },
}, { timestamps: true });

// Immutable — never update or delete audit logs
adminAuditSchema.index({ adminId: 1, createdAt: -1 });
adminAuditSchema.index({ targetId: 1, createdAt: -1 });
adminAuditSchema.index({ action: 1, createdAt: -1 });

const AdminAuditLog = mongoose.model('AdminAuditLog', adminAuditSchema);

async function logAdminAction({ adminId, adminEmail, targetId, action, reason, oldValue, newValue, metadata, ip }) {
  try {
    await AdminAuditLog.create({ adminId, adminEmail, targetId, action, reason, oldValue, newValue, metadata, ip });
  } catch (err) {
    console.error('[adminAudit] Failed to log action:', err.message);
  }
}

module.exports = { logAdminAction, AdminAuditLog };
