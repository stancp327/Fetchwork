const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    enum: ['freelancer', 'client'],
    required: true
  },
  bio: {
    type: String,
    default: ''
  },
  skills: [{
    type: String
  }],
  hourlyRate: {
    type: Number,
    default: 0
  },
  location: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  website: {
    type: String,
    default: ''
  },
  profilePicture: {
    type: String,
    default: ''
  },
  workHistory: [{
    title: String,
    company: String,
    duration: String,
    description: String,
    startDate: Date,
    endDate: Date
  }],
  portfolio: [{
    title: String,
    description: String,
    imageUrl: String,
    projectUrl: String,
    technologies: [String],
    completedDate: Date
  }],
  rating: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationBadges: [{
    type: String,
    enum: ['email', 'phone', 'identity', 'payment']
  }],
  totalEarnings: {
    type: Number,
    default: 0
  },
  completedJobs: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
