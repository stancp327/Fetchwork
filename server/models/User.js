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
  userType: {
    type: String,
    enum: ['client', 'freelancer'],
    required: true
  },
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
