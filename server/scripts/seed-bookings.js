/**
 * Seed sample bookings for admin users
 * Usage: node server/scripts/seed-bookings.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { PrismaClient } = require('@prisma/client');
const { DateTime } = require('luxon');
const crypto = require('crypto');

const prisma = new PrismaClient();
const TZ = 'America/Los_Angeles';

function makeRef() {
  return `SEED-${crypto.randomBytes(4).toString('hex')}`;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const User = require('../models/User');
  const Service = require('../models/Service');

  // Find admin users
  const admins = await User.find({
    $or: [{ role: 'admin' }, { role: 'both' }, { isAdmin: true }]
  }).select('_id firstName lastName email').lean();
  console.log(`Found ${admins.length} admin(s):`);
  admins.forEach(a => console.log(`  ${a._id} ${a.firstName} ${a.lastName} (${a.email})`));

  if (admins.length === 0) {
    console.log('No admins found, exiting.');
    process.exit(0);
  }

  // Find or create services for admins
  let services = await Service.find({
    freelancerId: { $in: admins.map(a => a._id) }
  }).select('_id title freelancerId').lean();

  if (services.length === 0) {
    console.log('Creating sample services...');
    for (const admin of admins) {
      const svc = await Service.create({
        title: `${admin.firstName}'s Consulting Session`,
        description: 'One-on-one consulting session.',
        freelancer: admin._id,
        freelancerId: admin._id,
        category: 'consulting',
        subcategory: 'business_strategy',
        serviceType: 'one_time',
        pricing: { basic: { title: 'Standard', price: 75, deliveryTime: 1, description: '1-hour session' } },
        status: 'active',
        bookingEnabled: true,
      });
      services.push({ _id: svc._id, title: svc.title, freelancerId: admin._id });
      console.log(`  Created: ${svc.title}`);
    }
  }
  console.log(`Services: ${services.length}`);

  // Ensure FreelancerAvailability exists in Prisma
  for (const admin of admins) {
    const fid = admin._id.toString();
    const existing = await prisma.freelancerAvailability.findUnique({ where: { freelancerId: fid } });
    if (!existing) {
      await prisma.freelancerAvailability.create({
        data: {
          freelancerId: fid,
          timezone: TZ,
          defaultSlotDuration: 60,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 15,
          defaultCapacity: 1,
          minNoticeHours: 1,
          maxAdvanceBookingDays: 60,
          isActive: true,
          weeklyScheduleJson: [
            { dayOfWeek: 1, windows: [{ startTime: '09:00', endTime: '17:00' }] },
            { dayOfWeek: 2, windows: [{ startTime: '09:00', endTime: '17:00' }] },
            { dayOfWeek: 3, windows: [{ startTime: '09:00', endTime: '17:00' }] },
            { dayOfWeek: 4, windows: [{ startTime: '09:00', endTime: '17:00' }] },
            { dayOfWeek: 5, windows: [{ startTime: '09:00', endTime: '17:00' }] },
          ],
        },
      });
      console.log(`  Availability created for ${admin.firstName}`);
    }
  }

  // Seed bookings
  const now = DateTime.now().setZone(TZ);
  let created = 0;

  for (const admin of admins) {
    const adminId = admin._id.toString();
    const adminSvcs = services.filter(s => s.freelancerId.toString() === adminId);
    const svc = adminSvcs[0] || services[0];
    const others = admins.filter(a => a._id.toString() !== adminId);

    // 6 bookings as freelancer: 3 upcoming, 3 past
    for (let i = 0; i < 6; i++) {
      const dayOffset = i < 3 ? (i + 1) : -(i - 2);
      const startHour = 9 + (i % 7);
      const status = i < 3 ? (i === 0 ? 'confirmed' : 'held') : 'completed';
      const client = others[i % Math.max(others.length, 1)] || admin;

      const startDt = now.plus({ days: dayOffset }).set({ hour: startHour, minute: 0, second: 0, millisecond: 0 });
      const endDt = startDt.plus({ hours: 1 });

      try {
        const booking = await prisma.booking.create({
          data: {
            bookingRef: makeRef(),
            clientId: client._id.toString(),
            freelancerId: adminId,
            serviceOfferingId: null,
            policySnapshotJson: { tier: 'moderate', refundRules: [] },
            pricingSnapshotJson: { amount: 7500, currency: 'usd', serviceTitle: svc.title },
            currentState: status,
            notes: `Sample: ${admin.firstName} provides service to ${client.firstName}`,
            occurrences: {
              create: {
                occurrenceNo: 1,
                clientId: client._id.toString(),
                freelancerId: adminId,
                startAtUtc: startDt.toUTC().toJSDate(),
                endAtUtc: endDt.toUTC().toJSDate(),
                timezone: TZ,
                localStartWallclock: startDt.toISO(),
                localEndWallclock: endDt.toISO(),
                status: status,
              },
            },
          },
        });
        created++;
      } catch (err) {
        console.error(`  ❌ ${err.message.slice(0, 80)}`);
      }
    }

    // 3 bookings as client (upcoming)
    for (let i = 0; i < 3; i++) {
      const freelancer = others[i % Math.max(others.length, 1)] || admin;
      const fSvc = services.find(s => s.freelancerId.toString() === freelancer._id.toString()) || svc;
      const startDt = now.plus({ days: i + 1 }).set({ hour: 13 + i, minute: 0, second: 0, millisecond: 0 });
      const endDt = startDt.plus({ hours: 1 });

      try {
        await prisma.booking.create({
          data: {
            bookingRef: makeRef(),
            clientId: adminId,
            freelancerId: freelancer._id.toString(),
            serviceOfferingId: null,
            policySnapshotJson: { tier: 'moderate', refundRules: [] },
            pricingSnapshotJson: { amount: 7500, currency: 'usd', serviceTitle: fSvc.title },
            currentState: 'confirmed',
            notes: `Sample: ${admin.firstName} booked ${freelancer.firstName}`,
            occurrences: {
              create: {
                occurrenceNo: 1,
                clientId: adminId,
                freelancerId: freelancer._id.toString(),
                startAtUtc: startDt.toUTC().toJSDate(),
                endAtUtc: endDt.toUTC().toJSDate(),
                timezone: TZ,
                localStartWallclock: startDt.toISO(),
                localEndWallclock: endDt.toISO(),
                status: 'confirmed',
              },
            },
          },
        });
        created++;
      } catch (err) {
        console.error(`  ❌ ${err.message.slice(0, 80)}`);
      }
    }
  }

  console.log(`\n✅ Created ${created} bookings for ${admins.length} admin(s)`);
  console.log('Each admin got ~6 as freelancer + ~3 as client');

  await prisma.$disconnect();
  await mongoose.disconnect();
  console.log('Done!');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
