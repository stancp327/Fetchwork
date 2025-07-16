const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  userType: {
    type: String,
    enum: ['client', 'freelancer'],
    required: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  },
  phoneNumber: {
    type: String
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  phoneVerificationToken: {
    type: String
  },
  phoneVerificationExpires: {
    type: Date
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String
  },
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  lastLogin: {
    type: Date
  },
  ipAddresses: [{
    ip: String,
    timestamp: { type: Date, default: Date.now },
    userAgent: String
  }],
  profile: {
    firstName: String,
    lastName: String,
    bio: String,
    skills: [String],
    profilePicture: String,
    location: String,
    hourlyRate: Number,
    experience: {
      type: String,
      enum: ['entry', 'intermediate', 'expert'],
      default: 'intermediate'
    },
    workHistory: [{
      title: String,
      company: String,
      description: String,
      startDate: Date,
      endDate: Date,
      current: Boolean
    }],
    portfolio: [{
      title: String,
      description: String,
      imageUrl: String,
      projectUrl: String,
      technologies: [String]
    }],
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    }
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspensionReason: {
    type: String
  },
  suspendedAt: {
    type: Date
  },
  suspendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  securityFlags: [{
    type: {
      type: String,
      enum: ['fraud', 'abuse', 'spam', 'fake_profile', 'payment_dispute', 'other']
    },
    reason: String,
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending'
    },
    adminNotes: String,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date
  }],
  verificationLevel: {
    type: String,
    enum: ['unverified', 'email_verified', 'phone_verified', 'fully_verified'],
    default: 'unverified'
  }
}, {
  timestamps: true
});

userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 14);
  
  if (this.isEmailVerified && this.isPhoneVerified) {
    this.verificationLevel = 'fully_verified';
  } else if (this.isPhoneVerified) {
    this.verificationLevel = 'phone_verified';
  } else if (this.isEmailVerified) {
    this.verificationLevel = 'email_verified';
  }
  
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1, loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

userSchema.methods.generateEmailVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  return token;
};

userSchema.methods.generatePhoneVerificationToken = function() {
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  this.phoneVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.phoneVerificationExpires = Date.now() + 10 * 60 * 1000;
  return token;
};

userSchema.methods.generatePasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return token;
};

userSchema.methods.addSecurityFlag = function(type, reason, reportedBy) {
  this.securityFlags.push({
    type,
    reason,
    reportedBy,
    reportedAt: new Date(),
    status: 'pending'
  });
  return this.save();
};

userSchema.methods.recordLogin = function(ip, userAgent) {
  this.lastLogin = new Date();
  this.ipAddresses.push({
    ip,
    userAgent,
    timestamp: new Date()
  });
  
  if (this.ipAddresses.length > 10) {
    this.ipAddresses = this.ipAddresses.slice(-10);
  }
  
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
