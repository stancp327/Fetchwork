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
      return res.status(401).json({ error: 'User not found' });
    }

    // Token version check — ensures logout invalidates all sessions
    try {
      if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined) {
        if (user.tokenVersion !== decoded.tokenVersion) {
          return res.status(401).json({ error: 'Session expired. Please log in again.' });
        }
      }
    } catch (tvErr) {
      // Fail closed — reject if we can't verify token version
      return res.status(401).json({ error: 'Session validation failed' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    req.user = user;
    if (!req.user.userId) {
      req.user.userId = user._id.toString();
    }
    // Cache tokenVersion so downstream doesn't need to refetch
    req.user.tokenVersion = decoded.tokenVersion;
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
    
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const isAdmin = user.isAdmin || user.role === 'admin';
    const isModerator = user.role === 'moderator';
    
    if (!isAdmin && !isModerator) {
      return res.status(401).json({ error: 'Admin or moderator access required' });
    }
    
    if (user.isSuspended) {
      return res.status(403).json({ error: 'Account suspended' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    // Default permissions by role
    const DEFAULT_PERMISSIONS = {
      admin: ['user_management', 'job_management', 'content_moderation', 'payment_management', 'dispute_management', 'analytics_view', 'fee_waiver', 'user_impersonation', 'system_settings'],
      moderator: ['job_management', 'content_moderation', 'dispute_management']
    };
    
    const rolePerms = DEFAULT_PERMISSIONS[user.role] || DEFAULT_PERMISSIONS[isAdmin ? 'admin' : 'moderator'];
    // Merge role defaults with any custom permissions on the user
    const allPerms = [...new Set([...rolePerms, ...(user.permissions || [])])];
    
    const adminUser = {
      ...user.toObject(),
      role: isAdmin ? 'admin' : 'moderator',
      effectivePermissions: allPerms,
      hasPermission: function(permission) {
        if (isAdmin) return true; // Admins have all permissions
        return allPerms.includes(permission);
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
