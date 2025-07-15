const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  budget: { type: Number, required: true, min: 1 },
  budgetType: { type: String, required: true, enum: ['fixed', 'hourly'] },
  deadline: { type: Date, required: true },
  skills: [{ type: String }],
  attachments: [{ 
    filename: String, 
    originalName: String, 
    size: Number,
    mimetype: String 
  }],
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'in-progress', 'review', 'completed', 'cancelled'],
    default: 'published' 
  },
  applications: [{ 
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    proposal: String,
    bidAmount: Number,
    appliedAt: { type: Date, default: Date.now }
  }],
  assignedFreelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: { type: Number, min: 0, max: 5 },
  reviews: { type: Number, default: 0 }
}, { timestamps: true });

jobSchema.index({ title: 'text', description: 'text', skills: 'text' });
jobSchema.index({ category: 1, status: 1 });
jobSchema.index({ budget: 1 });

module.exports = mongoose.model('Job', jobSchema);
