const ServerError = require('../models/ServerError');

// Sanitize request body — strip passwords, tokens, etc.
const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object') return undefined;
  const sanitized = { ...body };
  const sensitive = ['password', 'token', 'secret', 'apiKey', 'authorization', 'creditCard', 'ssn'];
  for (const key of Object.keys(sanitized)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
};

// Determine severity based on status code and error type
const getSeverity = (statusCode, error) => {
  if (error.name === 'ValidationError' || statusCode === 400) return 'low';
  if (statusCode === 401 || statusCode === 403) return 'low';
  if (statusCode === 404) return 'low';
  if (statusCode >= 500) return 'high';
  if (error.name === 'MongoError' || error.name === 'MongoServerError') return 'critical';
  return 'medium';
};

// Express error-tracking middleware
const errorTracker = async (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const severity = getSeverity(statusCode, err);

  // Only track 500+ errors and critical issues (skip 4xx client errors)
  if (statusCode >= 500 || severity === 'critical') {
    try {
      const errorData = {
        message: err.message || 'Unknown error',
        stack: err.stack,
        name: err.name || 'Error',
        code: err.code?.toString(),
        source: 'server',
        severity,
        request: {
          method: req.method,
          url: req.originalUrl || req.url,
          params: req.params,
          query: req.query,
          body: sanitizeBody(req.body),
          ip: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('user-agent')
        },
        userId: req.user?.userId || req.user?._id,
        userEmail: req.user?.email
      };

      // Try to group with existing error (same fingerprint)
      const fingerprint = Buffer.from(
        [errorData.source, errorData.message?.substring(0, 100), errorData.request.method, errorData.request.url?.replace(/\/[a-f0-9]{24}/g, '/:id')].filter(Boolean).join('|')
      ).toString('base64').substring(0, 64);

      const existing = await ServerError.findOneAndUpdate(
        { fingerprint, resolved: false },
        {
          $inc: { occurrences: 1 },
          $set: { lastSeenAt: new Date(), stack: errorData.stack }
        },
        { new: true }
      );

      if (!existing) {
        await ServerError.create({ ...errorData, fingerprint });
      }
    } catch (trackingError) {
      // Don't let error tracking break the response
      console.error('Error tracker failed:', trackingError.message);
    }
  }

  // Pass to the next error handler
  next(err);
};

// Standalone function to log client-reported errors
const logClientError = async (errorData, userId, userEmail) => {
  try {
    const fingerprint = Buffer.from(
      ['client', errorData.message?.substring(0, 100), errorData.url].filter(Boolean).join('|')
    ).toString('base64').substring(0, 64);

    const existing = await ServerError.findOneAndUpdate(
      { fingerprint, resolved: false },
      {
        $inc: { occurrences: 1 },
        $set: { lastSeenAt: new Date(), stack: errorData.stack }
      },
      { new: true }
    );

    if (!existing) {
      await ServerError.create({
        message: errorData.message || 'Unknown client error',
        stack: errorData.stack,
        name: errorData.name || 'Error',
        source: 'client',
        severity: 'medium',
        client: {
          url: errorData.url,
          component: errorData.component,
          userAgent: errorData.userAgent,
          viewport: errorData.viewport
        },
        userId,
        userEmail,
        fingerprint
      });
    }
  } catch (err) {
    console.error('Failed to log client error:', err.message);
  }
};

// Catch unhandled rejections and uncaught exceptions
const setupProcessErrorHandlers = () => {
  process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled Rejection:', reason);
    try {
      await ServerError.create({
        message: reason?.message || String(reason),
        stack: reason?.stack,
        name: reason?.name || 'UnhandledRejection',
        source: 'unhandledRejection',
        severity: 'critical'
      });
    } catch (e) {
      console.error('Failed to track unhandled rejection:', e.message);
    }
  });

  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    try {
      await ServerError.create({
        message: error.message,
        stack: error.stack,
        name: error.name,
        source: 'uncaughtException',
        severity: 'critical'
      });
    } catch (e) {
      console.error('Failed to track uncaught exception:', e.message);
    }
    // Don't exit — let the process manager handle restarts
  });
};

module.exports = { errorTracker, logClientError, setupProcessErrorHandlers };
