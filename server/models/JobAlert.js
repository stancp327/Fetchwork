const mongoose = require('mongoose');

const jobAlertSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },
  name: {
    type:      String,
    trim:      true,
    maxlength: 100,
    default:   'Job Alert',
  },
  filters: {
    category:  { type: String, trim: true },
    keywords:  { type: String, trim: true, maxlength: 200 },
    budgetMin: { type: Number, min: 0 },
    budgetMax: { type: Number, min: 0 },
    location:  { type: String, trim: true },
  },
  frequency: {
    type:    String,
    enum:    ['instant', 'daily'],
    default: 'instant',
  },
  active:       { type: Boolean, default: true },
  lastTriggered: { type: Date },
}, { timestamps: true });

// Index for trigger lookup: only active instant alerts
jobAlertSchema.index({ active: 1, frequency: 1 });

module.exports = mongoose.model('JobAlert', jobAlertSchema);
