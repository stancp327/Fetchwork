const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }
    
    if (user.isSuspended) {
      return res.status(403).json({ error: 'Account suspended' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

const authenticateAdmin = async (req, res, next) => {
  try {
    console.log('=== ADMIN AUTH DEBUG ===');
    const authHeader = req.headers['authorization'];
    console.log('Auth header:', authHeader ? 'Bearer token present' : 'No auth header');
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ error: 'Access token required' });
    }
    
    console.log('Token (first 20 chars):', token.substring(0, 20) + '...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token payload:', decoded);
    
    if (!decoded.isAdmin) {
      console.log('❌ Token missing isAdmin flag:', decoded.isAdmin);
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    console.log('✅ Token has isAdmin flag, looking up user:', decoded.userId);
    const user = await User.findById(decoded.userId);
    console.log('User found:', user ? `${user.email} (id: ${user._id})` : 'No user found');
    
    if (!user) {
      console.log('❌ User not found in database');
      return res.status(401).json({ error: 'Invalid admin token' });
    }
    
    if (user.isSuspended) {
      console.log('❌ User account suspended');
      return res.status(403).json({ error: 'Admin account suspended' });
    }
    
    console.log('✅ Admin authentication successful');
    req.admin = user;
    req.user = user;
    next();
  } catch (error) {
    console.log('❌ Admin auth error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Admin token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
    console.error('Admin authentication error:', error);
    return res.status(500).json({ error: 'Admin authentication failed' });
  }
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    if (!req.admin.hasPermission(permission)) {
      return res.status(403).json({ error: `Permission required: ${permission}` });
    }
    
    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      req.user = null;
      return next();
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (user && !user.isSuspended) {
      req.user = user;
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = {
  authenticateToken,
  authenticateAdmin,
  requirePermission,
  optionalAuth
};
