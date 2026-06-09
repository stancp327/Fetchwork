/**
 * Backfill jobRef for existing jobs that don't have one.
 * Usage: node server/scripts/backfill-job-refs.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Create or get counter
  const Counter = mongoose.models.Counter || mongoose.model('Counter', new mongoose.Schema({
    _id: String,
    seq: { type: Number, default: 0 },
  }));

  const Job = require('../models/Job');
  
  const jobs = await Job.find({ $or: [{ jobRef: null }, { jobRef: '' }, { jobRef: { $exists: false } }] })
    .sort({ createdAt: 1 })
    .select('_id title createdAt');

  console.log(`Found ${jobs.length} jobs without jobRef`);

  for (const job of jobs) {
    const counter = await Counter.findByIdAndUpdate(
      'jobRef',
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const ref = `FW-${String(counter.seq).padStart(4, '0')}`;
    await Job.updateOne({ _id: job._id }, { $set: { jobRef: ref } });
    console.log(`  ${ref} → ${job.title}`);
  }

  console.log('Done!');
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
