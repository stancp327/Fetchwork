const mongoose = require('mongoose');

const skillAssessmentSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category:     { type: String, required: true },      // e.g. 'web_development'
  categoryLabel:{ type: String, required: true },      // e.g. 'Web Development'
  score:        { type: Number, required: true },      // 0–100
  passed:       { type: Boolean, required: true },     // true if score >= 80
  totalQ:       { type: Number, default: 10 },
  correctQ:     { type: Number, required: true },
  attempts:     { type: Number, default: 1 },
  completedAt:  { type: Date, default: Date.now },
  lastAttemptAt:{ type: Date, default: Date.now },
  badge:        {                                      // awarded on pass
    earned:   { type: Boolean, default: false },
    tier:     { type: String, enum: ['bronze', 'silver', 'gold'], default: 'bronze' },
    awardedAt:{ type: Date },
  },
}, { timestamps: true });

// Unique per user+category (one record, updated on retake)
skillAssessmentSchema.index({ userId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('SkillAssessment', skillAssessmentSchema);
