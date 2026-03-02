const mongoose = require('mongoose');

const boostImpressionSchema = new mongoose.Schema({
  targetType:  { type: String, enum: ['job', 'service'], required: true },
  targetId:    { type: mongoose.Schema.Types.ObjectId, required: true },
  owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  impressions: { type: Number, default: 0 },
  clicks:      { type: Number, default: 0 },
  bookings:    { type: Number, default: 0 },
  boostPlan:   { type: String },
  boostStart:  { type: Date, default: Date.now },
  boostEnd:    { type: Date },
  paid:        { type: Boolean, default: true },  // false = used credit
}, { timestamps: true });

boostImpressionSchema.index({ targetType: 1, targetId: 1 });
boostImpressionSchema.index({ owner: 1 });

module.exports = mongoose.model('BoostImpression', boostImpressionSchema);
