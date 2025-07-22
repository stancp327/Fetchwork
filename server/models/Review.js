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
  reviewerType: {
    type: String,
    enum: ['client', 'freelancer'],
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
    default: ''
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    default: ''
  },
  categories: {
    communication: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    quality: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    timeliness: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    professionalism: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    value: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    }
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: Date,
  response: {
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Response cannot exceed 1000 characters'],
      default: ''
    },
    respondedAt: Date
  },
  flags: [{
    reason: {
      type: String,
      enum: ['inappropriate', 'spam', 'fake', 'harassment', 'other'],
      required: true
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    description: String,
    reportedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending'
    },
    adminNotes: String
  }],
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'hidden'],
    default: 'pending'
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  moderatedAt: Date,
  moderationNotes: String,
  helpfulVotes: {
    count: {
      type: Number,
      default: 0
    },
    voters: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  editHistory: [{
    field: String,
    oldValue: String,
    newValue: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    ipAddress: String,
    userAgent: String,
    location: String
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  lastEditedAt: Date
}, {
  timestamps: true
});

reviewSchema.index({ job: 1 });
reviewSchema.index({ reviewer: 1 });
reviewSchema.index({ reviewee: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ moderationStatus: 1 });
reviewSchema.index({ isPublic: 1, moderationStatus: 1 });

reviewSchema.pre('save', function(next) {
  if (this.isModified('comment') || this.isModified('rating') || this.isModified('title')) {
    if (!this.isNew) {
      this.isEdited = true;
      this.lastEditedAt = new Date();
      
      this.editHistory.push({
        field: 'review_content',
        oldValue: 'Content modified',
        newValue: 'Content updated',
        editedAt: new Date()
      });
    }
  }
  next();
});

reviewSchema.methods.addResponse = function(responseText) {
  this.response.comment = responseText;
  this.response.respondedAt = new Date();
  return this.save();
};

reviewSchema.methods.addHelpfulVote = function(userId) {
  if (!this.helpfulVotes.voters.includes(userId)) {
    this.helpfulVotes.voters.push(userId);
    this.helpfulVotes.count += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

reviewSchema.methods.removeHelpfulVote = function(userId) {
  const index = this.helpfulVotes.voters.indexOf(userId);
  if (index > -1) {
    this.helpfulVotes.voters.splice(index, 1);
    this.helpfulVotes.count -= 1;
    return this.save();
  }
  return Promise.resolve(this);
};

reviewSchema.methods.flagReview = function(flagData) {
  this.flags.push(flagData);
  this.moderationStatus = 'pending';
  return this.save();
};

reviewSchema.methods.moderate = function(status, adminId, notes) {
  this.moderationStatus = status;
  this.moderatedBy = adminId;
  this.moderatedAt = new Date();
  this.moderationNotes = notes;
  
  if (status === 'approved') {
    this.isVerified = true;
    this.verifiedAt = new Date();
  }
  
  return this.save();
};

reviewSchema.methods.hide = function() {
  this.moderationStatus = 'hidden';
  this.isPublic = false;
  return this.save();
};

reviewSchema.methods.calculateOverallRating = function() {
  const categories = this.categories;
  const validRatings = Object.values(categories).filter(rating => rating !== null && rating !== undefined);
  
  if (validRatings.length === 0) {
    return this.rating;
  }
  
  const sum = validRatings.reduce((total, rating) => total + rating, 0);
  return Math.round((sum / validRatings.length) * 10) / 10;
};

reviewSchema.statics.findByReviewee = function(revieweeId, options = {}) {
  const query = {
    reviewee: revieweeId,
    isPublic: true,
    moderationStatus: 'approved'
  };
  
  return this.find(query)
    .populate('reviewer', 'firstName lastName profilePicture')
    .populate('job', 'title category')
    .sort({ createdAt: -1 })
    .limit(options.limit || 10)
    .skip(options.skip || 0);
};

reviewSchema.statics.getAverageRating = function(revieweeId) {
  return this.aggregate([
    {
      $match: {
        reviewee: mongoose.Types.ObjectId(revieweeId),
        isPublic: true,
        moderationStatus: 'approved'
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);
};

reviewSchema.statics.getRatingDistribution = function(revieweeId) {
  return this.aggregate([
    {
      $match: {
        reviewee: mongoose.Types.ObjectId(revieweeId),
        isPublic: true,
        moderationStatus: 'approved'
      }
    },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: -1 }
    }
  ]);
};

reviewSchema.statics.findFlaggedReviews = function() {
  return this.find({
    'flags.status': 'pending'
  }).populate('reviewer reviewee', 'firstName lastName email');
};

reviewSchema.statics.findPendingModeration = function() {
  return this.find({
    moderationStatus: 'pending'
  }).populate('reviewer reviewee', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Review', reviewSchema);
