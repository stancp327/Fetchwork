const mongoose = require('mongoose');

const teamMilestoneSchema = new mongoose.Schema({
  team:           { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  job:            { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
  title:          { type: String, required: true, trim: true, maxlength: 200 },
  description:    { type: String, default: '', maxlength: 2000 },
  assignee:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  dueDate:        { type: Date, default: null },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'review', 'completed', 'blocked'],
    default: 'pending',
  },
  completionNote: { type: String, default: '', maxlength: 2000 },
  approvedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:     { type: Date, default: null },
  amount:         { type: Number, default: null, min: 0 },
  paid:           { type: Boolean, default: false },
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Indexes
teamMilestoneSchema.index({ team: 1, status: 1 });
teamMilestoneSchema.index({ team: 1, job: 1 });
teamMilestoneSchema.index({ team: 1, dueDate: 1 });
teamMilestoneSchema.index({ assignee: 1 });

teamMilestoneSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('TeamMilestone', teamMilestoneSchema);
