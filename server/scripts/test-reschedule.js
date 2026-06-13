require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('MongoDB connected');

  // Find a confirmed booking with mongoServiceId
  const booking = await prisma.booking.findFirst({
    where: { currentState: 'confirmed', mongoServiceId: { not: null } },
    include: { occurrences: true },
  });

  if (!booking) {
    console.log('No confirmed booking with mongoServiceId found');
    await prisma.$disconnect();
    return;
  }

  console.log('=== Test Booking ===');
  console.log('ID:', booking.id);
  console.log('Ref:', booking.bookingRef);
  console.log('mongoServiceId:', booking.mongoServiceId);
  console.log('serviceOfferingId:', booking.serviceOfferingId);
  console.log('clientId:', booking.clientId);
  console.log('freelancerId:', booking.freelancerId);
  console.log('State:', booking.currentState);
  if (booking.occurrences[0]) {
    const occ = booking.occurrences[0];
    console.log('Occurrence status:', occ.status);
    console.log('Occurrence start:', occ.localStartWallclock);
    console.log('Occurrence end:', occ.localEndWallclock);
  }

  // Now test the slot engine for this service
  const { SlotEngine } = require('../booking-sql/services/SlotEngine');
  const engine = new SlotEngine();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  console.log('\n=== Slots for', tomorrow, '===');
  const result = await engine.getSlotsForServiceDate({
    serviceId: booking.mongoServiceId,
    date: tomorrow,
  });
  console.log('Status:', result.statusCode);
  console.log('Slot count:', result.body.slots?.length || 0);
  console.log('Duration:', result.body.slotDurationMinutes, 'min');
  console.log('Source:', result.body.source);
  if (result.body.message) console.log('Message:', result.body.message);
  if (result.body.slots?.length) {
    console.log('First 3:', result.body.slots.slice(0, 3).map(s => s.displayTime));
  }

  // Test reschedule via BookingService
  const { BookingService } = require('../booking-sql/services');
  const bs = new BookingService();
  const targetSlot = result.body.slots?.[0];
  if (targetSlot) {
    console.log('\n=== Testing Reschedule ===');
    console.log('Moving to:', tomorrow, targetSlot.startTime, '-', targetSlot.endTime);
    const res = await bs.rescheduleBooking({
      actorId: booking.clientId,
      route: 'TEST',
      idempotencyKey: `test-${Date.now()}`,
      requestHash: 'test',
      bookingId: booking.id,
      newDate: tomorrow,
      newStartTime: targetSlot.startTime,
      newEndTime: targetSlot.endTime,
      reason: 'test',
    });
    console.log('Result:', JSON.stringify(res, null, 2));
  }

  await prisma.$disconnect();
  await mongoose.disconnect();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
