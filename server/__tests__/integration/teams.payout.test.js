/**
 * teams.payout.test.js
 *
 * Integration tests for the Teams payout system:
 *   - deductTeamWallet FIFO credit deduction (tested via pay route)
 *   - POST /api/teams/:id/tasks/:taskId/pay
 *   - GET  /api/teams/:id/payouts
 *
 * NOTE: MongoMemoryServer runs standalone (no replica set), so mongoose
 * transactions are mocked. We test all logic except true rollback atomicity,
 * which requires a replica set (TODO: add to CI with --replSet flag).
 */

'use strict';

jest.setTimeout(30000);

const request  = require('supertest');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const mongoose = require('mongoose');
const { connectDB, clearDB, closeDB } = require('../setup/dbHelpers');

process.env.JWT_SECRET   = 'test-secret-key-for-jest';
process.env.NODE_ENV     = 'test';
process.env.CLIENT_URL   = 'http://localhost:3000';
process.env.STRIPE_SECRET_KEY       = 'sk_test_placeholder';
process.env.STRIPE_WEBHOOK_SECRET   = 'whsec_test_placeholder';
process.env.SENTRY_DSN   = ''; // disable Sentry in tests

jest.mock('../../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendEmailVerification: jest.fn().mockResolvedValue(true),
}));

jest.mock('stripe', () => () => ({
  paymentIntents: { create: jest.fn(), confirm: jest.fn() },
  accounts:       { create: jest.fn() },
  transfers:      { create: jest.fn() },
}));

// Mock mongoose sessions — MongoMemoryServer runs standalone (no replica sets,
// no multi-document transactions). Strategy:
//   - Create ONE real ClientSession from the connection so the MongoDB driver
//     accepts it as a valid session object (driver v6 rejects plain objects).
//   - Mock startTransaction / commitTransaction / abortTransaction / endSession
//     so they're no-ops (standalone would throw "only allowed on replica set").
//   - Reuse the same session across all tests; endSession is mocked so it stays open.
//   - mongoose.startSession always returns this shared fake-real session.
let realClientSession;

let app;
let User, Team, TeamTask, TeamPayout, BillingCredit;

beforeAll(async () => {
  await connectDB();

  // Create a real ClientSession AFTER the DB is connected
  realClientSession = await mongoose.connection.startSession();
  jest.spyOn(realClientSession, 'startTransaction').mockImplementation(() => {});
  jest.spyOn(realClientSession, 'commitTransaction').mockResolvedValue(undefined);
  jest.spyOn(realClientSession, 'abortTransaction').mockResolvedValue(undefined);
  jest.spyOn(realClientSession, 'endSession').mockResolvedValue(undefined);

  // Make every mongoose.startSession() call return our pre-wired real session
  jest.spyOn(mongoose, 'startSession').mockResolvedValue(realClientSession);

  // Mount only the teams router (same pattern as other integration tests)
  const express = require('express');
  app = express();
  app.use(express.json());
  app.use('/api/teams', require('../../routes/teams'));

  User          = require('../../models/User');
  Team          = require('../../models/Team');
  TeamTask      = require('../../models/TeamTask');
  TeamPayout    = require('../../models/TeamPayout');
  BillingCredit = require('../../models/BillingCredit');
});

afterEach(async () => {
  await clearDB();
  // Only reset call history, keep implementations intact
  realClientSession?.startTransaction.mockClear?.();
  realClientSession?.commitTransaction.mockClear?.();
  realClientSession?.abortTransaction.mockClear?.();
});

