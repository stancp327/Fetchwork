const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'moderator', 'support'],
    default: 'moderator'
  },
  permissions: {
    userManagement: {
      type: Boolean,
      default: true
    },
    jobManagement: {
      type: Boolean,
      default: true
    },
    paymentOverride: {
      type: Boolean,
      default: false
    },
    reviewModeration: {
      type: Boolean,
      default: true
    },
    analytics: {
      type: Boolean,
      default: true
    },
    systemSettings: {
      type: Boolean,
      default: false
    }
  },
  lastLogin: {
    type: Date
  },
  loginHistory: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

adminSchema.index({ userId: 1 });
adminSchema.index({ role: 1 });
adminSchema.index({ isActive: 1 });

adminSchema.methods.hasPermission = function(permission) {
  if (this.role === 'super_admin') return true;
  return this.permissions[permission] || false;
};

adminSchema.statics.getAdminByUserId = async function(userId) {
  return await this.findOne({ userId, isActive: true }).populate('userId');
};

module.exports = mongoose.model('Admin', adminSchema);
