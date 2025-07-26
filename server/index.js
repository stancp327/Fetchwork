const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
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
  RESEND_API_KEY: process.env.RESEND_API_KEY
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
    const { email, password, firstName, lastName } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const user = new User({ email, password, firstName, lastName });
    await user.save();
    
    const emailService = require('./services/emailService');
    await emailService.sendWelcomeEmail(user);
    
    const isAdmin = ADMIN_EMAILS.includes(user.email);
    const token = jwt.sign({ userId: user._id, isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin }
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
    
    const isAdmin = ADMIN_EMAILS.includes(user.email);
    const token = jwt.sign({ userId: user._id, isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, email: user.email, isAdmin }
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
    
    const isAdmin = ADMIN_EMAILS.includes(user.email);
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

app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/services', require('./routes/services'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/chatrooms', require('./routes/chatrooms'));
app.use('/api/disputes', require('./routes/disputes'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/users', require('./routes/users'));
app.use('/api/email', require('./routes/email'));
app.use('/api/admin', adminRoutes);

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
