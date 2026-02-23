const mongoose = require('mongoose');

const savedSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemType: { type: String, enum: ['freelancer', 'job', 'service'], required: true },
  item: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'itemModel' },
  itemModel: { type: String, enum: ['User', 'Job', 'Service'], required: true },
  note: { type: String, maxlength: 200, default: '' }
}, { timestamps: true });

savedSchema.index({ user: 1, item: 1 }, { unique: true });
savedSchema.index({ user: 1, itemType: 1 });

module.exports = mongoose.model('Saved', savedSchema);
