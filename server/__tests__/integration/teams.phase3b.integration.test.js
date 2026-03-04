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
let member;
let clientUser;

const Team = require('../../models/Team');
const TeamClient = require('../../models/TeamClient');
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

async function createTeamDoc() {
  return Team.create({
    name: 'Phase3b Team',
    type: 'agency',
    owner: owner._id,
    members: [
      {
        user: owner._id,
        role: 'owner',
        permissions: ['manage_members', 'manage_billing', 'approve_orders', 'assign_work'],
        status: 'active',
        joinedAt: new Date(),
      },
      {
        user: member._id,
        role: 'member',
        permissions: ['view_analytics'],
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
  owner = await createUser({ email: 'owner3b@test.com', firstName: 'Owner', lastName: 'ThreeB' });
  member = await createUser({ email: 'member3b@test.com', firstName: 'Member', lastName: 'ThreeB' });
  clientUser = await createUser({ email: 'client3b@test.com', firstName: 'Client', lastName: 'ThreeB' });
});

afterAll(closeDB);

describe('Teams integration — phase 3b custom roles + linked clients', () => {
  it('creates a custom role and assigns it to a member', async () => {
    const team = await createTeamDoc();

    const createRes = await request(app)
      .post(`/api/teams/${team._id}/custom-roles`)
      .set('Authorization', authHeader(owner._id))
      .send({
        name: 'Finance Reviewer',
        permissions: ['manage_billing', 'approve_orders'],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.customRoles.length).toBe(1);

    const assignRes = await request(app)
      .patch(`/api/teams/${team._id}/members/${member._id}/custom-role`)
      .set('Authorization', authHeader(owner._id))
      .send({ customRoleName: 'Finance Reviewer' });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.member.customRoleName).toBe('Finance Reviewer');
  });

  it('blocks deleting a custom role that is assigned to an active member', async () => {
    const team = await createTeamDoc();

    await request(app)
      .post(`/api/teams/${team._id}/custom-roles`)
      .set('Authorization', authHeader(owner._id))
      .send({ name: 'Ops Manager', permissions: ['assign_work'] });

    await request(app)
      .patch(`/api/teams/${team._id}/members/${member._id}/custom-role`)
      .set('Authorization', authHeader(owner._id))
      .send({ customRoleName: 'Ops Manager' });

    const fresh = await Team.findById(team._id);
    const roleId = String(fresh.customRoles[0]._id);

    const delRes = await request(app)
      .delete(`/api/teams/${team._id}/custom-roles/${roleId}`)
      .set('Authorization', authHeader(owner._id));

    expect(delRes.status).toBe(400);
    expect(delRes.body.error).toMatch(/assigned to active members/i);
  });

  it('links and unlinks a client relationship', async () => {
    const team = await createTeamDoc();

    const linkRes = await request(app)
      .post(`/api/teams/${team._id}/clients`)
      .set('Authorization', authHeader(owner._id))
      .send({
        clientUserId: String(clientUser._id),
        accessLevel: 'collaborate',
        projectLabel: 'Kitchen Remodel',
      });

    expect(linkRes.status).toBe(201);
    expect(linkRes.body.client.accessLevel).toBe('collaborate');

    const listRes = await request(app)
      .get(`/api/teams/${team._id}/clients`)
      .set('Authorization', authHeader(owner._id));

    expect(listRes.status).toBe(200);
    expect(listRes.body.clients.length).toBe(1);

    const unlinkRes = await request(app)
      .delete(`/api/teams/${team._id}/clients/${clientUser._id}`)
      .set('Authorization', authHeader(owner._id));

    expect(unlinkRes.status).toBe(200);
    expect(unlinkRes.body.success).toBe(true);

    const rel = await TeamClient.findOne({ team: team._id, client: clientUser._id });
    expect(rel).toBeTruthy();
    expect(rel.isActive).toBe(false);
  });

  it('allows only linked client to access client access snapshot', async () => {
    const team = await createTeamDoc();

    await request(app)
      .post(`/api/teams/${team._id}/clients`)
      .set('Authorization', authHeader(owner._id))
      .send({ clientUserId: String(clientUser._id), accessLevel: 'view_assigned' });

    const forbiddenRes = await request(app)
      .get(`/api/teams/${team._id}/clients/${clientUser._id}/access`)
      .set('Authorization', authHeader(member._id));

    expect(forbiddenRes.status).toBe(403);

    const okRes = await request(app)
      .get(`/api/teams/${team._id}/clients/${clientUser._id}/access`)
      .set('Authorization', authHeader(clientUser._id));

    expect(okRes.status).toBe(200);
    expect(okRes.body.accessLevel).toBe('view_assigned');
    expect(okRes.body.team.id).toBeDefined();
  });

  it('supports owner/admin user lookup for linking clients and excludes active members', async () => {
    const team = await createTeamDoc();

    const ownerLookup = await request(app)
      .get(`/api/teams/${team._id}/user-lookup?q=client3b`)
      .set('Authorization', authHeader(owner._id));

    expect(ownerLookup.status).toBe(200);
    expect(Array.isArray(ownerLookup.body.users)).toBe(true);
    expect(ownerLookup.body.users.some((u) => String(u._id) === String(clientUser._id))).toBe(true);
    expect(ownerLookup.body.users.some((u) => String(u._id) === String(member._id))).toBe(false);

    const memberLookup = await request(app)
      .get(`/api/teams/${team._id}/user-lookup?q=client3b`)
      .set('Authorization', authHeader(member._id));

    expect(memberLookup.status).toBe(403);
  });
});
