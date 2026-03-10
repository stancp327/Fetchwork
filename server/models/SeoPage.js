const mongoose = require('mongoose');

// Per-page SEO overrides
const seoPageSchema = new mongoose.Schema({
  path: { type: String, required: true, unique: true, trim: true }, // e.g. '/', '/jobs'
  label: { type: String, required: true },                           // human-readable name
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  keywords: { type: String, default: '' },
  ogImage: { type: String, default: '' },
  noIndex: { type: Boolean, default: false },
  enabled: { type: Boolean, default: true }, // false = use component defaults
}, { timestamps: true });

// Global SEO on/off toggle (stored as path='__global__')
const SeoPage = mongoose.model('SeoPage', seoPageSchema);

module.exports = SeoPage;
