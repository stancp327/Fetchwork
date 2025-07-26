const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: true,
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  category: {
    type: String,
    required: true,
    enum: [
      'web_development',
      'mobile_development',
      'design',
      'writing',
      'marketing',
      'data_entry',
      'customer_service',
      'translation',
      'video_editing',
      'photography',
      'consulting',
      'other'
    ]
  },
  subcategory: {
    type: String,
    trim: true,
    default: ''
  },
  skills: [{
    type: String,
    trim: true
  }],
  budget: {
    type: {
      type: String,
      enum: ['fixed', 'hourly'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Budget must be at least $1']
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
    }
  },
  duration: {
    type: String,
    enum: ['less_than_1_week', '1_2_weeks', '1_month', '2_3_months', '3_6_months', 'more_than_6_months'],
    required: true
  },
  experienceLevel: {
    type: String,
    enum: ['entry', 'intermediate', 'expert'],
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  freelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'open', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'draft'
  },
  proposals: [{
    freelancer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    coverLetter: {
      type: String,
      required: true,
      maxlength: [2000, 'Cover letter cannot exceed 2000 characters']
    },
    proposedBudget: {
      type: Number,
      required: true,
      min: [1, 'Proposed budget must be at least $1']
    },
    proposedDuration: {
      type: String,
      required: true
    },
    attachments: [{
      filename: String,
      url: String,
      size: Number
    }],
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending'
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  location: {
    type: String,
    trim: true,
    default: 'Remote'
  },
  isRemote: {
    type: Boolean,
    default: true
  },
  isUrgent: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  proposalCount: {
    type: Number,
    default: 0
  },
  startDate: Date,
  endDate: Date,
  completedAt: Date,
  milestones: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'approved'],
      default: 'pending'
    },
    completedAt: Date,
    approvedAt: Date
  }],
  totalPaid: {
    type: Number,
    default: 0
  },
  escrowAmount: {
    type: Number,
    default: 0
  },
  rating: {
    client: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      review: String,
      submittedAt: Date
    },
    freelancer: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      review: String,
      submittedAt: Date
    }
  },
  disputeReason: String,
  disputeStatus: {
    type: String,
    enum: ['none', 'pending', 'in_review', 'resolved'],
    default: 'none'
  },
  adminNotes: {
    type: String,
    maxlength: [2000, 'Admin notes cannot exceed 2000 characters'],
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  }
}, {
  timestamps: true
});

jobSchema.index({ client: 1 });
jobSchema.index({ freelancer: 1 });
jobSchema.index({ status: 1 });
jobSchema.index({ category: 1 });
jobSchema.index({ skills: 1 });
jobSchema.index({ 'budget.amount': 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ isActive: 1, status: 1 });
jobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

jobSchema.pre('save', function(next) {
  if (this.isModified('proposals')) {
    this.proposalCount = this.proposals.length;
  }
  next();
});

jobSchema.methods.addProposal = function(proposalData) {
  this.proposals.push(proposalData);
  this.proposalCount = this.proposals.length;
  return this.save();
};

jobSchema.methods.acceptProposal = async function(proposalId, freelancerId) {
  const proposal = this.proposals.id(proposalId);
  if (!proposal) {
    throw new Error('Proposal not found');
  }
  
  proposal.status = 'accepted';
  this.freelancer = freelancerId;
  this.status = 'in_progress';
  this.startDate = new Date();
  
  this.proposals.forEach(p => {
    if (p._id.toString() !== proposalId.toString()) {
      p.status = 'rejected';
    }
  });
  
  try {
    const emailService = require('../services/emailService');
    const User = require('./User');
    const freelancer = await User.findById(freelancerId);
    
    if (freelancer) {
      await emailService.sendJobNotification(freelancer, this, 'job_accepted');
    }
  } catch (emailError) {
    console.warn('Warning: Could not send job acceptance email:', emailError.message);
  }
  
  return this.save();
};

jobSchema.methods.completeJob = async function() {
  this.status = 'completed';
  this.completedAt = new Date();
  this.endDate = new Date();
  
  try {
    const emailService = require('../services/emailService');
    const User = require('./User');
    const client = await User.findById(this.client);
    const freelancer = await User.findById(this.freelancer);
    
    if (client) await emailService.sendJobNotification(client, this, 'job_completed');
    if (freelancer) await emailService.sendJobNotification(freelancer, this, 'job_completed');
  } catch (emailError) {
    console.warn('Warning: Could not send job completion emails:', emailError.message);
  }
  
  return this.save();
};

jobSchema.methods.cancelJob = function(reason) {
  this.status = 'cancelled';
  this.adminNotes = reason || 'Job cancelled';
  return this.save();
};

jobSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

jobSchema.statics.findActiveJobs = function() {
  return this.find({ 
    isActive: true, 
    status: { $in: ['open', 'in_progress'] },
    expiresAt: { $gt: new Date() }
  });
};

jobSchema.statics.findByCategory = function(category) {
  return this.find({ 
    category, 
    isActive: true, 
    status: 'open',
    expiresAt: { $gt: new Date() }
  });
};

jobSchema.statics.findBySkills = function(skills) {
  return this.find({ 
    skills: { $in: skills },
    isActive: true, 
    status: 'open',
    expiresAt: { $gt: new Date() }
  });
};

jobSchema.statics.findByBudgetRange = function(minBudget, maxBudget) {
  return this.find({ 
    'budget.amount': { $gte: minBudget, $lte: maxBudget },
    isActive: true, 
    status: 'open',
    expiresAt: { $gt: new Date() }
  });
};

module.exports = mongoose.model('Job', jobSchema);
