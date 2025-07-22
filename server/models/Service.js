const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
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
    required: true,
    enum: [
      'web_development',
      'mobile_development', 
      'design',
      'writing',
      'marketing',
      'data_entry',
      'customer_service',
      'translation',
      'video_editing',
      'photography',
      'consulting',
      'other'
    ]
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
      deliveryTime: { type: Number, required: true, min: [1, 'Delivery time must be at least 1 day'] },
      revisions: { type: Number, default: 1 }
    },
    standard: {
      title: String,
      description: String,
      price: { type: Number, min: [5, 'Price must be at least $5'] },
      deliveryTime: { type: Number, min: [1, 'Delivery time must be at least 1 day'] },
      revisions: { type: Number, default: 2 }
    },
    premium: {
      title: String,
      description: String,
      price: { type: Number, min: [5, 'Price must be at least $5'] },
      deliveryTime: { type: Number, min: [1, 'Delivery time must be at least 1 day'] },
      revisions: { type: Number, default: 3 }
    }
  },
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
  orders: [{
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    package: { type: String, enum: ['basic', 'standard', 'premium'] },
    status: { type: String, enum: ['pending', 'in_progress', 'delivered', 'completed', 'cancelled'] },
    orderDate: { type: Date, default: Date.now },
    deliveryDate: Date,
    price: Number
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
  }
}, {
  timestamps: true
});

serviceSchema.index({ freelancer: 1 });
serviceSchema.index({ category: 1 });
serviceSchema.index({ skills: 1 });
serviceSchema.index({ 'pricing.basic.price': 1 });
serviceSchema.index({ rating: -1 });
serviceSchema.index({ isActive: 1, status: 1 });

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
