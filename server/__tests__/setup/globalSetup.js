/**
 * globalSetup — runs ONCE before all integration tests, in Jest's main process.
 * global.__MONGOD__ persists into globalTeardown (same process).
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI_TEST = mongod.getUri();
  global.__MONGOD__ = mongod;
};
