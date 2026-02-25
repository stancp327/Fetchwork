const crypto = require('crypto');
const { DailyStats, PageView, VisitorSession } = require('../models/Analytics');

// Detect device type from user-agent
function detectDevice(ua) {
  if (!ua) return 'unknown';
  ua = ua.toLowerCase();
  if (/mobile|android.*mobile|iphone|ipod/.test(ua)) return 'mobile';
  if (/tablet|ipad|android(?!.*mobile)/.test(ua)) return 'tablet';
  return 'desktop';
}

// Lightweight analytics middleware — non-blocking, fire-and-forget
function trackPageView(req, res, next) {
  // Skip API calls, static assets, health checks
  const path = req.path;
  if (path.startsWith('/api/') || path.startsWith('/static/') || path === '/health' || path === '/favicon.ico') {
    return next();
  }

  // Fire and forget — don't slow down the request
  setImmediate(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const ua = req.headers['user-agent'] || '';
      const sessionId = crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').substring(0, 16);
      const referrer = req.headers['referer'] || req.headers['referrer'] || '';

      // Upsert visitor session
      const session = await VisitorSession.findOneAndUpdate(
        { sessionId, date: today },
        {
          $set: { lastSeen: new Date(), userAgent: ua, device: detectDevice(ua), userId: req.user?._id || null },
          $setOnInsert: { firstSeen: new Date(), referrer },
          $inc: { pageCount: 1 }
        },
        { upsert: true, new: true }
      );

      // If this is a new session for today, increment unique visitors
      const isNewVisitor = session.pageCount === 1;

      // Increment daily stats
      await DailyStats.findOneAndUpdate(
        { date: today },
        { $inc: { pageViews: 1, ...(isNewVisitor ? { visitors: 1 } : {}) } },
        { upsert: true }
      );

      // Track per-path views
      // Normalize: /jobs/abc123 → /jobs/:id
      const normalizedPath = path
        .replace(/\/[a-f0-9]{24}/g, '/:id')
        .replace(/\/$/, '') || '/';

      await PageView.findOneAndUpdate(
        { date: today, path: normalizedPath },
        { $inc: { views: 1, ...(isNewVisitor ? { uniqueVisitors: 1 } : {}) } },
        { upsert: true }
      );
    } catch (err) {
      // Silent fail — analytics should never break the app
      if (process.env.NODE_ENV !== 'production') console.error('Analytics error:', err.message);
    }
  });

  next();
}

// Track specific events (call from routes)
async function trackEvent(eventField, amount = 1) {
  try {
    await DailyStats.increment(eventField, amount);
  } catch (err) {
    // Silent
  }
}

module.exports = { trackPageView, trackEvent };
