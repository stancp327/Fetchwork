const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  allDay: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: ['deadline', 'meeting', 'milestone', 'reminder', 'task'],
    required: true
  },
  relatedJob: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  relatedMilestone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectMilestone'
  },
  relatedTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    }
  }],
  reminder: {
    enabled: {
      type: Boolean,
      default: true
    },
    time: {
      type: Number,
      default: 60
    },
    unit: {
      type: String,
      enum: ['minutes', 'hours', 'days'],
      default: 'minutes'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

calendarEventSchema.index({ startDate: 1 });
calendarEventSchema.index({ endDate: 1 });
calendarEventSchema.index({ type: 1 });
calendarEventSchema.index({ relatedJob: 1 });
calendarEventSchema.index({ 'participants.user': 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
