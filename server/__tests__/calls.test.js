const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Mock Call model before requiring routes
jest.mock('../models/Call', () => {
  const mockCall = {
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };
  return mockCall;
});

// Mock User model (needed by auth middleware)
jest.mock('../models/User', () => ({
  findById: jest.fn(),
}));

// Mock Admin model (needed by auth middleware)
jest.mock('../models/Admin', () => ({
  findOne: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Call = require('../models/Call');

// Build a test app
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/calls', require('../routes/calls'));
  return app;
};

// Helper: create a signed JWT and mock User.findById to return a user object
const mockAuthUser = (overrides = {}) => {
  const userId = overrides._id || 'user123';
  const user = {
    _id: userId,
    userId,
    isAdmin: false,
    role: 'user',
    isSuspended: false,
    toObject: function () { return { ...this }; },
    ...overrides,
  };
  User.findById.mockResolvedValue(user);
  const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');
  return { user, token };
};

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── relay-credentials tests ────────────────────────────────────────

describe('POST /api/calls/:id/relay-credentials', () => {
  it('returns 503 when TURN_AUTH_SECRET is unset', async () => {
    const origSecret = process.env.TURN_AUTH_SECRET;
    const origUrls = process.env.TURN_URLS;
    delete process.env.TURN_AUTH_SECRET;
    delete process.env.TURN_URLS;

    const { token } = mockAuthUser({ _id: 'caller1' });

    Call.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'call1',
          caller: 'caller1',
          recipient: 'recip1',
          status: 'active',
        }),
      }),
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/calls/call1/relay-credentials')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/TURN/i);

    // Restore
    if (origSecret) process.env.TURN_AUTH_SECRET = origSecret;
    if (origUrls) process.env.TURN_URLS = origUrls;
  });

  it('returns 200 with valid iceServers and correct HMAC when env vars are set', async () => {
    const secret = 'test-turn-secret';
    process.env.TURN_AUTH_SECRET = secret;
    process.env.TURN_URLS = 'turn:relay.example.com:3478?transport=udp';
    delete process.env.TURN_TTL_SECONDS;

    const { token } = mockAuthUser({ _id: 'caller1' });

    Call.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'call1',
          caller: 'caller1',
          recipient: 'recip1',
          status: 'active',
        }),
      }),
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/calls/call1/relay-credentials')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.iceServers).toBeDefined();
    expect(Array.isArray(res.body.iceServers)).toBe(true);

    // Verify HMAC structure — username should be "expiry:userId:callId"
    const turnServer = res.body.iceServers.find(s =>
      (Array.isArray(s.urls) ? s.urls : [s.urls]).some(u => u.startsWith('turn:'))
    );
    expect(turnServer).toBeDefined();
    expect(turnServer.username).toMatch(/^\d+:caller1:call1$/);
    expect(turnServer.credential).toBeTruthy();

    // Verify credential is valid HMAC-SHA1
    const expected = crypto
      .createHmac('sha1', secret)
      .update(turnServer.username)
      .digest('base64');
    expect(turnServer.credential).toBe(expected);

    // Cleanup
    delete process.env.TURN_AUTH_SECRET;
    delete process.env.TURN_URLS;
  });

  it('defaults TTL to 86400', async () => {
    process.env.TURN_AUTH_SECRET = 'secret';
    process.env.TURN_URLS = 'turn:relay.example.com:3478';
    delete process.env.TURN_TTL_SECONDS;

    const { token } = mockAuthUser({ _id: 'caller1' });

    Call.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'call1',
          caller: 'caller1',
          recipient: 'recip1',
          status: 'active',
        }),
      }),
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/calls/call1/relay-credentials')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ttlSeconds).toBe(86400);

    delete process.env.TURN_AUTH_SECRET;
    delete process.env.TURN_URLS;
  });

  it('returns 403 for non-participant', async () => {
    process.env.TURN_AUTH_SECRET = 'secret';
    process.env.TURN_URLS = 'turn:relay.example.com:3478';

    const { token } = mockAuthUser({ _id: 'outsider' });

    Call.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'call1',
          caller: 'caller1',
          recipient: 'recip1',
          status: 'active',
        }),
      }),
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/calls/call1/relay-credentials')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);

    delete process.env.TURN_AUTH_SECRET;
    delete process.env.TURN_URLS;
  });
});