afterAll(async () => {
  // Actually end the real session before closing DB
  realClientSession?.endSession.mockRestore?.();
  await realClientSession?.endSession().catch(() => {});
  await closeDB();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const authHeader = (userId) => {
  const token = jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
};

const createUser = async (overrides = {}) => {
  const password = await bcrypt.hash('TestPass123!', 10);
  return User.create({
    email:       overrides.email || `user${Date.now()}${Math.random()}@test.com`,
    password,
    firstName:   overrides.firstName || 'Test',
    lastName:    overrides.lastName  || 'User',
    accountType: 'both',
    isVerified:  true,
    isActive:    true,
    isSuspended: false,
    role:        'user',
    providers:   ['local'],
  });
};

const createTeam = async (owner, member = null) => {
  const members = [{
    user:        owner._id,
    role:        'owner',
    permissions: ['manage_members', 'manage_billing', 'approve_orders',
                  'assign_work', 'manage_tasks', 'view_wallet',
                  'approve_payouts', 'approve_outsourcing', 'read_tasks'],
    status:  'active',
    joinedAt: new Date(),
  }];
  if (member) {
    members.push({
      user:        member._id,
      role:        'member',
      permissions: ['read_tasks'],
      status:      'active',
      joinedAt:    new Date(),
    });
  }
  return Team.create({
    name:     'Payout Test Team',
    type:     'agency',
    owner:    owner._id,
    isActive: true,
    members,
  });
};

const createCredit = async (teamId, amount, opts = {}) =>
  BillingCredit.create({
    team:      teamId,
    amount,
    remaining: opts.remaining ?? amount,
    type:      opts.type     || 'team_deposit',
    reason:    'Test deposit',
    status:    opts.status   || 'active',
    createdAt: opts.createdAt || new Date(),
  });

const createTask = async (teamId, assignedTo, opts = {}) =>
  TeamTask.create({
    team:          teamId,
    title:         opts.title         || 'Test Task',
    status:        opts.status        || 'approved',
    payoutStatus:  opts.payoutStatus  || 'approved',
    payoutType:    opts.payoutType    || 'per_job',
    payoutAmount:  opts.payoutAmount  ?? 50,
    assignedTo:    assignedTo || null,
    hoursApproved: opts.hoursApproved || null,
    hourlyRate:    opts.hourlyRate    || null,
    createdBy:     opts.createdBy     || teamId,
  });

// ─── Suite 1: FIFO credit deduction (via pay route) ─────────────────────────

describe('FIFO wallet deduction', () => {
  let owner, member, team;

  beforeEach(async () => {
    owner  = await createUser();
    member = await createUser();
    team   = await createTeam(owner, member);
  });

  it('deducts from the oldest credit first', async () => {
    const old = await createCredit(team._id, 100, { createdAt: new Date('2026-01-01') });
    const nw  = await createCredit(team._id, 100, { createdAt: new Date('2026-03-01') });
    const task = await createTask(team._id, member._id, { payoutAmount: 30 });

    await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(200);

    const oldAfter = await BillingCredit.findById(old._id);
    const newAfter = await BillingCredit.findById(nw._id);

    // Oldest credit should be reduced; newer credit untouched
    expect(oldAfter.remaining).toBeCloseTo(70, 2);
    expect(newAfter.remaining).toBeCloseTo(100, 2);
  });

  it('spans multiple credits when amount exceeds a single credit', async () => {
    await createCredit(team._id, 30, { createdAt: new Date('2026-01-01') });
    await createCredit(team._id, 100, { createdAt: new Date('2026-03-01') });
    const task = await createTask(team._id, member._id, { payoutAmount: 80 });

    await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(200);

    const credits = await BillingCredit.find({ team: team._id }).sort({ createdAt: 1 });
    // First credit ($30) fully consumed → status='used', remaining=0
    expect(credits[0].remaining).toBeCloseTo(0, 2);
    expect(credits[0].status).toBe('used');
    // Second credit ($100): only $50 consumed
    expect(credits[1].remaining).toBeCloseTo(50, 2);
    expect(credits[1].status).toBe('active');
  });

  it('returns 402 when team wallet balance is insufficient', async () => {
    await createCredit(team._id, 10); // only $10
    const task = await createTask(team._id, member._id, { payoutAmount: 100 });

    const res = await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(402);

    expect(res.body.error).toMatch(/insufficient/i);
  });

  it('does not touch expired credits', async () => {
    // Expired credit — should be ignored
    await createCredit(team._id, 200, {
      createdAt: new Date('2026-01-01'),
      // set expiresAt in past via direct model update after create
    });
    // Manually expire it
    await BillingCredit.updateMany({ team: team._id }, { expiresAt: new Date('2020-01-01') });

    await createCredit(team._id, 100, { createdAt: new Date('2026-03-01') });
    const task = await createTask(team._id, member._id, { payoutAmount: 50 });

    await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(200);

    // Only the non-expired credit should be reduced
    const credits = await BillingCredit.find({ team: team._id, expiresAt: null }).lean();
    expect(credits[0].remaining).toBeCloseTo(50, 2);
  });
});

// ─── Suite 2: POST /api/teams/:id/tasks/:taskId/pay ─────────────────────────

describe('POST /api/teams/:id/tasks/:taskId/pay', () => {
  let owner, member, team;

  beforeEach(async () => {
    owner  = await createUser();
    member = await createUser();
    team   = await createTeam(owner, member);
  });

  it('pays a per_job task and returns 200', async () => {
    await createCredit(team._id, 100);
    const task = await createTask(team._id, member._id, { payoutAmount: 50 });

    const res = await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(200);

    expect(res.body.payoutId).toBeDefined();
    expect(res.body.amount).toBeCloseTo(50, 2);
  });

  it('pays a per_hour task using hoursApproved × hourlyRate', async () => {
    await createCredit(team._id, 500);
    const task = await createTask(team._id, member._id, {
      payoutType:    'per_hour',
      hourlyRate:    50,
      hoursApproved: 2,
      payoutAmount:  0, // not used for per_hour
    });

    const res = await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(200);

    expect(res.body.amount).toBeCloseTo(100, 2); // 2h × $50
  });

  it('marks task status=paid and payoutStatus=paid after payment', async () => {
    await createCredit(team._id, 100);
    const task = await createTask(team._id, member._id, { payoutAmount: 40 });

    await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(200);

    const updated = await TeamTask.findById(task._id);
    expect(updated.status).toBe('paid');
    expect(updated.payoutStatus).toBe('paid');
    expect(updated.payoutTransaction).toBeDefined();
  });

  it('creates a TeamPayout record with correct fields', async () => {
    await createCredit(team._id, 100);
    const task = await createTask(team._id, member._id, { payoutAmount: 60 });

    await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(200);

    const payout = await TeamPayout.findOne({ team: team._id });
    expect(payout).not.toBeNull();
    expect(payout.type).toBe('member_payout');
    expect(payout.amount).toBeCloseTo(60, 2);
    expect(payout.recipientUser.toString()).toBe(member._id.toString());
    expect(payout.status).toBe('completed');
    expect(payout.billingCreditIds.length).toBeGreaterThan(0);
  });

  it.skip('credits recipient personal wallet after payment — requires payments fully wired (fire-and-forget async, needs BillingCredit.create to resolve in test env)', async () => {
    await createCredit(team._id, 100);
    const task = await createTask(team._id, member._id, { payoutAmount: 45 });

    await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(200);

    // Personal wallet credit fires async after response — give it a moment
    await new Promise(r => setTimeout(r, 200));

    // BillingCredit for the recipient user should be created
    const userCredit = await BillingCredit.findOne({
      user: member._id,
      type: 'team_payout',
    });
    expect(userCredit).not.toBeNull();
    expect(userCredit.amount).toBeCloseTo(45, 2);
    expect(userCredit.status).toBe('active');
  });

  it('deducts the correct amount from team wallet', async () => {
    await createCredit(team._id, 200);
    const task = await createTask(team._id, member._id, { payoutAmount: 75 });

    await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(200);

    const credits = await BillingCredit.find({ team: team._id });
    const totalRemaining = credits.reduce((s, c) => s + c.remaining, 0);
    expect(totalRemaining).toBeCloseTo(125, 2); // 200 - 75
  });

  it('returns 402 when wallet balance is insufficient', async () => {
    await createCredit(team._id, 10);
    const task = await createTask(team._id, member._id, { payoutAmount: 100 });

    const res = await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(402);

    expect(res.body.error).toMatch(/insufficient/i);
    expect(res.body.error).toMatch(/\$10\.00 available/i);
  });

  it('returns 400 when task payoutStatus is not approved', async () => {
    await createCredit(team._id, 100);
    const task = await createTask(team._id, member._id, {
      payoutStatus: 'requested',
      status:       'in_progress',
    });

    const res = await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(400);

    expect(res.body.error).toMatch(/approved/i);
  });

  it('returns 400 when task has no assignee', async () => {
    await createCredit(team._id, 100);
    const task = await createTask(team._id, null); // no assignedTo

    const res = await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(400);

    expect(res.body.error).toMatch(/assignee/i);
  });

  it('returns 403 when requester lacks approve_payouts permission', async () => {
    await createCredit(team._id, 100);
    const task = await createTask(team._id, member._id);

    // member only has read_tasks permission
    const res = await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(member._id))
      .expect(403);

    expect(res.body.error).toMatch(/permission/i);
  });

  it('returns 404 when task does not exist', async () => {
    await request(app)
      .post(`/api/teams/${team._id}/tasks/${new mongoose.Types.ObjectId()}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(404);
  });

  it('returns 401 when not authenticated', async () => {
    const task = await createTask(team._id, member._id);
    await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .expect(401);
  });

  it('does not double-pay an already-paid task', async () => {
    await createCredit(team._id, 200);
    const task = await createTask(team._id, member._id, { payoutAmount: 50 });

    // First payment
    await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(200);

    // Second payment attempt — task is now 'paid', payoutStatus='paid' (not 'approved')
    const res = await request(app)
      .post(`/api/teams/${team._id}/tasks/${task._id}/pay`)
      .set('Authorization', authHeader(owner._id))
      .expect(400);

    expect(res.body.error).toMatch(/approved/i);

    // Only one payout record created
    const payouts = await TeamPayout.find({ team: team._id });
    expect(payouts).toHaveLength(1);
  });
});

// ─── Suite 3: GET /api/teams/:id/payouts ────────────────────────────────────

describe('GET /api/teams/:id/payouts', () => {
  let owner, member, team;

  beforeEach(async () => {
    owner  = await createUser();
    member = await createUser();
    team   = await createTeam(owner, member);
  });

  it('returns payout history for a team', async () => {
    // Seed two payout records directly
    await TeamPayout.create([
      { team: team._id, type: 'member_payout',    amount: 50,  status: 'completed', createdBy: owner._id },
      { team: team._id, type: 'outsource_payment', amount: 200, status: 'completed', createdBy: owner._id },
    ]);

    const res = await request(app)
      .get(`/api/teams/${team._id}/payouts`)
      .set('Authorization', authHeader(owner._id))
      .expect(200);

    expect(res.body.payouts.length).toBe(2);
  });

  it('returns payouts sorted newest first', async () => {
    await TeamPayout.create([
      { team: team._id, type: 'member_payout',     amount: 50,  status: 'completed', createdBy: owner._id, createdAt: new Date('2026-01-01') },
      { team: team._id, type: 'outsource_payment', amount: 200, status: 'completed', createdBy: owner._id, createdAt: new Date('2026-03-01') },
    ]);

    const res = await request(app)
      .get(`/api/teams/${team._id}/payouts`)
      .set('Authorization', authHeader(owner._id))
      .expect(200);

    expect(res.body.payouts.length).toBe(2);
    // newest first
    expect(res.body.payouts[0].amount).toBe(200);
    expect(res.body.payouts[1].amount).toBe(50);
  });

  it('returns 403 for member without view_wallet permission', async () => {
    await request(app)
      .get(`/api/teams/${team._id}/payouts`)
      .set('Authorization', authHeader(member._id))
      .expect(403);
  });

  it('returns 401 when unauthenticated', async () => {
    await request(app)
      .get(`/api/teams/${team._id}/payouts`)
      .expect(401);
  });
});
