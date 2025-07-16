const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
// Load .env.local first (for local development), then .env as fallback
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://fetchwork-verification-app-tunnel-9z8nqh3b.devinapps.com',
      'https://fetchwork-verification-app-tunnel-c8wwvhm2.devinapps.com'
    ],
    credentials: true
  }
});

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://fetchwork-verification-app-tunnel-9z8nqh3b.devinapps.com',
    'https://fetchwork-verification-app-tunnel-c8wwvhm2.devinapps.com'
  ],
  credentials: true
}));
app.use(express.json());

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const jobRoutes = require('./routes/jobs');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const paymentRoutes = require('./routes/payments');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');
const projectRoutes = require('./routes/projects');
const chatbotRoutes = require('./routes/chatbot');
const contentProtectionRoutes = require('./routes/contentProtection');
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/content-protection', contentProtectionRoutes);

// Connect to MongoDB
mongoose.connect(MONGO_URI)
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection error:', err));

// Simple route
app.get('/', (req, res) => {
  res.send('FetchWork backend running with MongoDB');
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = require('./models/User');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return next(new Error('Authentication error'));
    }
    
    socket.userId = user._id.toString();
    socket.userEmail = user.email;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`User ${socket.userEmail} connected`);
  
  socket.join(`user_${socket.userId}`);
  
  socket.on('joinConversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    console.log(`User ${socket.userEmail} joined conversation ${conversationId}`);
  });
  
  socket.on('leaveConversation', (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
    console.log(`User ${socket.userEmail} left conversation ${conversationId}`);
  });
  
  socket.on('typing', ({ conversationId, isTyping }) => {
    socket.to(`conversation_${conversationId}`).emit('userTyping', {
      userId: socket.userId,
      userEmail: socket.userEmail,
      isTyping
    });
  });
  
  socket.on('updateStatus', (status) => {
    socket.broadcast.emit('userStatusUpdate', {
      userId: socket.userId,
      status
    });
  });
  
  socket.on('disconnect', () => {
    console.log(`User ${socket.userEmail} disconnected`);
    socket.broadcast.emit('userStatusUpdate', {
      userId: socket.userId,
      status: 'offline'
    });
  });
});

app.set('io', io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Backend is running and ready for requests');
});
