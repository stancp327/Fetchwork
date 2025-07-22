const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
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
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Amount must be at least $0.01']
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
  },
  type: {
    type: String,
    enum: ['escrow', 'release', 'refund', 'bonus', 'dispute_resolution'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'disputed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'stripe'],
    required: true
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  stripePaymentIntentId: String,
  paypalTransactionId: String,
  milestone: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  fees: {
    platform: {
      type: Number,
      default: 0
    },
    payment: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  },
  netAmount: {
    type: Number,
    required: true
  },
  escrowReleaseDate: Date,
  disputeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dispute',
    default: null
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    location: String
  },
  refundReason: String,
  refundAmount: {
    type: Number,
    default: 0
  },
  refundedAt: Date,
  processedAt: Date,
  failureReason: String,
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  adminNotes: {
    type: String,
    maxlength: [1000, 'Admin notes cannot exceed 1000 characters'],
    default: ''
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringSchedule: {
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly'],
      default: null
    },
    nextPaymentDate: Date,
    endDate: Date
  },
  taxInfo: {
    taxRate: {
      type: Number,
      default: 0
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    taxRegion: String
  }
}, {
  timestamps: true
});

paymentSchema.index({ job: 1 });
paymentSchema.index({ client: 1 });
paymentSchema.index({ freelancer: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ escrowReleaseDate: 1 });

paymentSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('fees')) {
    this.netAmount = this.amount - this.fees.total;
  }
  
  if (this.isNew && !this.transactionId) {
    this.transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  next();
});

paymentSchema.methods.calculateFees = function() {
  const platformFeeRate = 0.05;
  const paymentFeeRate = 0.029;
  const paymentFeeFixed = 0.30;
  
  this.fees.platform = Math.round(this.amount * platformFeeRate * 100) / 100;
  this.fees.payment = Math.round((this.amount * paymentFeeRate + paymentFeeFixed) * 100) / 100;
  this.fees.total = this.fees.platform + this.fees.payment;
  this.netAmount = this.amount - this.fees.total;
  
  return this;
};

paymentSchema.methods.processPayment = async function() {
  this.status = 'processing';
  this.processedAt = new Date();
  
  try {
    await this.save();
    return true;
  } catch (error) {
    this.status = 'failed';
    this.failureReason = error.message;
    await this.save();
    return false;
  }
};

paymentSchema.methods.completePayment = function() {
  this.status = 'completed';
  this.processedAt = new Date();
  return this.save();
};

paymentSchema.methods.failPayment = function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  this.retryCount += 1;
  return this.save();
};

paymentSchema.methods.refundPayment = function(amount, reason) {
  this.refundAmount = amount || this.amount;
  this.refundReason = reason;
  this.refundedAt = new Date();
  this.status = 'refunded';
  return this.save();
};

paymentSchema.methods.canRetry = function() {
  return this.retryCount < this.maxRetries && this.status === 'failed';
};

paymentSchema.methods.scheduleEscrowRelease = function(days = 7) {
  this.escrowReleaseDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return this.save();
};

paymentSchema.statics.findPendingEscrowReleases = function() {
  return this.find({
    type: 'escrow',
    status: 'completed',
    escrowReleaseDate: { $lte: new Date() }
  });
};

paymentSchema.statics.findByJob = function(jobId) {
  return this.find({ job: jobId }).sort({ createdAt: -1 });
};

paymentSchema.statics.findByUser = function(userId) {
  return this.find({
    $or: [{ client: userId }, { freelancer: userId }]
  }).sort({ createdAt: -1 });
};

paymentSchema.statics.getTotalEarnings = function(userId) {
  return this.aggregate([
    {
      $match: {
        freelancer: mongoose.Types.ObjectId(userId),
        status: 'completed',
        type: { $in: ['release', 'bonus'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$netAmount' }
      }
    }
  ]);
};

paymentSchema.statics.getTotalSpent = function(userId) {
  return this.aggregate([
    {
      $match: {
        client: mongoose.Types.ObjectId(userId),
        status: 'completed',
        type: { $in: ['escrow', 'bonus'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);
};

module.exports = mongoose.model('Payment', paymentSchema);
