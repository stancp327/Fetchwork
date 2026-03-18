const mongoose = require('mongoose');

// Records every wallet deduction made on behalf of a team —
// member payouts, outsource payments, and team-to-team payments.
const teamPayoutSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },

  type: {
    type: String,
    enum: ['member_payout', 'outsource_payment', 'team_payment'],
    required: true,
  },

  // Source task (for member_payout)
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamTask', default: null },

  // Recipient — one of these will be set depending on type
  recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  default: null },
  recipientTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team',  default: null },

  // Related job (for outsource / team-to-team)
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },

  // ── Financials ────────────────────────────────────────────────
  amount:       { type: Number, required: true, min: 0 },
  payoutType:   { type: String, enum: ['per_job', 'per_hour', 'flat'], default: 'per_job' },
  hourlyRate:   { type: Number, default: null },
  hoursApproved:{ type: Number, default: null },

  // BillingCredit IDs consumed (FIFO order, for audit trail)
  billingCreditIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BillingCredit' }],

  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  failureReason: { type: String, default: '' },

  // ── Audit ─────────────────────────────────────────────────────
  approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:  { type: Date, default: null },
  executedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  executedAt:  { type: Date, default: null },

  note: { type: String, default: '', maxlength: 1000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

teamPayoutSchema.index({ team: 1, status: 1 });
teamPayoutSchema.index({ team: 1, createdAt: -1 });
teamPayoutSchema.index({ recipientUser: 1 });
teamPayoutSchema.index({ task: 1 });

teamPayoutSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('TeamPayout', teamPayoutSchema);
