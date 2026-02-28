const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const participantSchema = new mongoose.Schema(
  {
    client:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:          { type: String, enum: ['confirmed', 'cancelled', 'no_show'], default: 'confirmed' },
    price:           Number,          // per-person price
    paymentIntentId: String,
    joinedAt:        { type: Date, default: Date.now },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    job:        { type: mongoose.Schema.Types.ObjectId, ref: 'Job'  },
    service:    { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },

    // Time — always UTC in DB, display in freelancerTimezone
    startTime:          { type: Date, required: true },
    endTime:            { type: Date, required: true },
    duration:           { type: Number, required: true }, // minutes
    freelancerTimezone: { type: String, required: true }, // IANA snapshot at booking time

    // Group session support
    capacity:     { type: Number, default: 1 },
    participants: [participantSchema],

    status: {
      type:    String,
      enum:    ['hold', 'confirmed', 'cancelled', 'completed', 'no_show'],
      default: 'hold',
    },
    holdExpiresAt: Date, // null once confirmed

    // Location
    locationType: { type: String, enum: ['in_person', 'virtual', 'phone'], default: 'virtual' },
    location:     String,

    // Financials
    price:              Number,
    cancellationPolicy: { type: String, enum: ['flexible', 'moderate', 'strict'], default: 'flexible' },
    cancellationFee:    { type: Number, default: 0 },

    // Calendar sync — populated async after confirm
    googleCalEventIdFreelancer: { type: String, select: false },
    googleCalEventIdClient:     { type: String, select: false },
    calendarSyncStatus: {
      type:    String,
      enum:    ['pending', 'synced', 'failed', 'unlinked'],
      default: 'pending',
    },
    icalUid: { type: String, default: uuidv4 },

    // Reminders
    reminder24hSent: { type: Boolean, default: false },
    reminder1hSent:  { type: Boolean, default: false },

    // Notes + audit
    clientNotes:        String,
    cancelledAt:        Date,
    cancellationReason: String,
    cancelledBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────
// Critical: overlap detection query
bookingSchema.index({ freelancer: 1, status: 1, startTime: 1, endTime: 1 });

// Client's upcoming/past bookings
bookingSchema.index({ 'participants.client': 1, startTime: 1, status: 1 });

// Freelancer dashboard
bookingSchema.index({ freelancer: 1, startTime: 1, status: 1 });

// Expired hold cleanup (sparse — only docs with holdExpiresAt set)
bookingSchema.index({ holdExpiresAt: 1 }, { sparse: true });

// iCal feed lookup
bookingSchema.index({ icalUid: 1 }, { unique: true });

// ── Virtuals ───────────────────────────────────────────────────────────────
bookingSchema.virtual('activeParticipantCount').get(function () {
  return (this.participants || []).filter(p => p.status !== 'cancelled').length;
});

bookingSchema.virtual('spotsRemaining').get(function () {
  return Math.max(0, this.capacity - this.activeParticipantCount);
});

// ── Helpers ────────────────────────────────────────────────────────────────
bookingSchema.methods.calcCancellationFee = function () {
  const hoursUntil = (new Date(this.startTime) - Date.now()) / 3600000;
  const price      = this.price || 0;
  switch (this.cancellationPolicy) {
    case 'flexible': return 0;
    case 'moderate': return hoursUntil >= 1 ? 0 : +(price * 0.10).toFixed(2);
    case 'strict':
      if (hoursUntil >= 24) return 0;
      if (hoursUntil >= 1)  return +(price * 0.25).toFixed(2);
      return +(price * 0.50).toFixed(2);
    default: return 0;
  }
};

module.exports = mongoose.model('Booking', bookingSchema);
