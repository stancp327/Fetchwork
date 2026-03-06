const { PrismaClient } = require('@prisma/client');

function getPrisma() {
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
