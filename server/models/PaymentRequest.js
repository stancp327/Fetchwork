const mongoose = require('mongoose');

const paymentRequestSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  },
  requestedById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  requestedFromId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Optional links
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },

  amount: { type: Number, required: true, min: 1 },     // dollars
  currency: { type: String, default: 'usd' },
  description: { type: String, required: true, maxlength: 1000 },
  type: {
    type: String,
    enum: ['service_rendered', 'additional_funds'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending',
    index: true,
  },

  // Stripe
  stripePaymentIntentId: { type: String, default: null },
  stripeClientSecret: { type: String, default: null },

  paidAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true });

paymentRequestSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema);
