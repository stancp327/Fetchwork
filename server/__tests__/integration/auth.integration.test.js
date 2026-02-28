/**
 * Integration tests: /api/auth/*
 * Uses real in-memory MongoDB — no model mocks.
 */
const request  = require('supertest');
const mongoose = require('mongoose');
const { connectDB, clearDB, closeDB } = require('../setup/dbHelpers');
const { buildUser, createUser, signToken } = require('../../../test-utils/factories');

// Set test env before requiring app
process.env.JWT_SECRET       = 'test-secret-key-for-jest';
process.env.NODE_ENV         = 'test';
process.env.CLIENT_URL       = 'http://localhost:3000';
process.env.ADMIN_EMAILS     = 'admin@fetchwork.test';
process.env.SESSION_SECRET   = 'test-session-secret';

// Silence emails in integration tests
jest.mock('../../services/emailService', () => ({
  sendEmailVerification: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendJobNotificationEmail: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../services/emailWorkflowService', () => ({
  sendOnboardingSequence: jest.fn().mockResolvedValue(true),
}));

// Build app without starting the HTTP server
let app;
beforeAll(async () => {
  await connectDB();
  // Require app after DB is connected so Mongoose models register against the test DB
  const express   = require('express');
  const authRoute = require('../../routes/auth');
  app = express();
  app.use(express.json());
  app.use('/api/auth', authRoute);
});

afterEach(clearDB);
afterAll(closeDB);

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('creates a user and returns 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(buildUser({ email: 'new@test.com', password: 'TestPass123!' }));
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('new@test.com');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('returns 400 when email already exists', async () => {
    await createUser({ email: 'dup@test.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send(buildUser({ email: 'dup@test.com' }));
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when required fields missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'incomplete@test.com' });
    expect(res.status).toBe(400);
  });

  it('rejects a weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(buildUser({ password: '123' }));
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('returns token on valid credentials', async () => {
    await createUser({ email: 'login@test.com', password: 'TestPass123!' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'TestPass123!' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 401 on wrong password', async () => {
    await createUser({ email: 'badpw@test.com' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'badpw@test.com', password: 'WrongPassword!' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@test.com', password: 'TestPass123!' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for suspended account', async () => {
    await createUser({ email: 'suspended@test.com', isSuspended: true, isActive: false });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'suspended@test.com', password: 'TestPass123!' });
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns user for valid JWT', async () => {
    const user = await createUser({ email: 'me@test.com' });
    const token = signToken(user._id);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@test.com');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with expired token', async () => {
    const user = await createUser({ email: 'expiry@test.com' });
    const token = signToken(user._id, 'user', { exp: Math.floor(Date.now() / 1000) - 60 });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
