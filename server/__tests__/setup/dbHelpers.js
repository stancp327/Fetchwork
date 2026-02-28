/**
 * dbHelpers.js — per-test DB lifecycle helpers.
 * Import into integration tests:
 *   const { connectDB, clearDB, closeDB } = require('../setup/dbHelpers');
 */
const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI_TEST;
  if (!uri) throw new Error('MONGO_URI_TEST not set — is globalSetup running?');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { dbName: 'fetchwork_test' });
  }
};

const clearDB = async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map(c => c.deleteMany({}))
  );
};

const closeDB = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
};

module.exports = { connectDB, clearDB, closeDB };
