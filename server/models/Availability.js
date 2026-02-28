const mongoose = require('mongoose');

const windowSchema = new mongoose.Schema(
  { startTime: { type: String, required: true }, endTime: { type: String, required: true } },
  { _id: false }
);

const dayScheduleSchema = new mongoose.Schema(
  { dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, windows: [windowSchema] },
  { _id: false }
);

const exceptionSchema = new mongoose.Schema(
  {
    date:        { type: String, required: true }, // "YYYY-MM-DD" in freelancer's local tz
    unavailable: { type: Boolean, default: true },
    windows:     [windowSchema],                  // only used when unavailable: false
  },
  { _id: false }
);

const availabilitySchema = new mongoose.Schema(
  {
    freelancer: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
    },
    timezone:              { type: String, default: 'America/Los_Angeles' },
    defaultSlotDuration:   { type: Number, default: 60  }, // minutes
    bufferTime:            { type: Number, default: 0   }, // minutes between slots
    defaultCapacity:       { type: Number, default: 1   }, // 1=individual, >1=group session
    minNoticeHours:        { type: Number, default: 24  }, // can't book < X hours from now
    maxAdvanceBookingDays: { type: Number, default: 60  }, // can't book > X days out
    isActive:              { type: Boolean, default: true },

    weeklySchedule: [dayScheduleSchema],
    exceptions:     [exceptionSchema],
  },
  { timestamps: true }
);

availabilitySchema.index({ freelancer: 1 }, { unique: true });

module.exports = mongoose.model('Availability', availabilitySchema);
