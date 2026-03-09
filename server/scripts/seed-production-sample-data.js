/**
 * Seed script (PRODUCTION SAFE-ish): adds sample Jobs, Services, Bookings (SQL), Teams, and Conversations
 * using EXISTING users in the database.
 *
 * ⚠️ This script WRITES to production MongoDB + production Postgres if the env vars point there.
 *
 * Usage:
 *   MONGO_URI=... DATABASE_URL=... node server/scripts/seed-production-sample-data.js \
 *     --jobs 10 --services 10 --bookings 25 --teams 3 --conversations 6
 *
 * Optional:
 *   --dryRun
 *   --onlyMongo
 *   --onlySql
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { PrismaClient } = require('@prisma/client');
const { faker } = require('@faker-js/faker');

const MONGO_URI = process.env.MONGO_URI;
const DATABASE_URL = process.env.DATABASE_URL;

function getArg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const v = process.argv[idx + 1];
  if (!v || v.startsWith('--')) return true;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const counts = {
    jobs: Number(getArg('jobs', 10)),
    services: Number(getArg('services', 10)),
    bookings: Number(getArg('bookings', 25)),
    teams: Number(getArg('teams', 3)),
    conversations: Number(getArg('conversations', 6)),
  };

  const dryRun = hasFlag('dryRun');
  const onlyMongo = hasFlag('onlyMongo');
  const onlySql = hasFlag('onlySql');

  if (!MONGO_URI && !onlySql) {
    console.error('MONGO_URI required (unless --onlySql)');
    process.exit(1);
  }
  if (!DATABASE_URL && !onlyMongo) {
    console.error('DATABASE_URL required (unless --onlyMongo)');
    process.exit(1);
  }

  const prisma = (!onlyMongo) ? new PrismaClient() : null;

  if (!onlySql) {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
  }
  if (!onlyMongo) {
    // quick health query
    await prisma.$queryRaw`SELECT 1;`;
    console.log('✅ Connected to Postgres (Prisma)');
  }

  const User = !onlySql ? require('../models/User') : null;
  const Job = !onlySql ? require('../models/Job') : null;
  const Service = !onlySql ? require('../models/Service') : null;
  const Team = !onlySql ? require('../models/Team') : null;
  const { Conversation, Message } = !onlySql ? require('../models/Message') : { Conversation: null, Message: null };

  // ── Load existing users ────────────────────────────────────────────────────
  let clients = [];
  let freelancers = [];

  if (!onlySql) {
    // Prefer existing test users; fall back to any users.
    const baseQuery = { isActive: { $ne: false } };
    const testUsers = await User.find({ ...baseQuery, email: /@test\.com$/i }).limit(200);
    const pool = testUsers.length >= 6 ? testUsers : await User.find(baseQuery).limit(500);

    clients = pool.filter(u => ['client', 'both'].includes(u.accountType));
    freelancers = pool.filter(u => ['freelancer', 'both'].includes(u.accountType));

    if (clients.length < 2 || freelancers.length < 2) {
      throw new Error(`Not enough users to seed with. Found clients=${clients.length}, freelancers=${freelancers.length}`);
    }

    console.log(`Found user pool: clients=${clients.length}, freelancers=${freelancers.length}`);
  }

  // ── Seed Jobs (Mongo) ─────────────────────────────────────────────────────
  const createdJobs = [];
  if (!onlySql) {
    const categories = [
      'web_development','mobile_development','design','writing','marketing','photography',
      'fitness','tutoring','cooking','cleaning','home_repair','moving_hauling',
    ];

    for (let i = 0; i < counts.jobs; i++) {
      const client = pick(clients);
      const category = pick(categories);
      const isLocal = Math.random() < 0.5;

      const title = `[SEED] ${faker.company.buzzPhrase()}`;
      const budgetType = Math.random() < 0.6 ? 'fixed' : 'hourly';
      const amount = budgetType === 'fixed'
        ? faker.number.int({ min: 80, max: 4500 })
        : faker.number.int({ min: 15, max: 120 });

      const doc = {
        title,
        client: client._id,
        category,
        description: faker.lorem.paragraphs({ min: 1, max: 2 }),
        budget: { type: budgetType, amount, currency: 'USD' },
        duration: pick(['less_than_1_week','1_2_weeks','1_month','2_3_months','3_6_months']),
        experienceLevel: pick(['entry','intermediate','expert']),
        skills: faker.helpers.arrayElements(['React','Node.js','TypeScript','Design','SEO','Copywriting','Plumbing','Cleaning','Photography','Tutoring'], { min: 2, max: 5 }),
        status: 'open',
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isUrgent: Math.random() < 0.25,
        views: faker.number.int({ min: 0, max: 40 }),
        location: {
          locationType: isLocal ? 'local' : 'remote',
          city: isLocal ? pick(['Concord','Walnut Creek','Pleasant Hill','Berkeley','Oakland']) : '',
          state: isLocal ? 'CA' : '',
          zipCode: isLocal ? pick(['94520','94596','94523','94704','94612']) : '',
          address: '',
          coordinates: { type: 'Point', coordinates: [0, 0] },
          serviceRadius: 25,
        },
      };

      if (dryRun) {
        createdJobs.push(doc);
        continue;
      }

      const job = await Job.create(doc);
      createdJobs.push(job);
    }

    console.log(`✅ Jobs seeded: ${createdJobs.length}${dryRun ? ' (dryRun)' : ''}`);
  }

  // ── Seed Services (Mongo) ─────────────────────────────────────────────────
  const createdServices = [];
  if (!onlySql) {
    const categories = [
      'web_development','mobile_development','design','writing','marketing','photography',
      'fitness','tutoring','cooking','cleaning','home_repair','moving_hauling','classes'
    ];

    for (let i = 0; i < counts.services; i++) {
      const freelancer = pick(freelancers);
      const category = pick(categories);
      const isRecurring = Math.random() < 0.35;
      const isLocal = Math.random() < 0.5;

      const basePrice = faker.number.int({ min: 25, max: 250 });
      const doc = {
        title: `[SEED] ${faker.commerce.productAdjective()} ${faker.commerce.product()}`,
        freelancer: freelancer._id,
        category,
        description: faker.lorem.paragraphs({ min: 1, max: 2 }),
        skills: faker.helpers.arrayElements(['React','React Native','Figma','SEO','Cleaning','Personal Training','Tutoring','Photography','Handyman'], { min: 2, max: 5 }),
        pricing: {
          basic: { title: 'Basic', price: basePrice, deliveryTime: 3, description: 'Basic package', revisions: 1 },
          standard: { title: 'Standard', price: Math.round(basePrice * 2.5), deliveryTime: 7, description: 'Standard package', revisions: 2 },
          premium: { title: 'Premium', price: Math.round(basePrice * 5), deliveryTime: 14, description: 'Premium package', revisions: 3 },
        },
        serviceType: isRecurring ? 'recurring' : 'one_time',
        recurring: isRecurring ? {
          billingCycle: pick(['weekly','monthly','per_session']),
          sessionDurationMinutes: pick([30, 45, 60, 90]),
        } : undefined,
        status: 'active',
        isActive: true,
        views: faker.number.int({ min: 0, max: 50 }),
        rating: Math.round((3.6 + Math.random() * 1.3) * 10) / 10,
        totalOrders: faker.number.int({ min: 0, max: 12 }),
        location: {
          locationType: isLocal ? 'local' : 'remote',
          city: isLocal ? pick(['Concord','Walnut Creek','Pleasant Hill','Berkeley','Oakland']) : '',
          state: isLocal ? 'CA' : '',
          zipCode: isLocal ? pick(['94520','94596','94523','94704','94612']) : '',
          address: '',
          coordinates: { type: 'Point', coordinates: [0, 0] },
          serviceRadius: 25,
        },
      };

      if (dryRun) {
        createdServices.push(doc);
        continue;
      }

      const service = await Service.create(doc);
      createdServices.push(service);
    }

    console.log(`✅ Services seeded: ${createdServices.length}${dryRun ? ' (dryRun)' : ''}`);
  }

  // ── Seed Teams (Mongo) ────────────────────────────────────────────────────
  const createdTeams = [];
  if (!onlySql) {
    for (let i = 0; i < counts.teams; i++) {
      const owner = pick(clients);
      const member1 = pick(clients);
      const member2 = pick(clients);

      const name = `[SEED] ${faker.company.name()} Team`;
      const doc = {
        name,
        type: 'client_team',
        owner: owner._id,
        description: faker.company.catchPhrase(),
        settings: {
          allowMemberJobPosting: true,
          sharedConversations: true,
          requireApproval: Math.random() < 0.4,
          defaultMemberPermissions: ['view_analytics', 'message_clients', 'create_jobs'],
        },
        spendControls: {
          monthlyCapEnabled: Math.random() < 0.5,
          monthlyCap: faker.number.int({ min: 500, max: 5000 }),
          alertThreshold: 0.8,
          currentMonthSpend: faker.number.int({ min: 0, max: 800 }),
          capResetAt: new Date(),
        },
        approvalThreshold: faker.number.int({ min: 0, max: 500 }),
        members: [
          { user: owner._id, role: 'owner', permissions: [], status: 'active', joinedAt: new Date() },
          { user: member1._id, role: 'admin', permissions: ['manage_members','view_analytics','create_jobs','message_clients'], status: 'active', joinedAt: new Date() },
          { user: member2._id, role: 'member', permissions: ['view_analytics','message_clients'], status: 'active', joinedAt: new Date() },
        ].filter((m, idx, arr) => arr.findIndex(x => x.user.toString() === m.user.toString()) === idx),
      };

      if (dryRun) {
        createdTeams.push(doc);
        continue;
      }

      const team = await Team.create(doc);
      createdTeams.push(team);
    }

    console.log(`✅ Teams seeded: ${createdTeams.length}${dryRun ? ' (dryRun)' : ''}`);
  }

  // ── Seed Conversations + Messages (Mongo) ─────────────────────────────────
  if (!onlySql) {
    let convoCreated = 0;
    for (let i = 0; i < counts.conversations; i++) {
      const client = pick(clients);
      const freelancer = pick(freelancers);

      const existing = await Conversation.findByParticipants(client._id, freelancer._id);
      const convo = existing || (dryRun ? null : await Conversation.create({
        participants: [client._id, freelancer._id],
        lastActivity: new Date(),
        seq: 0,
        lastMessageSeq: 0,
        unreadCount: new Map(),
      }));

      if (!existing) convoCreated++;

      const threadMessages = [
        `Hey! I’m interested in your service — are you available this week?`,
        `Yep — what day/time works? Also what’s your budget range?`,
        `Budget is around $${faker.number.int({ min: 150, max: 900 })}. Looking for something clean and professional.`,
        `Perfect. I can do a first draft in 48 hours and iterate from there.`,
      ];

      if (dryRun) continue;

      let seq = convo.lastMessageSeq || 0;
      let lastMsg = null;
      for (let mi = 0; mi < threadMessages.length; mi++) {
        seq += 1;
        const sender = mi % 2 === 0 ? client._id : freelancer._id;
        const recipient = mi % 2 === 0 ? freelancer._id : client._id;
        const msg = await Message.create({
          conversation: convo._id,
          seq,
          sender,
          recipient,
          content: `[SEED] ${threadMessages[mi]}`,
          messageType: 'text',
          isRead: mi < threadMessages.length - 1,
        });
        lastMsg = msg;
      }

      await Conversation.updateOne(
        { _id: convo._id },
        {
          $set: {
            lastMessage: lastMsg?._id || null,
            lastMessageSeq: seq,
            seq,
            lastMessageAt: new Date(),
            lastActivity: new Date(),
          },
        },
      );
    }

    console.log(`✅ Conversations seeded: ${counts.conversations} (created new: ${convoCreated})${dryRun ? ' (dryRun)' : ''}`);
  }

  // ── Seed SQL: availability + bookings ─────────────────────────────────────
  if (!onlyMongo) {
    // Get services/freelancers/clients from Mongo unless --onlySql
    let seedFreelancers = [];
    let seedClients = [];
    let seedServices = [];

    if (!onlySql) {
      seedFreelancers = freelancers;
      seedClients = clients;
      seedServices = (!dryRun && createdServices.length)
        ? createdServices
        : await Service.find({ isActive: true }).sort({ createdAt: -1 }).limit(50);
    } else {
      throw new Error('SQL seeding currently requires Mongo user/service IDs (run without --onlySql).');
    }

    // Availability for freelancers (upsert)
    const tz = 'America/Los_Angeles';
    const weeklySchedule = [
      { dayOfWeek: 1, windows: [{ startTime: '09:00', endTime: '17:00' }] },
      { dayOfWeek: 2, windows: [{ startTime: '09:00', endTime: '17:00' }] },
      { dayOfWeek: 3, windows: [{ startTime: '09:00', endTime: '17:00' }] },
      { dayOfWeek: 4, windows: [{ startTime: '09:00', endTime: '17:00' }] },
      { dayOfWeek: 5, windows: [{ startTime: '09:00', endTime: '17:00' }] },
    ];

    if (!dryRun) {
      for (const f of seedFreelancers) {
        await prisma.freelancerAvailability.upsert({
          where: { freelancerId: f._id.toString() },
          create: {
            freelancerId: f._id.toString(),
            timezone: tz,
            defaultSlotDuration: 60,
            bufferTime: 0,
            defaultCapacity: 1,
            minNoticeHours: 2,
            maxAdvanceBookingDays: 60,
            isActive: true,
            weeklyScheduleJson: weeklySchedule,
          },
          update: {
            timezone: tz,
            isActive: true,
          },
        });
      }
    }

    // Service overrides (upsert a few)
    if (!dryRun) {
      for (const s of seedServices.slice(0, Math.min(seedServices.length, 20))) {
        const fId = s.freelancer?.toString?.() || s.freelancer;
        const fa = await prisma.freelancerAvailability.findUnique({ where: { freelancerId: fId } });
        if (!fa) continue;

        await prisma.serviceAvailabilityOverride.upsert({
          where: {
            freelancerAvailId_serviceId: {
              freelancerAvailId: fa.id,
              serviceId: s._id.toString(),
            },
          },
          create: {
            freelancerAvailId: fa.id,
            serviceId: s._id.toString(),
            isActive: true,
          },
          update: {
            isActive: true,
          },
        });
      }
    }

    // Bookings
    const created = [];
    const statuses = ['held', 'confirmed', 'completed', 'cancelled_by_client', 'cancelled_by_freelancer'];

    for (let i = 0; i < counts.bookings; i++) {
      const service = pick(seedServices);
      const freelancerId = service.freelancer.toString();
      const client = pick(seedClients);

      const start = faker.date.soon({ days: 21 });
      start.setMinutes(0, 0, 0);
      start.setHours(pick([9, 10, 11, 13, 14, 15]));
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      const state = pick(statuses);
      const price = Math.max(25, (service.pricing?.basic?.price || 50));

      const bookingRef = `SEED-${Date.now().toString(36)}-${faker.string.alphanumeric(6).toUpperCase()}`;

      const policySnapshotJson = {
        source: 'seed',
        serviceId: service._id.toString(),
        serviceTitle: service.title,
        timezone: tz,
        cancellationPolicy: 'Flexible (seed)',
      };
      const pricingSnapshotJson = {
        source: 'seed',
        priceCents: Math.round(price * 100),
        currency: 'usd',
      };

      if (dryRun) {
        created.push({ bookingRef, clientId: client._id.toString(), freelancerId, serviceId: service._id.toString(), state });
        continue;
      }

      const b = await prisma.booking.create({
        data: {
          bookingRef,
          clientId: client._id.toString(),
          freelancerId,
          serviceOfferingId: null,
          policySnapshotJson,
          pricingSnapshotJson,
          currentState: state,
          notes: '[SEED] Sample booking',
          occurrences: {
            create: {
              occurrenceNo: 1,
              clientId: client._id.toString(),
              freelancerId,
              startAtUtc: start,
              endAtUtc: end,
              timezone: tz,
              localStartWallclock: `${isoDate(start)} ${String(start.getHours()).padStart(2,'0')}:00`,
              localEndWallclock: `${isoDate(end)} ${String(end.getHours()).padStart(2,'0')}:00`,
              status: state,
            },
          },
          auditEvents: {
            create: {
              actorType: 'system',
              actorId: null,
              eventType: 'seed_booking_created',
              payloadJson: { state },
              payloadHash: faker.string.alphanumeric(24),
            },
          },
        },
      });

      created.push(b);
    }

    console.log(`✅ SQL bookings seeded: ${created.length}${dryRun ? ' (dryRun)' : ''}`);
  }

  if (!onlySql) await mongoose.disconnect();
  if (prisma) await prisma.$disconnect();

  console.log('\n🎉 Seed complete.');
  if (dryRun) console.log('   (dryRun: no writes were performed)');
}

main().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
