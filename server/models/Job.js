const mongoose = require('mongoose');
// categories.js is now open-ended; no enum constraint
const { locationSchema } = require('../config/locationSchema');

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
    required: [true, 'Category is required'],
    trim: true,
    maxlength: [100, 'Category name too long']
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
      enum: ['fixed', 'hourly', 'range'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Budget must be at least $1']
    },
    maxAmount: {
      type: Number,
      min: [1, 'Max budget must be at least $1'],
      default: null
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
  assignedTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAt:     { type: Date, default: null },
  assignmentNote: { type: String, default: '' },
  team:           { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  status: {
    type: String,
    enum: ['draft', 'open', 'accepted', 'pending_start', 'in_progress', 'completed', 'cancelled', 'disputed'],
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
    // Freelancer can propose milestone breakdown as part of bid
    proposedMilestones: [{
      title:       { type: String, required: true },
      amount:      { type: Number, required: true, min: 0 },
      description: String,
    }],
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
  location: locationSchema,
  jobType: {
    type: String,
    enum: ['fixed_price', 'hourly', 'full_time', 'part_time', 'contract', 'freelance'],
    default: 'freelance'
  },
  isUrgent: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isBoosted: { type: Boolean, default: false },
  boostExpiresAt: { type: Date, default: null },
  boostPaymentId: { type: String, default: null },
  views: {
    type: Number,
    default: 0
  },
  proposalCount: {
    type: Number,
    default: 0
  },
  deadline: {
    type: Date,
    default: null
  },
  scheduledDate: {
    type: Date,
    default: null
  },
  cancellationPolicy: {
    type: String,
    enum: ['flexible', 'moderate', 'strict'],
    default: 'flexible'
    // flexible: cancel anytime (no fee)
    // moderate: cancel 1hr+ before scheduled (no fee), <1hr = 10% fee
    // strict: cancel 24hr+ before (no fee), <24hr = 25% fee, <1hr = 50% fee
  },
  cancelledAt: Date,
  cancellationFee: {
    type: Number,
    default: 0
  },
  cancellationReason: String,
  startDate: Date,
  pendingStartAt: { type: Date, default: null },
  acceptedAt: Date,
  endDate: Date,
  completedAt: Date,
  milestones: [{
    title:       { type: String, required: true, trim: true },
    description: String,
    amount:      { type: Number, required: true, min: 0 },
    dueDate:     Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'approved'],
      default: 'pending'
    },
    completedAt:           Date,
    approvedAt:            Date,
    // Payment fields
    stripePaymentIntentId: { type: String, default: null },
    escrowAmount:          { type: Number, default: 0 },
    fundedAt:              Date,
    releasedAt:            Date,
  }],
  progressUpdates: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['update', 'milestone_completed', 'file_delivered', 'revision_requested', 'status_change'],
      default: 'update'
    },
    message: { type: String, required: true, maxlength: 2000 },
    attachments: [{
      url: String,
      filename: String,
      fileType: String
    }],
    milestoneIndex: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now }
  }],
  totalPaid: {
    type: Number,
    default: 0
  },
  escrowAmount: {
    type: Number,
    default: 0
  },
  stripePaymentIntentId: {
    type: String,
    default: null
  },
  // Team approval workflow
  approvalStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none',
  },
  approvalNote:  { type: String, default: '' },
  approvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:    { type: Date, default: null },
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
  adminAction: {
    action: { type: String, enum: ['removed', 'cancelled', 'flagged', null], default: null },
    reason: { type: String, default: '' },
    removedAt: { type: Date, default: null },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
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
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  },
  archiveReason: {
    type: String,
    enum: ['completed', 'past_deadline', 'admin', null],
    default: null
  },
  // ── Recurring ────────────────────────────────────────────────────
  recurring: {
    enabled:       { type: Boolean, default: false },
    interval:      { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: 'monthly' },
    endDate:       { type: Date },
    nextRunDate:   { type: Date },           // when to spawn the next instance
    parentJobId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Job' }, // links all instances
    instanceCount: { type: Number, default: 0 }, // how many times spawned
  },
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
jobSchema.index({ 'location.locationType': 1 });
jobSchema.index({ 'location.zipCode': 1 });
jobSchema.index({ 'location.coordinates': '2dsphere' });
jobSchema.index({ jobType: 1 });
jobSchema.index({ isUrgent: 1 });
jobSchema.index({ isFeatured: 1 });
jobSchema.index({ proposalCount: 1 });
jobSchema.index({ title: 'text', description: 'text', skills: 'text' });
// Compound indexes for dashboard queries (my-jobs sorted by date)
jobSchema.index({ client: 1, isActive: 1, createdAt: -1 });
jobSchema.index({ freelancer: 1, isActive: 1, status: 1 });
// Archive index
jobSchema.index({ isArchived: 1, archivedAt: -1 });

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
  this.status = 'accepted';  // freelancer still needs to hit "Start Job"
  this.acceptedAt = new Date();

  // Copy freelancer-proposed milestones to job milestones (if any)
  if (proposal.proposedMilestones && proposal.proposedMilestones.length > 0) {
    const existing = this.milestones || [];
    if (existing.length === 0) {
      proposal.proposedMilestones.forEach(m => {
        this.milestones.push({
          title:       m.title,
          description: m.description || '',
          amount:      m.amount,
          status:      'pending',
        });
      });
    }
  }
  
  this.proposals.forEach(p => {
    if (p._id.toString() !== proposalId.toString()) {
      p.status = 'rejected';
    }
  });
  
  const emailService = require('../services/emailService');
  const emailWorkflowService = require('../services/emailWorkflowService');
  const User = require('./User');
  const freelancer = await User.findById(freelancerId);
  
  if (freelancer && await emailWorkflowService.canSendEmail(freelancerId, 'job_lifecycle', 'job_accepted')) {
    await emailService.sendJobNotification(freelancer, this, 'job_accepted');
  }
  
  const client = await User.findById(this.client);
  if (client) {
    await emailService.sendJobNotification(client, this, 'escrow_funding_required');
  }
  
  return this.save();
};

