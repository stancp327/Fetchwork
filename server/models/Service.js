const mongoose = require('mongoose');
// categories.js is now open-ended; no enum constraint
const { locationSchema } = require('../config/locationSchema');

const serviceSchema = new mongoose.Schema({
  serviceType: {
    type: String,
    enum: ['one_time', 'recurring'],
    default: 'one_time',
  },
  recurring: {
    sessionDuration:  { type: Number },                        // minutes: 30, 45, 60, 90, 120
    billingCycle:     { type: String, enum: ['per_session', 'weekly', 'monthly'] },
    sessionsPerCycle: { type: Number },                        // e.g. 3 sessions/week
    locationType:     { type: String, enum: ['online', 'in_person', 'both'] },
    trialEnabled:     { type: Boolean, default: false },
    trialPrice:       { type: Number, min: 0 },
  },

  // Whether listed prices include platform fees (fees-included = client pays exactly the listed price)
  // false (default) = fees added on top of listed price at checkout
  // true            = fees are baked in; client pays exactly the listed price
  feesIncluded: { type: Boolean, default: false },

  // Deposit — require upfront partial payment (Pro only)
  deposit: {
    enabled:    { type: Boolean, default: false },
    type:       { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    amount:     { type: Number, default: 25 },  // 25% or $25 depending on type
    refundable: { type: Boolean, default: true },
  },

  // Travel fee — local service add-on (Pro only)
  travelFee: {
    enabled:  { type: Boolean, default: false },
    type:     { type: String, enum: ['flat', 'per_mile'], default: 'flat' },
    amount:   { type: Number, default: 0 },  // $ flat or $/mile
    freeWithinMiles: { type: Number, default: 0 }, // no charge within X miles
  },

  // Capacity controls (Plus+ only)
  capacity: {
    enabled:       { type: Boolean, default: false },
    maxPerDay:     { type: Number, default: null },  // null = unlimited
    maxPerWeek:    { type: Number, default: null },
    maxConcurrent: { type: Number, default: null },  // max active orders at once
    maxPerSlot:    { type: Number, default: 1 },     // 1 = 1:1 session; >1 = group/class
  },

  // Intake form — custom questions clients answer when ordering/booking
  intakeForm: {
    enabled: { type: Boolean, default: false },
    fields: [{
      label:       { type: String, required: true },           // "What's your dog's breed?"
      type:        { type: String, enum: ['text', 'textarea', 'select', 'checkbox', 'number', 'date'], default: 'text' },
      placeholder: { type: String, default: '' },
      required:    { type: Boolean, default: false },
      options:     [{ type: String }],                         // for select type
    }],
  },

  // Prepaid session bundles (e.g. "3 sessions for $80, 5 for $120")
  bundles: [{
    name:          { type: String, required: true, maxlength: 80 },
    sessions:      { type: Number, required: true, min: 2, max: 100 },
    price:         { type: Number, required: true, min: 5 },
    savings:       { type: Number, default: 0 },
    expiresInDays: { type: Number, default: null },
    active:        { type: Boolean, default: true },
    feesIncluded:  { type: Boolean, default: null }, // null = inherit from service-level setting
  }],

  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: true,
    maxlength: [3000, 'Description cannot exceed 3000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    maxlength: [100, 'Category name too long']
  },
  subcategory: {
    type: String,
    trim: true,
    default: ''
  },
  skills: [{
    type: String,
    trim: true
  }],
  pricing: {
    basic: {
      title: { type: String, required: true },
      description: { type: String, required: true },
      price: { type: Number, required: true, min: [5, 'Price must be at least $5'] },
      deliveryTime: { type: Number, min: [1, 'Delivery time must be at least 1 day'] },
      revisions: { type: Number, default: 1 },
      sessionsIncluded: { type: Number },
    },
    standard: {
      title: String,
      description: String,
      price: { type: Number, min: [5, 'Price must be at least $5'] },
      deliveryTime: { type: Number, min: [1, 'Delivery time must be at least 1 day'] },
      revisions: { type: Number, default: 2 },
      sessionsIncluded: { type: Number },
    },
    premium: {
      title: String,
      description: String,
      price: { type: Number, min: [5, 'Price must be at least $5'] },
      deliveryTime: { type: Number, min: [1, 'Delivery time must be at least 1 day'] },
      revisions: { type: Number, default: 3 },
      sessionsIncluded: { type: Number },
    }
  },
  location: locationSchema,
  freelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gallery: [{
    url: String,
    caption: String,
    type: { type: String, enum: ['image', 'video'], default: 'image' }
  }],
  faqs: [{
    question: { type: String, required: true },
    answer: { type: String, required: true }
  }],
  requirements: {
    type: String,
    maxlength: [1000, 'Requirements cannot exceed 1000 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'under_review'],
    default: 'draft'
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  },
  archiveReason: {
    type: String,
    enum: ['inactive', 'admin', null],
    default: null
  },
  orders: [{
    client:                { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    package:               { type: String, enum: ['basic', 'standard', 'premium'] },
    status:                { type: String, enum: ['pending', 'in_progress', 'delivered', 'completed', 'cancelled', 'revision_requested'], default: 'pending' },
    orderDate:             { type: Date, default: Date.now },
    deliveryDate:          Date,
    completedDate:         Date,
    price:                 Number,
    requirements:          String,
    stripePaymentIntentId: { type: String, default: null },
  stripeProductId:       { type: String, default: null },  // Stripe Product for recurring billing
    escrowAmount:          { type: Number, default: 0 },
    revisionCount:         { type: Number, default: 0 },
    deliveryNote:          String,
  }],
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },

  isBoosted: { type: Boolean, default: false },
  boostExpiresAt: { type: Date, default: null },
  boostPaymentId: { type: String, default: null },

  // ── Booking availability ────────────────────────────────────────
  availability: {
    enabled:      { type: Boolean, default: false },
    timezone:     { type: String, default: 'America/Los_Angeles' },
    windows: [{
      dayOfWeek:  { type: Number, min: 0, max: 6 }, // 0=Sunday
      startTime:  { type: String }, // "09:00" (24hr)
      endTime:    { type: String }, // "17:00"
    }],
    slotDuration:   { type: Number, default: 60 },  // minutes
    bufferTime:     { type: Number, default: 0 },    // minutes between slots
    maxAdvanceDays: { type: Number, default: 30 },   // how far ahead clients can book
    maxPerSlot:     { type: Number, default: 1 },    // 1 = private; >1 = group/class
  }
}, {
  timestamps: true
});

serviceSchema.index({ serviceType: 1 });
serviceSchema.index({ freelancer: 1 });
serviceSchema.index({ category: 1 });
serviceSchema.index({ skills: 1 });
serviceSchema.index({ 'pricing.basic.price': 1 });
serviceSchema.index({ rating: -1 });
serviceSchema.index({ isActive: 1, status: 1 });
serviceSchema.index({ 'location.locationType': 1 });
serviceSchema.index({ 'location.zipCode': 1 });
serviceSchema.index({ 'location.coordinates': '2dsphere' });
// Compound indexes for browse + text search
serviceSchema.index({ isActive: 1, status: 1, category: 1 }); // category page
serviceSchema.index({ freelancer: 1, isActive: 1, status: 1 }); // my services
serviceSchema.index({ title: 'text', description: 'text' }); // service search
// Archive index
serviceSchema.index({ isArchived: 1, archivedAt: -1 });
serviceSchema.index({ updatedAt: 1, isArchived: 1 }); // inactivity cron scan

serviceSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

serviceSchema.methods.addOrder = function(orderData) {
  this.orders.push(orderData);
  this.totalOrders = this.orders.length;
  return this.save();
};

serviceSchema.statics.findActiveServices = function() {
  return this.find({ 
    isActive: true, 
    status: 'active'
  });
};

serviceSchema.statics.findByCategory = function(category) {
  return this.find({ 
    category, 
    isActive: true, 
    status: 'active'
  });
};

module.exports = mongoose.model('Service', serviceSchema);
