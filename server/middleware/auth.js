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
    console.log('🔐 === ADMIN AUTH DEBUG START ===');
    
    console.log("🔐 Incoming Auth Header:", req.headers.authorization);
    
    const token = req.headers.authorization?.split(" ")[1];
    console.log("🧾 Extracted Token:", token ? `${token.substring(0, 20)}...` : 'No token');
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ error: 'Access token required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ JWT Decoded Payload:", decoded);
    
    if (!decoded.isAdmin) {
      console.log("⛔ Not an admin token:", decoded);
      return res.status(403).json({ error: "Admin privileges required" });
    }
    
    console.log("✅ Admin flag confirmed, looking up user ID:", decoded.userId);
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log("❌ User not found in DB:", decoded.userId);
      return res.status(401).json({ error: "User not found" });
    }
    
    if (user.isSuspended) {
      console.log("🚫 User is suspended:", user.email);
      return res.status(403).json({ error: "User suspended" });
    }
    
    console.log("🎯 Authenticated admin user:", user.email);
    console.log('🔐 === ADMIN AUTH DEBUG SUCCESS ===');
    
    req.admin = user;
    req.user = user;
    next();
  } catch (error) {
    console.log('❌ JWT Verification Failed:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
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