jobSchema.methods.completeJob = async function() {
  this.status        = 'completed';
  this.completedAt   = new Date();
  this.endDate       = new Date();
  this.isActive      = false;
  this.isArchived    = true;
  this.archivedAt    = new Date();
  this.archiveReason = 'completed';
  this.expiresAt     = undefined; // Clear TTL — archived jobs must not be auto-deleted
  
  const emailService = require('../services/emailService');
  const emailWorkflowService = require('../services/emailWorkflowService');
  const User = require('./User');
  const client = await User.findById(this.client);
  const freelancer = await User.findById(this.freelancer);
  
  if (client && await emailWorkflowService.canSendEmail(this.client, 'job_lifecycle', 'job_completed')) {
    await emailService.sendJobNotification(client, this, 'job_completed');
  }
  if (freelancer && await emailWorkflowService.canSendEmail(this.freelancer, 'job_lifecycle', 'job_completed')) {
    await emailService.sendJobNotification(freelancer, this, 'job_completed');
  }
  
  return this.save();
};

jobSchema.methods.cancelJob = function(reason) {
  const now = new Date();
  let fee = 0;

  // Enforce cancellation policy for scheduled local jobs
  if (this.scheduledDate && this.status === 'in_progress') {
    const hoursUntilScheduled = (this.scheduledDate - now) / (1000 * 60 * 60);
    const jobAmount = this.budget?.amount || 0;

    if (this.cancellationPolicy === 'moderate') {
      if (hoursUntilScheduled < 1) fee = jobAmount * 0.10;
    } else if (this.cancellationPolicy === 'strict') {
      if (hoursUntilScheduled < 1) fee = jobAmount * 0.50;
      else if (hoursUntilScheduled < 24) fee = jobAmount * 0.25;
    }
    // 'flexible' = no fee
  }

  this.status = 'cancelled';
  this.cancelledAt = now;
  this.cancellationFee = fee;
  this.cancellationReason = reason || 'Job cancelled';
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
