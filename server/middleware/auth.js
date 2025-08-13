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
    if (!req.user.userId) {
      req.user.userId = user._id.toString();
    }
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
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!(decoded.isAdmin || decoded.role === 'admin')) {
      return res.status(401).json({ error: 'Admin access required' });
    }
    
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
    
    if (user.isSuspended) {
      return res.status(403).json({ error: 'Admin account suspended' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ error: 'Admin account deactivated' });
    }
    
    // Create admin-compatible object for middleware compatibility
    // This shims the Admin model interface while using User records with isAdmin flag
    const adminUser = {
      ...user.toObject(),
      role: 'super_admin',
      hasPermission: function(permission) {
        return true;
      },
      getPublicProfile: function() {
        return user.getPublicProfile();
      }
    };
    
    req.admin = adminUser;
    next();
  } catch (error) {
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
      if (!req.user.userId) {
        req.user.userId = user._id.toString();
      }
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
