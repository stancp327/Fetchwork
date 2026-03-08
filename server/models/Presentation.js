const mongoose = require('mongoose');
const crypto = require('crypto');

const sectionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['intro', 'team', 'services', 'portfolio', 'milestones', 'pricing', 'custom'],
    required: true,
  },
  title:   { type: String },
  content: { type: String },
  items:   { type: mongoose.Schema.Types.Mixed },
}, { _id: true });

const milestoneSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String },
  amount:      { type: Number },
  dueDate:     { type: Date },
}, { _id: true });

const presentationSchema = new mongoose.Schema({
  team:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title:     { type: String, required: true, trim: true },
  clientName:  { type: String, trim: true },
  clientEmail: { type: String, trim: true },
  slug: {
    type: String,
    unique: true,
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'],
    default: 'draft',
  },
  sections:           [sectionSchema],
  proposedMilestones: [milestoneSchema],
  totalAmount:  { type: Number },
  validUntil:   { type: Date },
  viewCount:    { type: Number, default: 0 },
  viewedAt:     { type: Date },
  respondedAt:  { type: Date },
  clientNote:   { type: String },
}, { timestamps: true });

// Auto-generate slug from title + short id
presentationSchema.pre('validate', function (next) {
  if (!this.slug) {
    const base = (this.title || 'presentation')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    this.slug = `${base}-${crypto.randomBytes(4).toString('hex')}`;
  }
  next();
});

presentationSchema.index({ slug: 1 }, { unique: true });
presentationSchema.index({ team: 1, createdAt: -1 });

module.exports = mongoose.model('Presentation', presentationSchema);
