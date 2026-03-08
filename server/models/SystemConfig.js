const mongoose = require('mongoose');

/**
 * SystemConfig — key/value store for platform-wide settings.
 * One document per namespace (e.g. namespace='ai_features').
 */
const SystemConfigSchema = new mongoose.Schema({
  namespace: { type: String, required: true, unique: true, trim: true },
  data:      { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);
