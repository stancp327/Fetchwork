const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { locationSchema } = require('../config/locationSchema');

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
    required: function() {
      // Password not required for OAuth users (Google/Facebook)
      return !this.googleId && !this.facebookId;
    },
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
  location: locationSchema,
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isEmailVerified: {
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
  stripeAccountId:  String,           // Connect account (freelancer payouts)

  // ── Calendar integration ──────────────────────────────────────────────
  icalSecret:            { type: String, select: false, default: () => require('crypto').randomUUID() }, // rotatable UUID for iCal feed URL
  googleCalConnected:    { type: Boolean, default: false },
  googleCalendarId:      { type: String,  default: 'primary' },
  googleCalTokenExpiry:  Date,
  googleCalRefreshToken: { type: String,  select: false }, // AES-256 encrypted
  googleCalAccessToken:  { type: String,  select: false }, // AES-256 encrypted

  stripeConnected:  { type: Boolean, default: false },
  stripeCustomerId: String,           // Customer ID (client saved payment methods)
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
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  permissions: {
    type: [String],
    default: [],
    // Available: user_management, job_management, content_moderation,
    // payment_management, dispute_management, analytics_view, fee_waiver,
    // user_impersonation, system_settings
  },
  feeWaiver: {
    enabled: { type: Boolean, default: false },
    reason: { type: String, default: '' },
    waivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    waivedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }, // null = permanent
    maxJobs: { type: Number, default: null }, // null = unlimited
    jobsUsed: { type: Number, default: 0 }
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    lowercase: true,
    trim: true
  },
  headline: { type: String, default: '' },
  tagline: { type: String, default: '' },
  languages: [{ name: String, level: String }],
  experience: [{ company: String, role: String, startDate: Date, endDate: Date, description: String }],
  education: [{ school: String, degree: String, startDate: Date, endDate: Date }],
  certifications: [{ name: String, issuer: String, date: Date, credentialUrl: String }],
  portfolio: [{
    title: String,
    description: String,
    mediaUrls: [String],
    mediaType: { type: String, enum: ['image', 'video', 'pdf', 'other'], default: 'image' },
    links: [String],
    watermarked: { type: Boolean, default: false }
  }],
  preferencesExtended: {
    availabilityHours: Number,
    availabilityDays: [String],
    remote: { type: Boolean, default: true },
    local: { type: Boolean, default: false },
    rateType: { type: String, enum: ['hourly', 'fixed'], default: 'hourly' },
    minProject: Number
  },
  socialLinksExtended: {
    behance: String,
    dribbble: String
  },
  availabilityStatus: {
    type: String,
    enum: ['available', 'busy', 'not_taking_work', 'away'],
    default: 'available'
  },
  availabilityNote: {
    type: String,
    maxlength: 200,
    default: ''
  },
  bannerUrl: { type: String, default: '' },
  visibility: {
    showEmail: { type: Boolean, default: false },
    showPhone: { type: Boolean, default: false },
    sharePortfolioOnlyViaInvite: { type: Boolean, default: false }
  },
  modes: {
    freelancer: { type: Boolean, default: true },
    client: { type: Boolean, default: false }
  },
  profileCompletion: { type: Number, default: 0 },
  badges: { type: [String], default: [] },
  // ID Verification
  idVerification: {
    status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    documentType: { type: String, enum: ['drivers_license', 'passport', 'national_id', 'other', ''], default: '' },
    documentUrl: { type: String, default: '' }, // stored securely, admin-only access
    selfieUrl: { type: String, default: '' },
    submittedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    notes: { type: String, default: '' }
  },
  // Background check (future)
  backgroundCheck: {
    status: { type: String, enum: ['none', 'pending', 'passed', 'failed'], default: 'none' },
    provider: { type: String, default: '' },
    completedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }
  },
  // Trust signals
  lastSeen: { type: Date, default: null },           // set on socket disconnect
  avgResponseTime: { type: Number, default: null }, // minutes (rolling EMA)
  completionRate: { type: Number, default: 100 }, // percentage
  totalJobsCancelled: { type: Number, default: 0 },
  onTimeDelivery: { type: Number, default: 100 }, // percentage
  repeatClientRate: { type: Number, default: 0 } // percentage

}, {
  timestamps: true
});

userSchema.index({ email: 1 });
userSchema.index({ email: 1, isVerified: 1 });
userSchema.index({ skills: 1 });
userSchema.index({ 'location.locationType': 1 });
userSchema.index({ 'location.zipCode': 1 });
userSchema.index({ 'location.coordinates': '2dsphere' });
userSchema.index({ rating: -1 });
userSchema.index({ isActive: 1, isSuspended: 1 });
userSchema.index({ username: 1 }, { unique: true, sparse: true });
// Compound indexes for freelancer browse (accountType used in $or filter)
userSchema.index({ accountType: 1 });
userSchema.index({ accountType: 1, isActive: 1, rating: -1 }); // sorted freelancer browse


userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(14);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Check if fee waiver is currently active
userSchema.methods.isFeeWaived = function() {
  if (!this.feeWaiver?.enabled) return false;
  if (this.feeWaiver.expiresAt && new Date() > this.feeWaiver.expiresAt) return false;
  if (this.feeWaiver.maxJobs && this.feeWaiver.jobsUsed >= this.feeWaiver.maxJobs) return false;
  return true;
};

// Increment fee waiver usage (call after each job completion)
userSchema.methods.useFeeWaiverJob = async function() {
  if (this.isFeeWaived()) {
    this.feeWaiver.jobsUsed = (this.feeWaiver.jobsUsed || 0) + 1;
    if (this.feeWaiver.maxJobs && this.feeWaiver.jobsUsed >= this.feeWaiver.maxJobs) {
      this.feeWaiver.enabled = false; // Auto-disable when limit reached
    }
    await this.save();
  }
};

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
  delete userObject.stripeCustomerId;  // never expose Stripe internal IDs
  delete userObject.icalSecret;
  delete userObject.googleCalRefreshToken;
  delete userObject.googleCalAccessToken;
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

userSchema.methods.deleteUser = function(reason) {
  this.isActive = false;
  this.suspensionReason = reason || 'Account deleted by admin';
  this.isSuspended = true;
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
