const mongoose = require('mongoose');

/**
 * ProcessedWebhookEvent — deduplication store for Stripe webhook events.
 * Prevents double-processing if Stripe replays an event (e.g. on 5xx response).
 * TTL: auto-purge records after 30 days.
 */
const schema = new mongoose.Schema({
  stripeEventId: { type: String, required: true, unique: true, index: true },
  type:          { type: String, required: true },
  processedAt:   { type: Date,   default: Date.now },
}, { _id: false });

schema.index({ processedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30-day TTL

module.exports = mongoose.model('ProcessedWebhookEvent', schema);
