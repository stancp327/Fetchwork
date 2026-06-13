/**
 * Set varied durations + buffers on admin services for testing
 * Usage: node server/scripts/vary-admin-availability.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONFIGS = [
  { label: '30-min + 15-min buffer', slotDuration: 30, buffer: 15 },
  { label: '45-min + 10-min buffer', slotDuration: 45, buffer: 10 },
  { label: '1-hour + no buffer',     slotDuration: 60, buffer: 0  },
  { label: '90-min + 30-min buffer', slotDuration: 90, buffer: 30 },
  { label: '15-min + 5-min buffer',  slotDuration: 15, buffer: 5  },
  { label: '2-hour + 15-min buffer', slotDuration: 120, buffer: 15 },
  { label: '1-hour + 15-min buffer', slotDuration: 60, buffer: 15 },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const User = require('../models/User');
  const Service = require('../models/Service');

  const admins = await User.find({
    $or: [{ role: 'admin' }, { role: 'both' }, { isAdmin: true }]
  }).select('_id firstName lastName').lean();

  for (let i = 0; i < admins.length; i++) {
    const admin = admins[i];
    const cfg = CONFIGS[i % CONFIGS.length];
    const fid = admin._id.toString();

    // Update Mongo services
    const services = await Service.find({ freelancer: admin._id }).select('_id title');
    for (const svc of services) {
      svc.availability = {
        ...svc.availability,
        enabled: true,
        slotDuration: cfg.slotDuration,
        bufferTime: cfg.buffer,
        maxPerSlot: cfg.slotDuration <= 30 ? 1 : (i % 3 === 0 ? 5 : 1), // some group, some individual
        maxAdvanceDays: 60,
      };
      await svc.save();
    }

    // Update Prisma FreelancerAvailability
    await prisma.freelancerAvailability.updateMany({
      where: { freelancerId: fid },
      data: {
        defaultSlotDuration: cfg.slotDuration,
        bufferAfterMinutes: cfg.buffer,
        bufferBeforeMinutes: 0,
      },
    });

    console.log(`  ${admin.firstName} ${admin.lastName}: ${cfg.label} (${services.length} services)`);
  }

  await prisma.$disconnect();
  await mongoose.disconnect();
  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
