const { isBookingSqlEnabled } = require('./db/featureFlag');
const { bookingSqlHealthcheck } = require('./db/healthcheck');
const { acquireSlotLock } = require('./db/locks');

module.exports = {
  isBookingSqlEnabled,
  bookingSqlHealthcheck,
  acquireSlotLock,
};
