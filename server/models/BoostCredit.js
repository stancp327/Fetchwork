const mongoose = require('mongoose');

const boostCreditSchema = new mongoose.Schema({
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  monthKey:      { type: String, required: true },  // "2026-03" format
  creditsTotal:  { type: Number, default: 0 },      // granted this month
  creditsUsed:   { type: Number, default: 0 },      // used this month
}, { timestamps: true });

boostCreditSchema.index({ user: 1, monthKey: 1 }, { unique: true });

module.exports = mongoose.model('BoostCredit', boostCreditSchema);
