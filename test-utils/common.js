const jwt = require('jsonwebtoken');
const io = require('socket.io-client');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here_replace_in_production';
const SOCKET_URL = 'http://localhost:10000';

const generateTestToken = (userId = '507f1f77bcf86cd799439011', options = {}) => {
  const {
    role = 'freelancer',
    email = 'test@example.com',
    expiresIn = '1h',
    isAdmin = false
  } = options;

  return jwt.sign(
    { 
      userId: userId,
      _id: userId, 
      role: role,
      email: email,
      isAdmin: isAdmin
    },
    JWT_SECRET,
    { expiresIn }
  );
};

const createSocketConnection = (token, options = {}) => {
  const {
    transports = ['websocket'],
    reconnectionAttempts = 3,
    timeout = 10000
  } = options;

  return io(SOCKET_URL, {
    auth: { token },
    transports,
    reconnectionAttempts,
    timeout
  });
};

const testUsers = {
  user1: { userId: '507f1f77bcf86cd799439011', email: 'user1@test.com' },
  user2: { userId: '507f1f77bcf86cd799439012', email: 'user2@test.com' },
  user3: { userId: '507f1f77bcf86cd799439013', email: 'user3@test.com' },
  admin: { userId: '6880b8a532a788ddd046dd1e', email: 'admin@test.com', isAdmin: true }
};

const testRoomIds = {
  conversation: '507f1f77bcf86cd799439011',
  groupChat: '6880bb44ee2b076704294fe6'
};

const createSocketConnectionAsync = (token, userId, options = {}) => {
  return new Promise((resolve, reject) => {
    const socket = createSocketConnection(token, options);

    socket.on('connect', () => {
      console.log(`✅ ${userId} connected:`, socket.id);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      console.log(`❌ ${userId} connection error:`, error.message);
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 ${userId} disconnected:`, reason);
    });
  });
};

module.exports = {
  generateTestToken,
  createSocketConnection,
  createSocketConnectionAsync,
  testUsers,
  testRoomIds,
  JWT_SECRET,
  SOCKET_URL
};
