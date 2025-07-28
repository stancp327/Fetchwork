const jwt = require('jsonwebtoken');

const generateTestToken = (userId = '507f1f77bcf86cd799439011', role = 'freelancer') => {
  return jwt.sign(
    { 
      _id: userId, 
      role: role,
      email: 'test@example.com'
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

const createSocketConnection = (token) => {
  const io = require('socket.io-client');
  return io('http://localhost:10000', {
    auth: { token },
    transports: ['websocket']
  });
};

module.exports = {
  generateTestToken,
  createSocketConnection
};
