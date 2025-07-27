const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const session = require('express-session');
const crypto = require('crypto');
const { validateRegister, validateLogin } = require('./middleware/validation');
const User = require('./models/User');
const adminRoutes = require('./routes/admin');

// Load .env.local first (for local development), then .env as fallback
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI;

const ADMIN_EMAILS = ['admin@fetchwork.com', 'stancp327@gmail.com'];

const requiredEnvVars = {
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  FROM_EMAIL: process.env.FROM_EMAIL,
  CLIENT_URL: process.env.CLIENT_URL
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ DEPLOYMENT FAILURE: Missing critical environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}: Required for server startup`);
  });
  console.error('');
  console.error('Please configure these environment variables in your Render dashboard:');
  console.error('- MONGO_URI: MongoDB Atlas connection string');
  console.error('- JWT_SECRET: Secure secret key (minimum 32 characters)');
  console.error('- RESEND_API_KEY: Email service API key (starts with "re_")');
  console.error('- FROM_EMAIL: Email address for sending notifications');
  console.error('- CLIENT_URL: Frontend URL for email links and OAuth redirects');
  
  if (missingVars.includes('FROM_EMAIL') || missingVars.includes('RESEND_API_KEY')) {
    console.warn('⚠️  Email service may not function properly without proper configuration');
  }
  if (missingVars.includes('CLIENT_URL')) {
    console.warn('⚠️  OAuth and email links may not work without CLIENT_URL configuration');
  }
  
  process.exit(1);
}

console.log('✅ All critical environment variables present');

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'https://fetchwork.vercel.app'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.set('io', io);

app.set('trust proxy', true);

app.use(helmet());
app.use(cors());

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-for-development',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      
      if (user) {
        return done(null, user);
      }
      
      user = await User.findOne({ email: profile.emails[0].value });
      if (user) {
        user.googleId = profile.id;
        user.providers.push('google');
        await user.save();
        return done(null, user);
      }
      
      user = new User({
        googleId: profile.id,
        email: profile.emails[0].value,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        isVerified: true, // Google accounts are pre-verified
        providers: ['google']
      });
      
      await user.save();
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
} else {
  console.warn('⚠️ Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "/api/auth/facebook/callback",
    profileFields: ['id', 'emails', 'name']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ facebookId: profile.id });
      
      if (user) {
        return done(null, user);
      }
      
      if (profile.emails && profile.emails[0]) {
        user = await User.findOne({ email: profile.emails[0].value });
        if (user) {
          user.facebookId = profile.id;
          user.providers.push('facebook');
          await user.save();
          return done(null, user);
        }
      }
      
      user = new User({
        facebookId: profile.id,
        email: profile.emails ? profile.emails[0].value : '',
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        isVerified: true, // Facebook accounts are pre-verified
        providers: ['facebook']
      });
      
      await user.save();
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
} else {
  console.warn('⚠️ Facebook OAuth not configured - missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET');
}

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Higher limit for development
  skip: (req) => req.path.startsWith('/api/admin') // Skip rate limiting for admin routes
});

const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 500 : 5000, // Much higher limit for admin operations
});

app.use('/api/admin', adminRateLimit);
app.use(generalRateLimit);

// Middleware
app.use(express.json());

app.use('/uploads', express.static('uploads'));

// Connect to MongoDB
mongoose.connect(MONGO_URI)
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection error:', err));

// Simple route
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
      NODE_ENV: process.env.NODE_ENV ? 'configured' : 'missing'
    }
  };

  const hasErrors = Object.values(healthStatus.environmentVariables).includes('missing') ||
                   healthStatus.services.database !== 'connected';

  res.status(hasErrors ? 503 : 200).json(healthStatus);
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

app.post('/api/auth/register', validateRegister, async (req, res) => {
  try {
    const { email, password, firstName, lastName, accountType } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const user = new User({ 
      email, 
      password, 
      firstName, 
      lastName,
      accountType: accountType || 'both',
      isVerified: false,
      emailVerificationToken: crypto.randomBytes(32).toString('hex'),
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });
    await user.save();
    
    try {
      const emailService = require('./services/emailService');
      const emailWorkflowService = require('./services/emailWorkflowService');
      await emailService.sendEmailVerification(user, user.emailVerificationToken);
      setTimeout(() => emailWorkflowService.sendOnboardingSequence(user._id), 60000);
    } catch (emailError) {
      console.warn('Warning: Could not send verification email:', emailError.message);
    }
    
    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      requiresVerification: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await user.comparePassword(password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const authEnhancementDate = new Date('2025-07-26T10:00:00Z'); // Updated deployment time to allow existing admin account
    const requiresVerification = user.createdAt > authEnhancementDate && !user.isVerified;
    
    if (requiresVerification) {
      return res.status(401).json({ 
        error: 'Please verify your email address before logging in.',
        requiresVerification: true 
      });
    }
    
    const isAdmin = ADMIN_EMAILS.includes(user.email) || user.isAdminPromoted;
    const token = await new Promise((resolve, reject) => {
      jwt.sign({ userId: user._id, isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
        if (err) reject(err);
        else resolve(token);
      });
    });
    
    res.json({
      message: 'Login successful',
      token,
      user: { 
        id: user._id, 
        email: user.email, 
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin 
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const isAdmin = ADMIN_EMAILS.includes(user.email) || user.isAdminPromoted;
    res.json({
      user: { 
        id: user._id, 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName,
        isAdmin 
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    res.status(500).json({ error: 'Email verification failed' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`🔄 Password reset request for: ${email}`);
    
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`❌ User not found for password reset: ${email}`);
      return res.json({ message: 'If an account exists, a reset email has been sent.' });
    }
    
    console.log(`👤 User found for password reset: ${email}`);
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();
    
    console.log(`🔑 Reset token generated for: ${email}`);
    
    try {
      const emailService = require('./services/emailService');
      await emailService.sendPasswordResetEmail(user, resetToken);
      console.log(`📧 Password reset email sent successfully to: ${email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send password reset email to ${email}:`, emailError);
    }
    
    res.json({ message: 'If an account exists, a reset email has been sent.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Password reset request failed' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

app.get('/api/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

app.get('/api/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const isAdmin = ADMIN_EMAILS.includes(req.user.email) || req.user.isAdminPromoted;
      const token = jwt.sign({ userId: req.user._id, isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' });
      
      res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        isAdmin
      }))}`);
    } catch (error) {
      res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
    }
  }
);

app.get('/api/auth/facebook', passport.authenticate('facebook', {
  scope: ['email']
}));

app.get('/api/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const isAdmin = ADMIN_EMAILS.includes(req.user.email) || req.user.isAdminPromoted;
      const token = jwt.sign({ userId: req.user._id, isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' });
      
      res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        isAdmin
      }))}`);
    } catch (error) {
      res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
    }
  }
);

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
app.use('/api/admin', adminRoutes);
app.use('/api/freelancers', require('./routes/freelancers'));
app.use('/api/search', require('./routes/search'));

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token provided'));

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Invalid token'));
    socket.user = user;
    next();
  });
});

const registerSocketEvents = require('./socket/events');
registerSocketEvents(io);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
