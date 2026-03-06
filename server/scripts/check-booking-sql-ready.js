require('dotenv').config();

const { isBookingSqlEnabled } = require('../booking-sql/db/featureFlag');
const { bookingSqlHealthcheck } = require('../booking-sql/db/healthcheck');

(async () => {
  const enabled = isBookingSqlEnabled();
  const hasDbUrl = !!process.env.DATABASE_URL;

  if (!enabled) {
    console.log('BOOKING_SQL_ENABLED=false');
    process.exit(0);
  }

  if (!hasDbUrl) {
    console.error('DATABASE_URL is missing');
    process.exit(1);
  }

  const health = await bookingSqlHealthcheck();
  if (!health.ok) {
    console.error('Booking SQL DB healthcheck failed:', health.error || 'unknown');
    process.exit(1);
  }

  console.log('Booking SQL ready: enabled + DB healthy');
  process.exit(0);
})();
