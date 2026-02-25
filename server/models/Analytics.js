const mongoose = require('mongoose');

// Daily aggregate stats — one doc per day
const dailyStatsSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD
  visitors: { type: Number, default: 0 },       // unique IPs/sessions
  pageViews: { type: Number, default: 0 },
  signups: { type: Number, default: 0 },
  jobsPosted: { type: Number, default: 0 },
  jobsCompleted: { type: Number, default: 0 },
  proposalsSent: { type: Number, default: 0 },
  messagesExchanged: { type: Number, default: 0 },
  servicesCreated: { type: Number, default: 0 },
  disputesFiled: { type: Number, default: 0 },
  searches: { type: Number, default: 0 },
  // Conversion funnel
  loginAttempts: { type: Number, default: 0 },
  successfulLogins: { type: Number, default: 0 },
  // Revenue
  totalTransactionValue: { type: Number, default: 0 },
  platformFees: { type: Number, default: 0 },
}, { timestamps: true });

dailyStatsSchema.index({ date: -1 });

// Increment a stat for today
dailyStatsSchema.statics.increment = async function(field, amount = 1) {
  const today = new Date().toISOString().split('T')[0];
  await this.findOneAndUpdate(
    { date: today },
    { $inc: { [field]: amount } },
    { upsert: true, new: true }
  );
};

// Get stats for a date range
dailyStatsSchema.statics.getRange = async function(startDate, endDate) {
  return this.find({ date: { $gte: startDate, $lte: endDate } }).sort({ date: 1 });
};

// Page view tracking — lightweight, per-path aggregation
const pageViewSchema = new mongoose.Schema({
  date: { type: String, required: true },   // YYYY-MM-DD
  path: { type: String, required: true },    // /jobs, /freelancers, etc.
  views: { type: Number, default: 0 },
  uniqueVisitors: { type: Number, default: 0 },
}, { timestamps: true });

pageViewSchema.index({ date: -1, path: 1 }, { unique: true });

// Session tracking for unique visitor counting
const visitorSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },  // hash of IP + user-agent
  date: { type: String, required: true },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  pageCount: { type: Number, default: 1 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  referrer: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  device: { type: String, enum: ['mobile', 'tablet', 'desktop', 'unknown'], default: 'unknown' },
}, { timestamps: true });

visitorSessionSchema.index({ sessionId: 1, date: 1 }, { unique: true });
visitorSessionSchema.index({ date: -1 });
// TTL: auto-delete after 90 days
visitorSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86400 });

const DailyStats = mongoose.model('DailyStats', dailyStatsSchema);
const PageView = mongoose.model('PageView', pageViewSchema);
const VisitorSession = mongoose.model('VisitorSession', visitorSessionSchema);

module.exports = { DailyStats, PageView, VisitorSession };
