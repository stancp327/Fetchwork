const mongoose = require('mongoose');

const teamClientSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accessLevel: {
    type: String,
    enum: ['view_assigned', 'view_all', 'collaborate'],
    default: 'view_assigned',
  },
  projectLabel: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

teamClientSchema.index({ team: 1, client: 1 }, { unique: true });

teamClientSchema.statics.findActiveForTeam = function(teamId) {
  return this.find({ team: teamId, isActive: true })
    .populate('client', 'firstName lastName email profileImage')
    .populate('addedBy', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('TeamClient', teamClientSchema);
