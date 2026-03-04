/**
 * Day 12 integration tests for messaging safety/upload/authz hardening.
 */
const request = require('supertest');
const express = require('express');
const { connectDB, clearDB, closeDB } = require('../setup/dbHelpers');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');

process.env.JWT_SECRET = 'test-secret-key-for-jest';
process.env.NODE_ENV = 'test';

const createUser = async (overrides = {}) => {
  const base = {
    email: `u_${Date.now()}_${Math.random().toString(16).slice(2)}@test.com`,
    password: await bcrypt.hash('TestPass123!', 10),
    firstName: 'Test',
    lastName: 'User',
    accountType: 'both',
    isVerified: true,
    isActive: true,
    isSuspended: false,
    role: 'user',
    providers: ['local'],
  };
  return User.create({ ...base, ...overrides });
};

const createAdmin = async (overrides = {}) => createUser({ role: 'admin', ...overrides });
const signToken = (userId, role = 'user') => jwt.sign({ userId: userId.toString(), role }, process.env.JWT_SECRET, { expiresIn: '1h' });

let app;

beforeAll(async () => {
  await connectDB();
  const messagesRoute = require('../../routes/messages');
  app = express();
  app.use(express.json());
  app.use('/api/messages', messagesRoute);
});

afterEach(clearDB);
afterAll(closeDB);

describe('POST /api/messages/assets/sign', () => {
  it('returns fallback signing contract when provider config is missing', async () => {
    const user = await createUser({ email: 'signer@test.com' });
    const token = signToken(user._id);

    const res = await request(app)
      .post('/api/messages/assets/sign')
      .set('Authorization', `Bearer ${token}`)
      .send({ filename: 'file.png', mime: 'image/png', size: 1024 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('assetId');
    expect(res.body).toHaveProperty('provider');
    expect(res.body).toHaveProperty('expiresAt');
  });
});

describe('GET /api/messages/moderation/events', () => {
  it('rejects non-admin users', async () => {
    const user = await createUser({ email: 'normal@test.com', role: 'user' });
    const token = signToken(user._id, 'user');

    const res = await request(app)
      .get('/api/messages/moderation/events')
      .set('Authorization', `Bearer ${token}`);

    expect([401, 403]).toContain(res.status);
  });

  it('allows admins with moderation permission baseline', async () => {
    const admin = await createAdmin({ email: 'admin2@fetchworktest.com' });
    const token = signToken(admin._id, 'admin');

    const res = await request(app)
      .get('/api/messages/moderation/events')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });
});

describe('validateMessage compatibility', () => {
  it('accepts attachment-only send with assetRefs', async () => {
    const sender = await createUser({ email: 'sender@test.com' });
    const recipient = await createUser({ email: 'recipient@test.com' });
    const token = signToken(sender._id);

    const res = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        recipientId: recipient._id.toString(),
        assetRefs: [{ assetId: 'asset_abc', url: 'https://example.com/a.png', mime: 'image/png', size: 1234 }],
      });

    expect(res.status).toBe(201);
    expect(res.body?.data?.attachments?.length || 0).toBeGreaterThan(0);
  });
});
