const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },
  referee: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    unique:   true,       // one referral per new user
    index:    true,
  },
  code: {
    type:     String,
    required: true,
  },
  status: {
    type:    String,
    enum:    ['pending', 'qualified', 'rewarded'],
    default: 'pending',
  },
  rewardAmount: {
    type:    Number,
    default: 25,           // $25 wallet credit per qualified referral
  },
  rewardedAt: Date,
}, { timestamps: true });

referralSchema.index({ code: 1 });

module.exports = mongoose.model('Referral', referralSchema);
