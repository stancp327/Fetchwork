const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Web Development',
      'Mobile Development', 
      'Design',
      'Writing',
      'Data Science',
      'Marketing',
      'Video & Animation',
      'Music & Audio',
      'Programming & Tech',
      'Business',
      'Home Improvement',
      'Cleaning',
      'Moving',
      'Tutoring',
      'Personal Care',
      'Event Services',
      'Automotive',
      'Pet Services'
    ]
  },
  locationType: {
    type: String,
    enum: ['remote', 'local', 'hybrid'],
    required: true,
    default: 'remote'
  },
  location: {
    address: String,
    city: String,
    state: String,
    zipCode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  budget: {
    amount: {
      type: Number,
      required: true,
      min: 1
    },
    type: {
      type: String,
      enum: ['fixed', 'hourly'],
      required: true
    }
  },
  skills: [{
    type: String,
    trim: true
  }],
  duration: {
    type: String,
    enum: ['less-than-1-month', '1-3-months', '3-6-months', 'more-than-6-months'],
    required: true
  },
  experienceLevel: {
    type: String,
    enum: ['entry', 'intermediate', 'expert'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'in-progress', 'completed', 'cancelled'],
    default: 'active'
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  applications: [{
    freelancer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    coverLetter: {
      type: String,
      required: true
    },
    proposedBudget: {
      amount: Number,
      type: String
    },
    timeline: String,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    }
  }],
  deadline: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

jobSchema.index({ title: 'text', description: 'text' });
jobSchema.index({ category: 1 });
jobSchema.index({ 'budget.amount': 1 });
jobSchema.index({ status: 1 });
jobSchema.index({ client: 1 });

module.exports = mongoose.model('Job', jobSchema);
