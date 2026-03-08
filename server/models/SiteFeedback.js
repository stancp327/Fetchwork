const mongoose = require('mongoose');

const SiteFeedbackSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = guest
  email:     { type: String, trim: true, lowercase: true },
  category:  { type: String, enum: ['bug', 'suggestion', 'praise', 'question', 'other'], default: 'other' },
  message:   { type: String, required: true, maxlength: 2000 },
  page:      { type: String, trim: true },       // current page URL at time of submission
  userAgent: { type: String },                   // browser info
  status:    { type: String, enum: ['new', 'read', 'actioned', 'closed'], default: 'new' },
  adminNote: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('SiteFeedback', SiteFeedbackSchema);
