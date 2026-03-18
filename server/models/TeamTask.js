const mongoose = require('mongoose');

const teamTaskSchema = new mongoose.Schema({
  team:        { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  job:         { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },   // optional link
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 2000 },

  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAt:  { type: Date, default: null },

  dueDate:     { type: Date, default: null },
  priority:    { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },

  status: {
    type: String,
    enum: ['open', 'in_progress', 'submitted', 'approved', 'paid', 'rejected'],
    default: 'open',
  },

  // ── Payout configuration ──────────────────────────────────────
  payoutType: {
    type: String,
    enum: ['per_job', 'per_hour', 'none'],
    default: 'none',
  },
  payoutAmount:   { type: Number, default: null, min: 0 },  // fixed amount (per_job)
  hourlyRate:     { type: Number, default: null, min: 0 },  // rate  (per_hour)
  hoursLogged:    { type: Number, default: 0,    min: 0 },  // hours submitted by member
  hoursApproved:  { type: Number, default: null, min: 0 },  // hours confirmed by approver

  // Task-level payout authority override:
  // When true, the assigned member can trigger their own payout on approval
  // without needing a separate admin action.
  selfApprovePayout: { type: Boolean, default: false },

  // ── Payout lifecycle ──────────────────────────────────────────
  payoutStatus: {
    type: String,
    enum: ['none', 'requested', 'approved', 'paid', 'rejected'],
    default: 'none',
  },
  submissionNote:      { type: String, default: '', maxlength: 1000 },
  payoutRequestedAt:   { type: Date, default: null },
  payoutRequestedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  payoutApprovedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  payoutApprovedAt:    { type: Date, default: null },
  payoutRejectedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  payoutRejectedAt:    { type: Date, default: null },
  payoutRejectionReason: { type: String, default: '', maxlength: 500 },
  payoutPaidAt:        { type: Date, default: null },
  payoutTransaction:   { type: mongoose.Schema.Types.ObjectId, ref: 'TeamPayout', default: null },

  completedAt: { type: Date, default: null },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// ── Virtuals ───────────────────────────────────────────────────
teamTaskSchema.virtual('effectivePayoutAmount').get(function () {
  if (this.payoutType === 'per_job') return this.payoutAmount || 0;
  if (this.payoutType === 'per_hour') {
    const hours = this.hoursApproved ?? this.hoursLogged ?? 0;
    return Math.round((hours * (this.hourlyRate || 0)) * 100) / 100;
  }
  return 0;
});

// ── Indexes ────────────────────────────────────────────────────
teamTaskSchema.index({ team: 1, status: 1 });
teamTaskSchema.index({ team: 1, job: 1 });
teamTaskSchema.index({ assignedTo: 1, payoutStatus: 1 });
teamTaskSchema.index({ team: 1, payoutStatus: 1 });

teamTaskSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('TeamTask', teamTaskSchema);
