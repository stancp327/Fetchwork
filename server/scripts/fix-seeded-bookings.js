/**
 * Fix seeded bookings: set serviceOfferingId on bookings + enable availability on services
 * Usage: node server/scripts/fix-seeded-bookings.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const User = require('../models/User');
  const Service = require('../models/Service');

  // Find admin users
  const admins = await User.find({
    $or: [{ role: 'admin' }, { role: 'both' }, { isAdmin: true }]
  }).select('_id firstName').lean();
  console.log(`Found ${admins.length} admin(s)`);

  // Enable availability on all admin services
  let svcUpdated = 0;
  for (const admin of admins) {
    const services = await Service.find({ freelancer: admin._id }).select('_id title availability').lean();
    for (const svc of services) {
      await Service.updateOne(
        { _id: svc._id },
        {
          $set: {
            'availability.enabled': true,
            'availability.slotDuration': svc.availability?.slotDuration || 60,
            'availability.maxPerSlot': svc.availability?.maxPerSlot || 1,
            'availability.bufferTime': svc.availability?.bufferTime || 0,
            'availability.maxAdvanceDays': svc.availability?.maxAdvanceDays || 60,
          }
        }
      );
      svcUpdated++;
      console.log(`  ✅ Enabled availability: ${svc.title} (${svc._id})`);
    }
  }
  console.log(`\nUpdated ${svcUpdated} services`);

  // Fix bookings: assign serviceOfferingId where missing
  // Match each booking's freelancerId to the service
  const bookings = await prisma.booking.findMany({
    where: { serviceOfferingId: null },
    select: { id: true, freelancerId: true, bookingRef: true },
  });
  console.log(`\nFound ${bookings.length} bookings with null serviceOfferingId`);

  let fixed = 0;
  for (const b of bookings) {
    // Skip non-ObjectId freelancerIds (test data)
    if (!b.freelancerId || !/^[a-f0-9]{24}$/.test(b.freelancerId)) {
      console.log(`  ⏭️  Skipping ${b.bookingRef} (non-ObjectId freelancerId: ${b.freelancerId})`);
      continue;
    }
    // Find a service for this freelancer
    const svc = await Service.findOne({ freelancer: b.freelancerId, 'availability.enabled': true })
      .select('_id')
      .lean();
    if (svc) {
      await prisma.booking.update({
        where: { id: b.id },
        data: { mongoServiceId: svc._id.toString() },
      });
      fixed++;
    } else {
      console.log(`  ⚠️  No service found for freelancer ${b.freelancerId} (booking ${b.bookingRef})`);
    }
  }

  console.log(`\n✅ Fixed ${fixed}/${bookings.length} bookings with serviceOfferingId`);

  await prisma.$disconnect();
  await mongoose.disconnect();
  console.log('Done!');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
