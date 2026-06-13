/**
 * Open up availability for all admin users (7 days, 7am-10pm, no buffers)
 * Usage: node server/scripts/open-availability.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const User = require('../models/User');

  const admins = await User.find({
    $or: [{ role: 'admin' }, { role: 'both' }, { isAdmin: true }]
  }).select('_id firstName lastName').lean();
  console.log(`Found ${admins.length} admin(s)`);

  const fullWeek = [0, 1, 2, 3, 4, 5, 6].map(d => ({
    dayOfWeek: d,
    windows: [{ startTime: '07:00', endTime: '22:00' }],
  }));

  for (const a of admins) {
    const fid = a._id.toString();
    const existing = await prisma.freelancerAvailability.findUnique({ where: { freelancerId: fid } });

    const data = {
      weeklyScheduleJson: fullWeek,
      isActive: true,
      minNoticeHours: 0,
      maxAdvanceBookingDays: 90,
      defaultSlotDuration: 15,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    };

    if (existing) {
      await prisma.freelancerAvailability.update({ where: { freelancerId: fid }, data });
      console.log(`  ✅ Updated: ${a.firstName} ${a.lastName}`);
    } else {
      await prisma.freelancerAvailability.create({
        data: {
          freelancerId: fid,
          timezone: 'America/Los_Angeles',
          defaultCapacity: 1,
          ...data,
        },
      });
      console.log(`  ✅ Created: ${a.firstName} ${a.lastName}`);
    }
  }

  await prisma.$disconnect();
  await mongoose.disconnect();
  console.log('\nDone! All admins: 7 days/week, 7am–10pm, 15-min slots, no buffers, no min notice.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
