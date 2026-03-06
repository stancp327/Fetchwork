/**
 * booking-sql-full-smoke.js
 *
 * Full end-to-end smoke test against the real Neon PostgreSQL DB.
 * Covers every Phase 2 route and its underlying repo/service method.
 *
 * Flows tested:
 *   A) hold → confirm → GET /me (upcoming) → GET /:id → complete → GET /me (past)
 *   B) hold → confirm → cancel → GET /me (cancelled) + policyOutcome check
 *   C) hold with strict tier 48h out → cancel → verify 50% charge
 *   D) double-cancel guard → expects 400 INVALID_CANCEL_STATE
 *   E) unauthorized actor cancel → expects NOT_AUTHORIZED response
 *   F) BookingRepo.findByActor status filters return correct bookings only
 *
 * Usage: npm run booking-sql:full-smoke
 */

require('dotenv').config();

const { bookingSqlHealthcheck } = require('../booking-sql/db/healthcheck');
const { BookingRepo }           = require('../booking-sql/repos/BookingRepo');
const { BookingService }        = require('../booking-sql/services/BookingService');
const { getPrisma }             = require('../booking-sql/db/client');

// ─── helpers ─────────────────────────────────────────────────────────────────

const repo    = new BookingRepo();
const prisma  = getPrisma();
const tracked = []; // booking ids to clean up

function hoursAhead(h) {
  return new Date(Date.now() + h * 3_600_000);
}

