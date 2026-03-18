const mongoose = require('mongoose');

const teamSubtaskSchema = new mongoose.Schema({
  team:       { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  job:        { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  title:      { type: String, required: true, trim: true, maxlength: 200 },
  description:{ type: String, default: '', maxlength: 1000 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  dueDate:    { type: Date, default: null },
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'review', 'done'],
    default: 'todo',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completedAt: { type: Date, default: null },
  order:       { type: Number, default: 0 },
}, { timestamps: true });

teamSubtaskSchema.index({ team: 1, job: 1, order: 1 });
teamSubtaskSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('TeamSubtask', teamSubtaskSchema);
