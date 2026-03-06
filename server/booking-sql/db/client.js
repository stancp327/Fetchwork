let PrismaClient;
try {
  PrismaClient = require('@prisma/client').PrismaClient;
} catch (e) {
  console.error('[booking-sql] @prisma/client not ready — run "prisma generate". SQL routes will return 503.');
}

function getPrisma() {
  if (!PrismaClient) {
    throw new Error('@prisma/client not initialized — run "prisma generate" and restart the server.');
  }
  if (!global.__bookingPrisma) {
    global.__bookingPrisma = new PrismaClient({
      log: String(process.env.BOOKING_SQL_LOG_LEVEL || 'info').toLowerCase() === 'debug'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    });
  }
  return global.__bookingPrisma;
}

module.exports = { getPrisma };
