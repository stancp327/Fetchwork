/**
 * Delete old SEED bookings and reseed with future dates
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('MongoDB connected');

  // Delete old seeded bookings (by SEED- prefix)
  const oldBookings = await prisma.booking.findMany({
    where: { bookingRef: { startsWith: 'SEED-' } },
    select: { id: true },
  });
  console.log(`Found ${oldBookings.length} old SEED bookings to delete`);

  if (oldBookings.length > 0) {
    // Delete occurrences first (FK constraint)
    await prisma.bookingOccurrence.deleteMany({
      where: { bookingId: { in: oldBookings.map(b => b.id) } },
    });
    // Delete audit events
    await prisma.auditEvent.deleteMany({
      where: { bookingId: { in: oldBookings.map(b => b.id) } },
    });
    // Delete idempotency records if any
    try { await prisma.idempotencyRecord.deleteMany({}); } catch {};
    // Delete bookings
    await prisma.booking.deleteMany({
      where: { bookingRef: { startsWith: 'SEED-' } },
    });
    console.log(`Deleted ${oldBookings.length} old bookings + occurrences`);
  }

  await prisma.$disconnect();
  await mongoose.disconnect();
  console.log('Done! Now run: node server/scripts/seed-bookings.js');
}

main().catch(e => { console.error(e); process.exit(1); });
