const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  freelancerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD']
  },
  status: {
    type: String,
    enum: ['pending', 'escrowed', 'released', 'refunded', 'disputed', 'cancelled'],
    default: 'pending'
  },
  escrowDate: {
    type: Date
  },
  releaseDate: {
    type: Date
  },
  coolingOffPeriod: {
    type: Number,
    default: 72
  },
  coolingOffExpiry: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal', 'bank_transfer'],
    required: true
  },
  stripePaymentIntentId: {
    type: String
  },
  paypalOrderId: {
    type: String
  },
  adminOverride: {
    overridden: {
      type: Boolean,
      default: false
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String
    },
    overrideDate: {
      type: Date
    }
  },
  disputeInfo: {
    disputed: {
      type: Boolean,
      default: false
    },
    disputeReason: {
      type: String
    },
    disputeDate: {
      type: Date
    },
    disputedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  transactionFee: {
    type: Number,
    default: 0
  },
  platformFee: {
    type: Number,
    default: 0
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

paymentSchema.index({ jobId: 1 });
paymentSchema.index({ clientId: 1 });
paymentSchema.index({ freelancerId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ escrowDate: 1 });
paymentSchema.index({ coolingOffExpiry: 1 });

paymentSchema.methods.canRelease = function() {
  return this.status === 'escrowed' && 
         (!this.coolingOffExpiry || new Date() > this.coolingOffExpiry);
};

paymentSchema.methods.isInCoolingOff = function() {
  return this.status === 'escrowed' && 
         this.coolingOffExpiry && 
         new Date() < this.coolingOffExpiry;
};

paymentSchema.methods.calculateFees = function() {
  const platformFeeRate = 0.05;
  const transactionFeeRate = 0.029;
  
  this.platformFee = this.amount * platformFeeRate;
  this.transactionFee = this.amount * transactionFeeRate + 0.30;
  
  return {
    platformFee: this.platformFee,
    transactionFee: this.transactionFee,
    totalFees: this.platformFee + this.transactionFee,
    freelancerReceives: this.amount - this.platformFee - this.transactionFee
  };
};

module.exports = mongoose.model('Payment', paymentSchema);
