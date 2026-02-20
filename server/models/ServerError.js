const mongoose = require('mongoose');

const serverErrorSchema = new mongoose.Schema({
  // Error info
  message: { type: String, required: true, index: true },
  stack: String,
  name: { type: String, default: 'Error' },
  code: String,

  // Source
  source: {
    type: String,
    enum: ['server', 'client', 'unhandledRejection', 'uncaughtException'],
    default: 'server',
    index: true
  },

  // Request context (server errors)
  request: {
    method: String,
    url: String,
    params: mongoose.Schema.Types.Mixed,
    query: mongoose.Schema.Types.Mixed,
    body: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String
  },

  // User context
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: String,

  // Client error context
  client: {
    url: String,
    component: String,
    userAgent: String,
    viewport: String
  },

  // Metadata
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  environment: { type: String, default: process.env.NODE_ENV || 'development' },
  resolved: { type: Boolean, default: false, index: true },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date,
  notes: String,

  // Grouping — errors with same fingerprint are the same issue
  fingerprint: { type: String, index: true },
  occurrences: { type: Number, default: 1 },
  lastSeenAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Generate fingerprint from error message + source + url
serverErrorSchema.pre('save', function(next) {
  if (!this.fingerprint) {
    const parts = [
      this.source,
      this.message?.substring(0, 100),
      this.request?.method,
      this.request?.url?.replace(/\/[a-f0-9]{24}/g, '/:id') // normalize ObjectIds in URLs
    ].filter(Boolean).join('|');
    this.fingerprint = Buffer.from(parts).toString('base64').substring(0, 64);
  }
  next();
});

// TTL index — auto-delete resolved errors after 30 days
serverErrorSchema.index({ resolvedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { resolved: true } });
// TTL for old unresolved errors — keep 90 days
serverErrorSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('ServerError', serverErrorSchema);
