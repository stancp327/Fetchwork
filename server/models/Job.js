const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['web-development', 'mobile-development', 'design', 'writing', 'marketing', 'data-science', 'other']
  },
  budget: {
    min: {
      type: Number,
      required: true
    },
    max: {
      type: Number,
      required: true
    }
  },
  jobType: {
    type: String,
    enum: ['remote', 'onsite', 'hybrid'],
    default: 'remote'
  },
  location: {
    type: String,
    default: 'Remote'
  },
  requiredSkills: [{
    type: String,
    trim: true
  }],
  deadline: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'completed', 'cancelled'],
    default: 'open'
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedFreelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  applications: [{
    freelancer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    proposal: {
      type: String,
      required: true
    },
    bidAmount: {
      type: Number,
      required: true
    },
    estimatedDuration: {
      type: String,
      required: true
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    }
  }],
  rating: {
    clientRating: {
      score: { type: Number, min: 1, max: 5 },
      review: String,
      ratedAt: Date
    },
    freelancerRating: {
      score: { type: Number, min: 1, max: 5 },
      review: String,
      ratedAt: Date
    }
  },
  payment: {
    amount: Number,
    status: {
      type: String,
      enum: ['pending', 'escrowed', 'released', 'disputed'],
      default: 'pending'
    },
    escrowedAt: Date,
    releasedAt: Date
  }
}, {
  timestamps: true
});

jobSchema.index({ title: 'text', description: 'text' });
jobSchema.index({ category: 1, status: 1 });
jobSchema.index({ client: 1 });
jobSchema.index({ 'applications.freelancer': 1 });

module.exports = mongoose.model('Job', jobSchema);
