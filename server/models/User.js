const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: [6, 'Password must be at least 6 characters long']
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  profilePicture: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  skills: [{
    type: String,
    trim: true
  }],
  hourlyRate: {
    type: Number,
    min: [0, 'Hourly rate cannot be negative'],
    default: 0
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationLevel: {
    type: String,
    enum: ['none', 'email', 'phone', 'identity', 'full'],
    default: 'none'
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  completedJobs: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspensionReason: {
    type: String,
    default: ''
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  accountType: {
    type: String,
    enum: ['client', 'freelancer', 'both'],
    default: 'both'
  },
  preferences: {
    emailNotifications: {
      jobAlerts: { type: Boolean, default: true },
      proposalUpdates: { type: Boolean, default: true },
      paymentNotifications: { type: Boolean, default: true },
      systemUpdates: { type: Boolean, default: true },
      marketingEmails: { type: Boolean, default: false },
      weeklyDigest: { type: Boolean, default: true }
    },
    notificationFrequency: {
      type: String,
      enum: ['immediate', 'daily', 'weekly'],
      default: 'immediate'
    },
    smsNotifications: { type: Boolean, default: false }
  },
  socialLinks: {
    linkedin: String,
    github: String,
    portfolio: String,
    twitter: String
  },
  bankAccount: {
    accountNumber: String,
    routingNumber: String,
    accountHolderName: String,
    bankName: String
  },
  paypalEmail: String,
  stripeAccountId: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  googleId: String,
  facebookId: String,
  providers: [{
    type: String,
    enum: ['local', 'google', 'facebook'],
    default: 'local'
  }],
  isAdminPromoted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

userSchema.index({ email: 1 });
userSchema.index({ email: 1, isVerified: 1 });
userSchema.index({ skills: 1 });
userSchema.index({ location: 1 });
userSchema.index({ rating: -1 });
userSchema.index({ isActive: 1, isSuspended: 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpires;
  delete userObject.emailVerificationToken;
  delete userObject.emailVerificationExpires;
  delete userObject.bankAccount;
  delete userObject.paypalEmail;
  delete userObject.stripeAccountId;
  return userObject;
};

userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

userSchema.methods.calculateRating = async function() {
  const Review = mongoose.model('Review');
  const reviews = await Review.find({ freelancer: this._id });
  
  if (reviews.length === 0) {
    this.rating = 0;
    this.totalReviews = 0;
  } else {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating = Math.round((totalRating / reviews.length) * 10) / 10;
    this.totalReviews = reviews.length;
  }
  
  return this.save();
};

userSchema.methods.suspend = function(reason) {
  this.isSuspended = true;
  this.suspensionReason = reason;
  this.isActive = false;
  return this.save();
};

userSchema.methods.unsuspend = function() {
  this.isSuspended = false;
  this.suspensionReason = '';
  this.isActive = true;
  return this.save();
};

userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true, isSuspended: false });
};

userSchema.statics.findBySkill = function(skill) {
  return this.find({ 
    skills: { $in: [new RegExp(skill, 'i')] },
    isActive: true,
    isSuspended: false 
  });
};

userSchema.statics.getTopRated = function(limit = 10) {
  return this.find({ 
    isActive: true, 
    isSuspended: false,
    rating: { $gt: 0 }
  })
  .sort({ rating: -1, totalReviews: -1 })
  .limit(limit);
};

module.exports = mongoose.model('User', userSchema);
