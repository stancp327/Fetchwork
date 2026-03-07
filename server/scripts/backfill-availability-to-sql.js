#!/usr/bin/env node
/**
 * backfill-availability-to-sql.js
 *
 * One-time migration: reads every Mongo Service doc that has availability
 * enabled and upserts a FreelancerAvailability row in Prisma (Neon/Postgres).
 *
 * Safe to re-run — uses upsert (update wins if already exists).
 *
 * Usage:
 *   node server/scripts/backfill-availability-to-sql.js [--dry-run]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const mongoose   = require('mongoose');
const { getPrisma } = require('../booking-sql/db/client');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  console.log(`\n🔄  Backfill: Mongo Service.availability → SQL FreelancerAvailability`);
  console.log(`    Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}\n`);

  // ── Connect Mongo ──────────────────────────────────────────────
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('✅  Mongo connected');

  const prisma = getPrisma();

  // ── Load all services with availability set ────────────────────
  const Service = require('../models/Service');
  const services = await Service.find({
    'availability.enabled': true,
    'availability.windows': { $exists: true, $ne: [] },
  })
    .select('_id freelancer availability title')
    .lean();

  console.log(`📋  Found ${services.length} services with availability enabled\n`);

  let created = 0, updated = 0, skipped = 0, errors = 0;

  for (const svc of services) {
    const freelancerId = svc.freelancer?.toString();
    if (!freelancerId) { skipped++; continue; }

    const avail = svc.availability;
    const payload = {
      freelancerId,
      isActive:             avail.enabled !== false,
      timezone:             avail.timezone || 'America/Los_Angeles',
      weeklyScheduleJson:   Array.isArray(avail.windows) ? avail.windows : [],
      defaultSlotDuration:  Number(avail.slotDuration)   || 60,
      bufferTime:           Number(avail.bufferTime)      || 0,
      maxAdvanceBookingDays: Number(avail.maxAdvanceDays) || 30,
      defaultCapacity:      Number(avail.maxPerSlot)      || 1,
    };

    console.log(`  Service "${svc.title}" → freelancer ${freelancerId}`);
    console.log(`    timezone=${payload.timezone}, slotDuration=${payload.defaultSlotDuration}m, windows=${payload.weeklyScheduleJson.length}`);

    if (DRY_RUN) { skipped++; continue; }

    try {
      const existing = await prisma.freelancerAvailability.findUnique({
        where: { freelancerId },
      });

      await prisma.freelancerAvailability.upsert({
        where:  { freelancerId },
        update: {
          isActive:             payload.isActive,
          timezone:             payload.timezone,
          weeklyScheduleJson:   payload.weeklyScheduleJson,
          defaultSlotDuration:  payload.defaultSlotDuration,
          bufferTime:           payload.bufferTime,
          maxAdvanceBookingDays: payload.maxAdvanceBookingDays,
          defaultCapacity:      payload.defaultCapacity,
        },
        create: payload,
      });

      if (existing) { updated++; console.log(`    → updated existing SQL record`); }
      else          { created++; console.log(`    → created new SQL record`); }
    } catch (err) {
      errors++;
      console.error(`    ✗ Error for ${freelancerId}: ${err.message}`);
    }
  }

  console.log(`\n📊  Results:`);
  console.log(`    Created : ${created}`);
  console.log(`    Updated : ${updated}`);
  console.log(`    Skipped : ${skipped}`);
  console.log(`    Errors  : ${errors}`);

  if (errors > 0) {
    console.log('\n⚠️  Some records failed. Check errors above.');
    process.exit(1);
  }

  console.log('\n✅  Backfill complete.\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
