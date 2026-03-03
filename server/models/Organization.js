const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  createdAt:   { type: Date, default: Date.now },
}, { _id: true });

const organizationSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  slug:        { type: String, unique: true, lowercase: true, trim: true },
  owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  description: { type: String, maxlength: 1000, default: '' },
  logo:        { type: String, default: '' },
  website:     { type: String, default: '' },

  departments: [departmentSchema],

  settings: {
    spendControls: {
      monthlyCapEnabled: { type: Boolean, default: false },
      monthlyCap:        { type: Number, default: 0 },
      alertThreshold:    { type: Number, default: 0.8 },
    },
    approvalThresholds: {
      payoutRequiresApproval: { type: Boolean, default: false },
      payoutThresholdAmount:  { type: Number, default: 0 },
      requireDualControl:     { type: Boolean, default: false },
    },
  },

  billing: {
    stripeCustomerId: { type: String, default: '' },
    billingEmail:     { type: String, default: '' },
  },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Auto-generate slug from name
organizationSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60);
  }
  next();
});

// Indexes
organizationSchema.index({ isActive: 1 });

// Statics
organizationSchema.statics.findByOwner = function (userId) {
  return this.find({ owner: userId, isActive: true });
};

module.exports = mongoose.model('Organization', organizationSchema);
