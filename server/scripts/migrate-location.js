/**
 * Migration: Convert old string-based location fields to new structured location schema
 * Safe to run multiple times (idempotent)
 * 
 * Usage: MONGO_URI=<uri> node server/scripts/migrate-location.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

async function migrate() {
  if (!MONGO_URI) {
    console.error('MONGO_URI not set. Pass it as env var or add to server/.env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;

  // --- Users ---
  const users = db.collection('users');
  const userDocs = await users.find({ 'location': { $type: 'string' } }).toArray();
  console.log(`Users to migrate: ${userDocs.length}`);
  for (const doc of userDocs) {
    const oldLocation = doc.location || '';
    await users.updateOne({ _id: doc._id }, {
      $set: {
        location: {
          locationType: 'remote',
          address: oldLocation,
          city: '',
          state: '',
          zipCode: '',
          coordinates: { type: 'Point', coordinates: [0, 0] },
          serviceRadius: 25
        }
      }
    });
  }
  console.log(`Users migrated: ${userDocs.length}`);

  // --- Jobs ---
  const jobs = db.collection('jobs');
  const jobDocs = await jobs.find({ 'location': { $type: 'string' } }).toArray();
  console.log(`Jobs to migrate: ${jobDocs.length}`);
  for (const doc of jobDocs) {
    const oldLocation = doc.location || 'Remote';
    const isRemote = doc.isRemote !== false;
    await jobs.updateOne({ _id: doc._id }, {
      $set: {
        location: {
          locationType: isRemote ? 'remote' : 'local',
          address: isRemote ? '' : oldLocation,
          city: '',
          state: '',
          zipCode: '',
          coordinates: { type: 'Point', coordinates: [0, 0] },
          serviceRadius: 25
        }
      },
      $unset: { isRemote: '' }
    });
  }
  console.log(`Jobs migrated: ${jobDocs.length}`);

  // --- Services ---
  const services = db.collection('services');
  const serviceDocs = await services.find({ 'location': { $exists: false } }).toArray();
  console.log(`Services to migrate (add location): ${serviceDocs.length}`);
  for (const doc of serviceDocs) {
    await services.updateOne({ _id: doc._id }, {
      $set: {
        location: {
          locationType: 'remote',
          address: '',
          city: '',
          state: '',
          zipCode: '',
          coordinates: { type: 'Point', coordinates: [0, 0] },
          serviceRadius: 25
        }
      }
    });
  }
  console.log(`Services migrated: ${serviceDocs.length}`);

  console.log('Migration complete!');
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
