const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  service:     { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  client:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:        { type: Date, required: true },
  startTime:   { type: String, required: true },  // "09:00"
  endTime:     { type: String, required: true },   // "10:00"
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'waitlisted'],
    default: 'pending',
  },
  notes:              { type: String, default: '' },
  cancellationReason: { type: String, default: '' },
  cancelledBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledAt:        { type: Date },
}, { timestamps: true });

bookingSchema.index({ service: 1, date: 1 });
bookingSchema.index({ freelancer: 1, date: 1 });
bookingSchema.index({ client: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
