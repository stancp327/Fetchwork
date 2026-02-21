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
    origin: allowedSocketOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.set('io', io);
app.set('trust proxy', true);

// ── Middleware ───────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-for-development',
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
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 500 : 5000,
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  skip: (req) => req.path.startsWith('/api/admin')
});

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
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV || 'development',
      port: PORT
    },
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      server: 'running'
    },
    environmentVariables: {
      MONGO_URI: process.env.MONGO_URI ? 'configured' : 'missing',
      JWT_SECRET: process.env.JWT_SECRET ? 'configured' : 'missing',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? 'configured' : 'missing',
      FROM_EMAIL: process.env.FROM_EMAIL ? 'configured' : 'missing',
      CLIENT_URL: process.env.CLIENT_URL ? 'configured' : 'missing',
      NODE_ENV: process.env.NODE_ENV ? 'configured' : 'missing'
    }
  };

  const hasErrors = Object.values(healthStatus.environmentVariables).includes('missing') ||
                   healthStatus.services.database !== 'connected';

  res.status(hasErrors ? 503 : 200).json(healthStatus);
});

// ── API Routes ──────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/services', require('./routes/services'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/chatrooms', require('./routes/chatrooms'));
app.use('/api/disputes', require('./routes/disputes'));
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

// ── Socket.io Auth & Events ─────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token provided'));

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Invalid token'));
    socket.user = user;
    next();
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
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
