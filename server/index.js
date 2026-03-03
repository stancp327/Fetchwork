const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const passport = require('passport');
const session = require('express-session');

// ── Config ──────────────────────────────────────────────────────
const { PORT, MONGO_URI, JWT_SECRET } = require('./config/env');
const configurePassport = require('./config/passport');

// ── App Setup ───────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Socket.io ───────────────────────────────────────────────────
const allowedSocketOrigins = (() => {
  const fromEnv = process.env.SOCKET_CORS_ORIGIN || process.env.CLIENT_URL || '';
  const split = fromEnv.split(',').map(s => s.trim()).filter(Boolean);
  const defaults = ['http://localhost:3000'];
  return split.length > 0 ? split : defaults;
})();

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow no-origin (React Native, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedSocketOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Socket CORS blocked: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io available globally so Notification model's post-save hook
// can push real-time events without needing to import io everywhere.
global.io = io;

app.set('io', io);
app.set('trust proxy', 1); // Trust first proxy (Render's load balancer)

// ── Middleware ───────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.CLIENT_URL || 'https://fetchwork.net', "https://accounts.google.com", "https://www.facebook.com"].filter(Boolean),
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      formAction: ["'self'", "https://accounts.google.com", "https://www.facebook.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  } : false, // Disable CSP in development
}));

// CORS — lock to allowed origins only
const allowedOrigins = (() => {
  const clientUrl = process.env.CLIENT_URL || '';
  const origins = ['http://localhost:3000'];
  if (clientUrl) {
    origins.push(clientUrl);
    // Also allow www/non-www variants
    if (clientUrl.includes('www.')) {
      origins.push(clientUrl.replace('www.', ''));
    } else if (clientUrl.includes('://')) {
      const withWww = clientUrl.replace('://', '://www.');
      origins.push(withWww);
    }
  }
  return origins;
})();

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Block unknown origins in production; warn in development
    if (process.env.NODE_ENV === 'production') {
      return callback(new Error(`CORS blocked: ${origin}`));
    }
    console.warn(`CORS warning - unexpected origin: ${origin}`);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Stripe Webhooks (MUST be before express.json() — needs raw body for signature verification)
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), require('./routes/payments').webhookHandler);
app.post('/api/billing/webhook',  express.raw({ type: 'application/json' }), require('./routes/billing').webhookHandler);

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

// Session secret: required in production, fallback in dev
const sessionSecret = process.env.SESSION_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => { console.error('FATAL: SESSION_SECRET is required in production'); process.exit(1); })()
    : 'fallback-secret-key-for-development'
);

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ── Passport ────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());
configurePassport();

// ── Rate Limiting ───────────────────────────────────────────────
// Auth endpoints: strict limit to prevent brute force
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 15 : 1000,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login specifically: even stricter
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 500 : 5000,
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  skip: (req) => req.path.startsWith('/api/admin') || req.path.startsWith('/api/auth'),
});

app.use('/api/auth/login', loginRateLimit);
app.use('/api/auth/register', authRateLimit);
app.use('/api/auth/forgot-password', authRateLimit);
app.use('/api/auth/reset-password', authRateLimit);
app.use('/api/admin', adminRateLimit);
app.use(generalRateLimit);

// ── Database ────────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// ── Health & Status Routes ──────────────────────────────────────
app.get('/', (req, res) => {
  res.send('FetchWork backend running with MongoDB');
});

app.get('/test-db', (req, res) => {
  if (mongoose.connection.readyState === 1) {
    res.send('✅ MongoDB Connected!');
  } else {
    res.status(500).send('❌ MongoDB Not Connected');
  }
});

app.get('/health', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const dbConnected = mongoose.connection.readyState === 1;

  const healthStatus = {
    status: dbConnected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbConnected ? 'connected' : 'disconnected',
      server: 'running'
    }
  };

  // Only expose detailed info in development
  if (!isProduction) {
    healthStatus.environment = {
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV || 'development',
      port: PORT
    };
    healthStatus.environmentVariables = {
      MONGO_URI: process.env.MONGO_URI ? 'configured' : 'missing',
      JWT_SECRET: process.env.JWT_SECRET ? 'configured' : 'missing',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? 'configured' : 'missing',
      FROM_EMAIL: process.env.FROM_EMAIL ? 'configured' : 'missing',
      CLIENT_URL: process.env.CLIENT_URL ? 'configured' : 'missing',
      NODE_ENV: process.env.NODE_ENV ? 'configured' : 'missing'
    };
  }

  res.status(dbConnected ? 200 : 503).json(healthStatus);
});

