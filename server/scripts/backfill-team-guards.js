/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('../models/Team');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI (or MONGO_URI) in environment');
  }

  await mongoose.connect(uri);
  console.log('[backfill-team-guards] connected');

  const filter = {
    $or: [
      { lockVersion: { $exists: false } },
      { transferState: { $exists: false } },
      { transferTargetUserId: { $exists: false } },
    ],
  };

  const update = {
    $set: {
      lockVersion: 0,
      transferState: 'idle',
      transferTargetUserId: null,
    },
  };

  const before = await Team.countDocuments(filter);
  const result = await Team.updateMany(filter, update);
  const after = await Team.countDocuments(filter);

  console.log('[backfill-team-guards] docs needing backfill before:', before);
  console.log('[backfill-team-guards] matched:', result.matchedCount, 'modified:', result.modifiedCount);
  console.log('[backfill-team-guards] docs still needing backfill after:', after);

  await mongoose.disconnect();
  console.log('[backfill-team-guards] done');
}

main().catch(async (err) => {
  console.error('[backfill-team-guards] failed:', err.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
