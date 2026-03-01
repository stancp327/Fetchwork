const mongoose = require('mongoose');

const jobTemplateSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:        { type: String, required: true, trim: true },
  title:       { type: String, default: '' },
  description: { type: String, default: '' },
  category:    { type: String, default: '' },
  subcategory: { type: String, default: '' },
  skills:      [{ type: String }],
  budgetType:  { type: String, enum: ['fixed', 'hourly', 'range', ''], default: '' },
  budgetMin:   { type: Number },
  budgetMax:   { type: Number },
  location:    {
    locationType: { type: String, enum: ['remote', 'local', 'hybrid'], default: 'remote' },
    city:         { type: String, default: '' },
    state:        { type: String, default: '' },
    zipCode:      { type: String, default: '' },
  },
  requirements: { type: String, default: '' },
  usageCount:   { type: Number, default: 0 },
}, { timestamps: true });

jobTemplateSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('JobTemplate', jobTemplateSchema);
