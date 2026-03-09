const mongoose = require('mongoose');

const agencyRelationshipSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  agency: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'paused', 'ended'],
    default: 'pending',
  },
  relationshipType: {
    type: String,
    enum: ['preferred', 'retainer', 'one_time'],
    default: 'preferred',
  },
  retainerTerms: {
    monthlyRate: { type: Number },
    hoursIncluded: { type: Number },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  notes: { type: String, default: '' },
  initiatedBy: {
    type: String,
    enum: ['client', 'agency'],
    required: true,
  },
}, { timestamps: true });

agencyRelationshipSchema.index({ client: 1, agency: 1 }, { unique: true });
agencyRelationshipSchema.index({ agency: 1, status: 1 });
agencyRelationshipSchema.index({ client: 1, status: 1 });

module.exports = mongoose.model('AgencyRelationship', agencyRelationshipSchema);
