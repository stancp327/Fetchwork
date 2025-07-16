const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  revieweeId: {
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
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  comment: {
    type: String,
    required: true,
    maxlength: 1000
  },
  reviewType: {
    type: String,
    enum: ['client_to_freelancer', 'freelancer_to_client'],
    required: true
  },
  categories: {
    communication: {
      type: Number,
      min: 1,
      max: 5
    },
    quality: {
      type: Number,
      min: 1,
      max: 5
    },
    timeliness: {
      type: Number,
      min: 1,
      max: 5
    },
    professionalism: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  adminModeration: {
    flagged: {
      type: Boolean,
      default: false
    },
    flaggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    flaggedReason: {
      type: String
    },
    flaggedDate: {
      type: Date
    },
    adminReviewed: {
      type: Boolean,
      default: false
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    adminAction: {
      type: String,
      enum: ['approved', 'removed', 'edited']
    },
    adminNotes: {
      type: String
    },
    adminDate: {
      type: Date
    }
  },
  response: {
    hasResponse: {
      type: Boolean,
      default: false
    },
    responseText: {
      type: String,
      maxlength: 500
    },
    responseDate: {
      type: Date
    }
  }
}, {
  timestamps: true
});

reviewSchema.index({ jobId: 1 });
reviewSchema.index({ reviewerId: 1 });
reviewSchema.index({ revieweeId: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ reviewType: 1 });
reviewSchema.index({ isPublic: 1 });
reviewSchema.index({ 'adminModeration.flagged': 1 });
reviewSchema.index({ createdAt: -1 });

reviewSchema.index({ revieweeId: 1, isPublic: 1, 'adminModeration.flagged': 1 });
reviewSchema.index({ jobId: 1, reviewType: 1 });

reviewSchema.methods.getAverageRating = function() {
  const categories = this.categories;
  const ratings = [
    categories.communication,
    categories.quality,
    categories.timeliness,
    categories.professionalism
  ].filter(rating => rating !== undefined);
  
  if (ratings.length === 0) return this.rating;
  
  const sum = ratings.reduce((acc, rating) => acc + rating, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
};

reviewSchema.methods.canEdit = function(userId) {
  return this.reviewerId.toString() === userId.toString() && 
         !this.adminModeration.adminReviewed;
};

reviewSchema.methods.canFlag = function(userId) {
  return this.reviewerId.toString() !== userId.toString() && 
         !this.adminModeration.flagged;
};

reviewSchema.methods.canRespond = function(userId) {
  return this.revieweeId.toString() === userId.toString() && 
         !this.response.hasResponse;
};

reviewSchema.statics.getAverageRatingForUser = async function(userId) {
  const reviews = await this.find({
    revieweeId: userId,
    isPublic: true,
    'adminModeration.flagged': false
  });
  
  if (reviews.length === 0) {
    return { average: 0, count: 0 };
  }
  
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const average = Math.round((totalRating / reviews.length) * 10) / 10;
  
  return { average, count: reviews.length };
};

reviewSchema.statics.getCategoryAveragesForUser = async function(userId) {
  const reviews = await this.find({
    revieweeId: userId,
    isPublic: true,
    'adminModeration.flagged': false
  });
  
  if (reviews.length === 0) {
    return {
      communication: 0,
      quality: 0,
      timeliness: 0,
      professionalism: 0
    };
  }
  
  const totals = {
    communication: 0,
    quality: 0,
    timeliness: 0,
    professionalism: 0
  };
  
  const counts = {
    communication: 0,
    quality: 0,
    timeliness: 0,
    professionalism: 0
  };
  
  reviews.forEach(review => {
    Object.keys(totals).forEach(category => {
      if (review.categories[category] !== undefined) {
        totals[category] += review.categories[category];
        counts[category]++;
      }
    });
  });
  
  const averages = {};
  Object.keys(totals).forEach(category => {
    averages[category] = counts[category] > 0 
      ? Math.round((totals[category] / counts[category]) * 10) / 10 
      : 0;
  });
  
  return averages;
};

module.exports = mongoose.model('Review', reviewSchema);
