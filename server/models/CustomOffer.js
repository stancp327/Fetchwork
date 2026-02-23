const mongoose = require('mongoose');

const offerTermsSchema = {
  amount: {
    type: Number,
    required: true,
    min: [1, 'Amount must be at least $1']
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
  },
  deliveryTime: {
    type: Number,  // days
    required: true,
    min: [1, 'Delivery must be at least 1 day']
  },
  deadline: {
    type: Date,
    default: null
  },
  description: {
    type: String,
    required: true,
    maxlength: [3000, 'Description cannot exceed 3000 characters']
  },
  revisions: {
    type: Number,
    default: 1,
    min: 0
  }
};

const customOfferSchema = new mongoose.Schema({
  // Who's involved
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // What it's for (one of these)
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    default: null
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    default: null
  },
  proposal: {
    type: mongoose.Schema.Types.ObjectId,
    default: null  // links to a specific proposal subdoc on a Job
  },

  // Offer type
  offerType: {
    type: String,
    enum: [
      'custom_order',     // Client → Freelancer: custom service request
      'counter_proposal', // Client → Freelancer: counter to a job proposal
      'counter_offer',    // Freelancer → Client: counter to a custom order
      'direct_offer'      // Either → Either: standalone offer
    ],
    required: true
  },

  // The terms being proposed
  terms: offerTermsSchema,

  // Negotiation thread — each counter adds to this
  revisionHistory: [{
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    terms: offerTermsSchema,
    message: {
      type: String,
      maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    action: {
      type: String,
      enum: ['created', 'countered', 'accepted', 'declined', 'withdrawn'],
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Current status
  status: {
    type: String,
    enum: ['pending', 'countered', 'accepted', 'declined', 'withdrawn', 'expired'],
    default: 'pending'
  },

  // Who needs to act next
  awaitingResponseFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }
  }
}, {
  timestamps: true
});

// Indexes
customOfferSchema.index({ sender: 1, status: 1 });
customOfferSchema.index({ recipient: 1, status: 1 });
customOfferSchema.index({ job: 1 });
customOfferSchema.index({ service: 1 });
customOfferSchema.index({ status: 1 });
customOfferSchema.index({ awaitingResponseFrom: 1 });
customOfferSchema.index({ expiresAt: 1 });

// Counter an offer
customOfferSchema.methods.counter = function(userId, newTerms, message) {
  this.revisionHistory.push({
    by: userId,
    terms: newTerms,
    message,
    action: 'countered'
  });
  this.terms = newTerms;
  this.status = 'countered';
  this.awaitingResponseFrom = this.sender.equals?.(userId) || this.sender.toString() === userId.toString()
    ? this.recipient
    : this.sender;
  this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return this.save();
};

// Accept
customOfferSchema.methods.accept = function(userId) {
  this.revisionHistory.push({
    by: userId,
    terms: this.terms,
    action: 'accepted'
  });
  this.status = 'accepted';
  this.awaitingResponseFrom = null;
  return this.save();
};

// Decline
customOfferSchema.methods.decline = function(userId, message) {
  this.revisionHistory.push({
    by: userId,
    terms: this.terms,
    message,
    action: 'declined'
  });
  this.status = 'declined';
  this.awaitingResponseFrom = null;
  return this.save();
};

// Withdraw
customOfferSchema.methods.withdraw = function(userId) {
  this.revisionHistory.push({
    by: userId,
    terms: this.terms,
    action: 'withdrawn'
  });
  this.status = 'withdrawn';
  this.awaitingResponseFrom = null;
  return this.save();
};

module.exports = mongoose.model('CustomOffer', customOfferSchema);
