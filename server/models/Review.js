const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    maxlength: 1000
  },
  reviewType: {
    type: String,
    enum: ['client-to-freelancer', 'freelancer-to-client'],
    required: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  flaggedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    flaggedAt: {
      type: Date,
      default: Date.now
    }
  }],
  adminNotes: {
    type: String,
    default: ''
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: Date
}, {
  timestamps: true
});

reviewSchema.index({ reviewee: 1, createdAt: -1 });
reviewSchema.index({ job: 1 });
reviewSchema.index({ reviewer: 1 });

module.exports = mongoose.model('Review', reviewSchema);