function isoSlice(iso, from, to) {
  return String(iso || '').slice(from, to);
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`ASSERTION FAILED [${label}]: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function seedHeld({ ref, clientId, freelancerId, tier = 'flexible', amountCents = 10000, hoursOut = 48 }) {
  const start = hoursAhead(hoursOut);
  const end   = hoursAhead(hoursOut + 1);

  const booking = await repo.createBooking({
    bookingRef: ref,
    clientId,
    freelancerId,
    policySnapshotJson:  { tier, snapshotVersion: 1 },
    pricingSnapshotJson: { amountCents, currency: 'usd' },
    currentState: 'held',
    notes: 'full-smoke seed',
  });

  await repo.createOccurrence({
    bookingId:            booking.id,
    occurrenceNo:         1,
    clientId,
    freelancerId,
    startAtUtc:           start,
    endAtUtc:             end,
    timezone:             'UTC',
    localStartWallclock:  start.toISOString().slice(0, 16),
    localEndWallclock:    end.toISOString().slice(0, 16),
    status:               'held',
  });

  tracked.push(booking.id);
  return booking;
}

// BookingService with a fake ServiceAdapter — we seed bookings directly so
// createHold's adapter call is bypassed. We test confirm/cancel/complete only.
function makeSvc() {
  return new BookingService({
    serviceAdapter: {
      getById: async () => ({
        id: 'svc-smoke',
        freelancerId: 'smoke-freelancer',
        title: 'Smoke Service',
        timezone: 'UTC',
        maxPerSlot: 1,
        pricingBaseCents: 10000,
        cancellationTier: 'flexible',
        bookingEnabled: true,
        slotDuration: 60,
        bufferTime: 0,
        maxAdvanceDays: 60,
        availabilityWindows: [],
      }),
    },
  });
}

// ─── individual flow runners ──────────────────────────────────────────────────

async function flowA_confirmCompleteThenRead() {
  console.log('\n[Flow A] hold → confirm → complete → read paths');
  const svc = makeSvc();
  const b = await seedHeld({ ref: `smokeA_${Date.now()}`, clientId: 'smoke-client-a', freelancerId: 'smoke-fl-a' });

  // confirm
  const confirm = await svc.confirmHold({
    actorId: 'smoke-fl-a', route: 'SMOKE:A:confirm',
    idempotencyKey: `smokeA-confirm-${Date.now()}`, requestHash: 'smoke',
    bookingId: b.id,
  });
  assertEq(confirm.statusCode, 200, 'Flow A confirm status');
  assertEq(confirm.response.status, 'confirmed', 'Flow A confirm.response.status');

  // GET /me upcoming — should appear
  const upcoming = await repo.findByActor({ actorId: 'smoke-client-a', role: 'client', status: 'upcoming' });
  const found = upcoming.find((x) => x.id === b.id);
  assert(found, 'Flow A: booking should appear in upcoming list after confirm');
  assertEq(found.currentState, 'confirmed', 'Flow A: currentState in upcoming list');
  assert(found.occurrences.length > 0, 'Flow A: occurrence included in findByActor result');

  // GET /:id
  const detail = await repo.findByIdWithOccurrences(b.id);
  assert(detail, 'Flow A: findByIdWithOccurrences returned result');
  assertEq(detail.id, b.id, 'Flow A: detail id matches');
  assertEq(detail.occurrences[0].status, 'confirmed', 'Flow A: occurrence status in detail');

  // complete
  const complete = await svc.completeBooking({
    actorId: 'smoke-fl-a', route: 'SMOKE:A:complete',
    idempotencyKey: `smokeA-complete-${Date.now()}`, requestHash: 'smoke',
    bookingId: b.id,
  });
  assertEq(complete.statusCode, 200, 'Flow A complete status');

  // GET /me past — should appear
  const past = await repo.findByActor({ actorId: 'smoke-client-a', role: 'client', status: 'past' });
  const foundPast = past.find((x) => x.id === b.id);
  assert(foundPast, 'Flow A: booking should appear in past list after complete');
  assertEq(foundPast.currentState, 'completed', 'Flow A: currentState in past list');

  // GET /me upcoming — should NOT appear after complete
  const upcomingAfter = await repo.findByActor({ actorId: 'smoke-client-a', role: 'client', status: 'upcoming' });
  assert(!upcomingAfter.find((x) => x.id === b.id), 'Flow A: completed booking NOT in upcoming');

  console.log('  [A] PASS');
}

async function flowB_confirmCancelThenRead() {
  console.log('\n[Flow B] hold → confirm → cancel → policyOutcome + cancelled read');
  const svc = makeSvc();
  const b = await seedHeld({
    ref: `smokeB_${Date.now()}`,
    clientId: 'smoke-client-b',
    freelancerId: 'smoke-fl-b',
    tier: 'flexible',
    amountCents: 10000,
    hoursOut: 30, // 30h out → flexible tier → 0% charge (full refund)
  });

  // confirm
  await svc.confirmHold({
    actorId: 'smoke-fl-b', route: 'SMOKE:B:confirm',
    idempotencyKey: `smokeB-confirm-${Date.now()}`, requestHash: 'smoke',
    bookingId: b.id,
  });

  // cancel by client
  const cancel = await svc.cancelBooking({
    actorId: 'smoke-client-b', route: 'SMOKE:B:cancel',
    idempotencyKey: `smokeB-cancel-${Date.now()}`, requestHash: 'smoke',
    bookingId: b.id,
    reason: 'smoke test flow B',
  });
  assertEq(cancel.statusCode, 200, 'Flow B cancel status');
  assertEq(cancel.response.status, 'cancelled_by_client', 'Flow B cancel status value');

  // policyOutcome: 30h out, flexible → full refund
  const po = cancel.response.policyOutcome;
  assert(po, 'Flow B: policyOutcome present in cancel response');
  assertEq(po.tier, 'flexible', 'Flow B: policyOutcome.tier');
  assertEq(po.chargePct, 0, 'Flow B: no charge at 30h out flexible');
  assertEq(po.refundCents, 10000, 'Flow B: full refund');
  assertEq(po.chargeCents, 0, 'Flow B: zero charge');

  // GET /me cancelled — should appear
  const cancelled = await repo.findByActor({ actorId: 'smoke-client-b', role: 'client', status: 'cancelled' });
  const foundCancelled = cancelled.find((x) => x.id === b.id);
  assert(foundCancelled, 'Flow B: booking in cancelled list');
  assertEq(foundCancelled.currentState, 'cancelled_by_client', 'Flow B: correct cancelled state');

  // GET /me upcoming — should NOT appear
  const upcoming = await repo.findByActor({ actorId: 'smoke-client-b', role: 'client', status: 'upcoming' });
  assert(!upcoming.find((x) => x.id === b.id), 'Flow B: cancelled booking NOT in upcoming');

  console.log('  [B] PASS');
}

async function flowC_strictTierPartialCharge() {
  console.log('\n[Flow C] strict tier 48h out → 50% charge policyOutcome');
  const svc = makeSvc();
  const b = await seedHeld({
    ref: `smokeC_${Date.now()}`,
    clientId: 'smoke-client-c',
    freelancerId: 'smoke-fl-c',
    tier: 'strict',
    amountCents: 20000,
    hoursOut: 48, // 48h = within 24-72h window for strict → 50%
  });

  await svc.confirmHold({
    actorId: 'smoke-fl-c', route: 'SMOKE:C:confirm',
    idempotencyKey: `smokeC-confirm-${Date.now()}`, requestHash: 'smoke',
    bookingId: b.id,
  });

  const cancel = await svc.cancelBooking({
    actorId: 'smoke-client-c', route: 'SMOKE:C:cancel',
    idempotencyKey: `smokeC-cancel-${Date.now()}`, requestHash: 'smoke',
    bookingId: b.id,
    reason: 'smoke test flow C',
  });

  const po = cancel.response.policyOutcome;
  assertEq(po.tier, 'strict', 'Flow C: strict tier');
  assertEq(po.chargePct, 0.5, 'Flow C: 50% charge at 48h strict');
  assertEq(po.chargeCents, 10000, 'Flow C: 50% of $200 = $100');
  assertEq(po.refundCents, 10000, 'Flow C: remaining 50% refunded');

  console.log('  [C] PASS');
}

async function flowD_doubleCancelGuard() {
  console.log('\n[Flow D] double-cancel guard → INVALID_CANCEL_STATE');
  const svc = makeSvc();
  const b = await seedHeld({
    ref: `smokeD_${Date.now()}`,
    clientId: 'smoke-client-d',
    freelancerId: 'smoke-fl-d',
  });

  await svc.confirmHold({
    actorId: 'smoke-fl-d', route: 'SMOKE:D:confirm',
    idempotencyKey: `smokeD-confirm-${Date.now()}`, requestHash: 'smoke',
    bookingId: b.id,
  });

  await svc.cancelBooking({
    actorId: 'smoke-client-d', route: 'SMOKE:D:cancel1',
    idempotencyKey: `smokeD-cancel1-${Date.now()}`, requestHash: 'smoke',
    bookingId: b.id,
  });

  // Second cancel — different idempotency key so it's treated as a new request
  const cancel2 = await svc.cancelBooking({
    actorId: 'smoke-client-d', route: 'SMOKE:D:cancel2',
    idempotencyKey: `smokeD-cancel2-${Date.now()}`, requestHash: 'smoke',
    bookingId: b.id,
  });
  assertEq(cancel2.statusCode, 400, 'Flow D: second cancel should be 400');
  assertEq(cancel2.response.code, 'INVALID_CANCEL_STATE', 'Flow D: correct error code');

  console.log('  [D] PASS');
}

async function flowE_unauthorizedActorGuard() {
  console.log('\n[Flow E] unauthorized actor cancel → NOT_AUTHORIZED');
  const svc = makeSvc();
  const b = await seedHeld({
    ref: `smokeE_${Date.now()}`,
    clientId: 'smoke-client-e',
    freelancerId: 'smoke-fl-e',
  });

  await svc.confirmHold({
    actorId: 'smoke-fl-e', route: 'SMOKE:E:confirm',
    idempotencyKey: `smokeE-confirm-${Date.now()}`, requestHash: 'smoke',
    bookingId: b.id,
  });

  const cancel = await svc.cancelBooking({
    actorId: 'total-stranger', route: 'SMOKE:E:cancel',
    idempotencyKey: `smokeE-cancel-${Date.now()}`, requestHash: 'smoke',
    bookingId: b.id,
  });
  assertEq(cancel.statusCode, 400, 'Flow E: unauthorized cancel should be 400');
  assertEq(cancel.response.code, 'NOT_AUTHORIZED', 'Flow E: NOT_AUTHORIZED code');

  console.log('  [E] PASS');
}

async function flowF_statusFilterIsolation() {
  console.log('\n[Flow F] status filter isolation — upcoming/past/cancelled don\'t bleed');
  const svc = makeSvc();
  const prefix = `smokeF_${Date.now()}`;

  // Create three bookings on unique actor IDs to isolate this flow
  const bConfirmed = await seedHeld({ ref: `${prefix}_confirmed`, clientId: `${prefix}_client`, freelancerId: 'smoke-fl-f' });
  const bCompleted = await seedHeld({ ref: `${prefix}_completed`, clientId: `${prefix}_client`, freelancerId: 'smoke-fl-f' });
  const bCancelled = await seedHeld({ ref: `${prefix}_cancelled`, clientId: `${prefix}_client`, freelancerId: 'smoke-fl-f' });

  // Transition each to their final state
  for (const [booking, idKey] of [[bConfirmed, 'conf'], [bCompleted, 'comp'], [bCancelled, 'canc']]) {
    await svc.confirmHold({
      actorId: 'smoke-fl-f', route: `SMOKE:F:confirm:${idKey}`,
      idempotencyKey: `smokeF-confirm-${idKey}-${Date.now()}`, requestHash: 'smoke',
      bookingId: booking.id,
    });
  }

  await svc.completeBooking({
    actorId: 'smoke-fl-f', route: 'SMOKE:F:complete',
    idempotencyKey: `smokeF-complete-${Date.now()}`, requestHash: 'smoke',
    bookingId: bCompleted.id,
  });

  await svc.cancelBooking({
    actorId: `${prefix}_client`, route: 'SMOKE:F:cancel',
    idempotencyKey: `smokeF-cancel-${Date.now()}`, requestHash: 'smoke',
    bookingId: bCancelled.id,
    reason: 'flow F',
  });

  const clientId = `${prefix}_client`;

  const upcoming  = await repo.findByActor({ actorId: clientId, role: 'client', status: 'upcoming' });
  const past      = await repo.findByActor({ actorId: clientId, role: 'client', status: 'past' });
  const cancelled = await repo.findByActor({ actorId: clientId, role: 'client', status: 'cancelled' });

  const ids = (arr) => arr.map((x) => x.id);

  assert(ids(upcoming).includes(bConfirmed.id),    'Flow F: confirmed in upcoming');
  assert(!ids(upcoming).includes(bCompleted.id),   'Flow F: completed NOT in upcoming');
  assert(!ids(upcoming).includes(bCancelled.id),   'Flow F: cancelled NOT in upcoming');

  assert(ids(past).includes(bCompleted.id),        'Flow F: completed in past');
  assert(!ids(past).includes(bConfirmed.id),       'Flow F: confirmed NOT in past');

  assert(ids(cancelled).includes(bCancelled.id),   'Flow F: cancelled in cancelled');
  assert(!ids(cancelled).includes(bConfirmed.id),  'Flow F: confirmed NOT in cancelled');

  console.log('  [F] PASS');
}

// ─── main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('=== Booking SQL Full Smoke Test ===\n');

  try {
    // Healthcheck
    const health = await bookingSqlHealthcheck();
    if (!health.ok) throw new Error(`DB healthcheck failed: ${health.error || 'unknown'}`);
    console.log('[✓] DB healthcheck OK');

    await flowA_confirmCompleteThenRead();
    await flowB_confirmCancelThenRead();
    await flowC_strictTierPartialCharge();
    await flowD_doubleCancelGuard();
    await flowE_unauthorizedActorGuard();
    await flowF_statusFilterIsolation();

    console.log('\n✅ All flows PASS\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ FAIL:', err.message);
    process.exit(1);
  } finally {
    if (tracked.length > 0) {
      try {
        await prisma.booking.deleteMany({ where: { id: { in: tracked } } });
        console.log(`[cleanup] Deleted ${tracked.length} test bookings`);
      } catch (cleanupErr) {
        console.warn('[cleanup] Warning:', cleanupErr.message);
      }
    }
    await prisma.$disconnect();
  }
})();
