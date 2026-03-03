const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectDB, clearDB, closeDB } = require('../setup/dbHelpers');

process.env.JWT_SECRET = 'test-secret-key-for-jest';
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = 'http://localhost:3000';

jest.mock('../../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

let app;
let owner;
let target;
let admin;

const Team = require('../../models/Team');
const TeamAuditLog = require('../../models/TeamAuditLog');
const User = require('../../models/User');

const authHeader = (userId) => {
  const token = jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return `Bearer ${token}`;
};

const createUser = async ({ email, firstName, lastName }) => {
  const password = await bcrypt.hash('TestPass123!', 10);
  return User.create({
    email,
    password,
    firstName,
    lastName,
    accountType: 'both',
    isVerified: true,
    isActive: true,
    isSuspended: false,
    role: 'user',
    providers: ['local'],
  });
};

async function createTeamDoc({ transferState = 'idle' } = {}) {
  return Team.create({
    name: 'Integration Team',
    type: 'agency',
    owner: owner._id,
    transferState,
    members: [
      {
        user: owner._id,
        role: 'owner',
        permissions: ['manage_members', 'manage_billing', 'approve_orders', 'assign_work'],
        status: 'active',
        joinedAt: new Date(),
      },
      {
        user: target._id,
        role: 'member',
        permissions: ['view_analytics'],
        status: 'active',
        joinedAt: new Date(),
      },
      {
        user: admin._id,
        role: 'admin',
        permissions: ['manage_members', 'view_analytics'],
        status: 'active',
        joinedAt: new Date(),
      },
    ],
  });
}

beforeAll(async () => {
  await connectDB();
  const express = require('express');
  app = express();
  app.use(express.json());
  app.use('/api/teams', require('../../routes/teams'));
});

beforeEach(async () => {
  await clearDB();
  owner = await createUser({ email: 'owner@test.com', firstName: 'Owner', lastName: 'User' });
  target = await createUser({ email: 'target@test.com', firstName: 'Target', lastName: 'User' });
  admin = await createUser({ email: 'adminmember@test.com', firstName: 'Admin', lastName: 'User' });
});

afterAll(closeDB);

describe('Teams integration — ownership, delete guards, and audit logs', () => {
  it('transfers ownership and updates roles atomically', async () => {
    const team = await createTeamDoc();

    const res = await request(app)
      .post(`/api/teams/${team._id}/transfer-ownership`)
      .set('Authorization', authHeader(owner._id))
      .send({ targetUserId: target._id.toString() });

    expect(res.status).toBe(200);

    const fresh = await Team.findById(team._id);
    expect(String(fresh.owner)).toBe(String(target._id));
    expect(fresh.transferState).toBe('idle');

    const oldOwnerMember = fresh.members.find((m) => String(m.user) === String(owner._id));
    const newOwnerMember = fresh.members.find((m) => String(m.user) === String(target._id));

    expect(oldOwnerMember.role).toBe('admin');
    expect(newOwnerMember.role).toBe('owner');

    const logs = await TeamAuditLog.find({ team: team._id, action: { $in: ['ownership_transfer_started', 'ownership_transferred'] } });
    expect(logs.length).toBe(2);
  });

  it('blocks delete while ownership transfer is in progress', async () => {
    const team = await createTeamDoc({ transferState: 'applying' });

    const res = await request(app)
      .delete(`/api/teams/${team._id}`)
      .set('Authorization', authHeader(owner._id));

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ownership transfer is in progress/i);
  });

  it('returns 409 on member update when transfer is not idle', async () => {
    const team = await createTeamDoc({ transferState: 'applying' });

    const res = await request(app)
      .patch(`/api/teams/${team._id}/members/${target._id}`)
      .set('Authorization', authHeader(owner._id))
      .send({ role: 'manager' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Team changed while updating member/i);
  });

  it('allows owner/admin to read team audit logs', async () => {
    const team = await createTeamDoc();
    await TeamAuditLog.create({
      team: team._id,
      actor: owner._id,
      action: 'member_role_updated',
      targetUser: target._id,
      before: { role: 'member' },
      after: { role: 'manager' },
    });

    const ownerRes = await request(app)
      .get(`/api/teams/${team._id}/audit-logs?page=1&limit=10`)
      .set('Authorization', authHeader(owner._id));

    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.logs.length).toBeGreaterThanOrEqual(1);
    expect(ownerRes.body.pagination.limit).toBe(10);

    const adminRes = await request(app)
      .get(`/api/teams/${team._id}/audit-logs?page=1&limit=10`)
      .set('Authorization', authHeader(admin._id));

    expect(adminRes.status).toBe(200);
  });
});
