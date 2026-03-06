import { PrismaClient } from '../../generated/prisma';

let prisma: PrismaClient;

if (!(global as any).__bookingPrisma) {
  (global as any).__bookingPrisma = new PrismaClient({
    log: (process.env.BOOKING_SQL_LOG_LEVEL === 'debug') ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
  });
}

prisma = (global as any).__bookingPrisma;

export { prisma };