// ── Global Param Validation ─────────────────────────────────────
// Validate any :id-like param as a MongoDB ObjectId before it hits routes
const mongoIdPattern = /^[0-9a-fA-F]{24}$/;
const idParamNames = ['id', 'userId', 'jobId', 'serviceId', 'reviewId', 'roomId', 'conversationId', 'offerId', 'disputeId'];
idParamNames.forEach(paramName => {
  app.param(paramName, (req, res, next, value) => {
    if (!mongoIdPattern.test(value)) {
      return res.status(400).json({ error: `Invalid ${paramName} format` });
    }
    next();
  });
});

// ── SEO Routes (before other routes, no auth) ──────────────────
app.use(require('./routes/seo'));

// ── Analytics Middleware ─────────────────────────────────────────
const { trackPageView } = require('./middleware/analytics');
app.use(trackPageView);

// ── API Routes ──────────────────────────────────────────────────
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/services', require('./routes/services'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/job-templates', require('./routes/jobTemplates'));
app.use('/api/boosts', require('./routes/boosts'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/chatrooms', require('./routes/chatrooms'));
app.use('/api/disputes', require('./routes/disputes'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/users', require('./routes/users'));
app.use('/api/email', require('./routes/email'));
app.use('/api/preferences', require('./routes/preferences'));
app.use('/api/freelancers', require('./routes/freelancers'));
app.use('/api/search', require('./routes/search'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/public-profiles', require('./routes/publicProfiles'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/errors', require('./routes/errors'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/saved', require('./routes/saved'));
app.use('/api/stats',        require('./routes/stats'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/calendar',     require('./routes/calendar'));
app.use('/api/billing',      require('./routes/billing'));
app.use('/api/job-alerts',   require('./routes/jobAlerts'));
app.use('/api/referrals',    require('./routes/referrals'));
app.use('/api/contracts',          require('./routes/contracts'));
app.use('/api/background-checks', require('./routes/backgroundChecks'));

// ── Socket.io Auth & Events ─────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token provided'));

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return next(new Error('Invalid token'));

    try {
      const User = require('./models/User');
      const userId = decoded?.userId;
      if (!userId) return next(new Error('Invalid token payload'));

      const dbUser = await User.findById(userId).select('tokenVersion');
      if (!dbUser) return next(new Error('User not found'));

      const tokenVersion = decoded?.tokenVersion ?? 0;
      const currentVersion = dbUser?.tokenVersion ?? 0;
      if (tokenVersion !== currentVersion) {
        return next(new Error('Token revoked'));
      }

      socket.user = decoded;
      next();
    } catch (e) {
      return next(new Error('Socket auth failed'));
    }
  });
});

const registerSocketEvents = require('./socket/events');
registerSocketEvents(io);

// ── Error Tracking + Handling ────────────────────────────────────
const { errorTracker, setupProcessErrorHandlers } = require('./middleware/errorTracker');
setupProcessErrorHandlers();

app.use(errorTracker);
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({ error: statusCode >= 500 ? 'Something went wrong!' : err.message });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Start Server ────────────────────────────────────────────────
// ── Booking crons ───────────────────────────────────────────────
const { initBookingCrons } = require('./crons/bookingCrons');
initBookingCrons();

const { initArchiveCrons } = require('./crons/archiveCrons');
initArchiveCrons();

const { init: initRecurringCron } = require('./crons/recurringCron');
initRecurringCron();

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Keep-alive self-ping every 10 minutes (prevents Render free tier sleep)
  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    const SELF_URL = process.env.RENDER_EXTERNAL_URL || `https://fetchwork-1.onrender.com`;
    setInterval(() => {
      const https = require('https');
      https.get(`${SELF_URL}/health`, (res) => {
        res.resume(); // drain response
      }).on('error', () => {}); // silent fail
    }, 10 * 60 * 1000); // 10 minutes
    console.log('📡 Keep-alive ping enabled (every 10 min)');
  }
});
