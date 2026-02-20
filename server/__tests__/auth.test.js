const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// ── Mocks ───────────────────────────────────────────────────────
// Mock env config before anything else
jest.mock('../config/env', () => ({
  PORT: 3001,
  MONGO_URI: 'mongodb://localhost/test',
  JWT_SECRET: 'test-secret-key-for-jest',
  CLIENT_URL: 'http://localhost:3000',
  ADMIN_EMAILS: ['admin@fetchwork.com', 'test-admin@test.com'],
}));

// Mock User model
const mockUser = {
  _id: '507f1f77bcf86cd799439011',
  email: 'test@test.com',
  password: 'hashedpassword',
  firstName: 'Test',
  lastName: 'User',
  accountType: 'both',
  isVerified: true,
  isActive: true,
  isSuspended: false,
  role: 'user',
  createdAt: new Date('2024-01-01'),
  providers: [],
  comparePassword: jest.fn(),
  save: jest.fn().mockResolvedValue(true),
};

jest.mock('../models/User', () => {
  const UserMock = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: '507f1f77bcf86cd799439011',
    save: jest.fn().mockResolvedValue(true),
  }));
  UserMock.findOne = jest.fn();
  UserMock.findById = jest.fn();
  return UserMock;
});

// Mock email services
jest.mock('../services/emailService', () => ({
  sendEmailVerification: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/emailWorkflowService', () => ({
  sendOnboardingSequence: jest.fn().mockResolvedValue(true),
}));

// Mock passport
jest.mock('passport', () => ({
  authenticate: jest.fn(() => (req, res, next) => next()),
}));

// Mock middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { _id: '507f1f77bcf86cd799439011' };
    next();
  },
}));

// Simpler validation mock — just pass through
jest.mock('../middleware/validation', () => ({
  validateRegister: (req, res, next) => next(),
  validateLogin: (req, res, next) => next(),
}));

const User = require('../models/User');
const authRouter = require('../routes/auth');

// ── App Setup ───────────────────────────────────────────────────
function createApp() {
  const app = express();
  app.use(express.json());
  app.locals._resendIp = new Map();
  app.locals._resendEmail = new Map();
  app.use('/api/auth', authRouter);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────
describe('Auth Routes', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  // ── Register ──────────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      User.findOne.mockResolvedValue(null); // no existing user

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'new@test.com',
          password: 'Test1234!',
          confirmPassword: 'Test1234!',
          firstName: 'New',
          lastName: 'User',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/registration successful/i);
      expect(res.body.requiresVerification).toBe(true);
    });

    it('should reject duplicate email', async () => {
      User.findOne.mockResolvedValue(mockUser); // existing user

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@test.com',
          password: 'Test1234!',
          confirmPassword: 'Test1234!',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already exists/i);
    });
  });

  // ── Login ─────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginUser = { ...mockUser, comparePassword: jest.fn().mockResolvedValue(true) };
      User.findOne.mockResolvedValue(loginUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'Test1234!' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('test@test.com');
    });

    it('should reject invalid email', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@test.com', password: 'Test1234!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });

    it('should reject wrong password', async () => {
      const loginUser = { ...mockUser, comparePassword: jest.fn().mockResolvedValue(false) };
      User.findOne.mockResolvedValue(loginUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'WrongPass1!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });

    it('should reject suspended accounts', async () => {
      const suspendedUser = {
        ...mockUser,
        isSuspended: true,
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(suspendedUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'Test1234!' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/suspended/i);
    });

    it('should reject deactivated accounts', async () => {
      const inactiveUser = {
        ...mockUser,
        isActive: false,
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(inactiveUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'Test1234!' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/deactivated/i);
    });

    it('should return valid JWT token on login', async () => {
      const loginUser = { ...mockUser, comparePassword: jest.fn().mockResolvedValue(true) };
      User.findOne.mockResolvedValue(loginUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'Test1234!' });

      expect(res.status).toBe(200);
      const decoded = jwt.verify(res.body.token, 'test-secret-key-for-jest');
      expect(decoded.userId).toBe(mockUser._id);
    });

    it('should grant admin to admin emails', async () => {
      const adminUser = {
        ...mockUser,
        email: 'test-admin@test.com',
        role: 'user',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(adminUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test-admin@test.com', password: 'Test1234!' });

      expect(res.status).toBe(200);
      expect(res.body.user.isAdmin).toBe(true);
    });
  });

  // ── Get Current User ──────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('should return current user', async () => {
      User.findById.mockResolvedValue(mockUser);

      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('test@test.com');
      expect(res.body.user.firstName).toBe('Test');
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(404);
    });
  });

  // ── Email Verification ────────────────────────────────────────
  describe('GET /api/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      const verifyUser = {
        ...mockUser,
        isVerified: false,
        emailVerificationToken: 'valid-token',
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(verifyUser);

      const res = await request(app)
        .get('/api/auth/verify-email')
        .query({ token: 'valid-token' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/verified successfully/i);
      expect(verifyUser.save).toHaveBeenCalled();
    });

    it('should reject invalid/expired token', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/auth/verify-email')
        .query({ token: 'bad-token' });

      expect(res.status).toBe(400);
    });
  });

  // ── Password Reset ────────────────────────────────────────────
  describe('POST /api/auth/forgot-password', () => {
    it('should send reset email for valid user', async () => {
      const resetUser = { ...mockUser, save: jest.fn().mockResolvedValue(true) };
      User.findOne.mockResolvedValue(resetUser);

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/reset email/i);
      expect(resetUser.save).toHaveBeenCalled();
    });

    it('should return same response for nonexistent email (no leak)', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/reset email/i);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const resetUser = {
        ...mockUser,
        resetPasswordToken: 'valid-reset-token',
        resetPasswordExpires: Date.now() + 3600000,
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(resetUser);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'valid-reset-token', password: 'NewPass1234!' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/reset successfully/i);
    });

    it('should reject invalid reset token', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'bad-token', password: 'NewPass1234!' });

      expect(res.status).toBe(400);
    });
  });

  // ── Resend Verification ───────────────────────────────────────
  describe('POST /api/auth/resend-verification', () => {
    it('should return generic response regardless of email existence', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nobody@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if an account exists/i);
    });

    it('should return generic response for verified users', async () => {
      User.findOne.mockResolvedValue({ ...mockUser, isVerified: true });

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if an account exists/i);
    });

    it('should reject missing email', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ── Admin Recovery ────────────────────────────────────────────
  describe('POST /api/auth/recover-admin', () => {
    it('should reject invalid recovery key', async () => {
      const res = await request(app)
        .post('/api/auth/recover-admin')
        .send({ email: 'admin@fetchwork.com', recoveryKey: 'wrong-key' });

      expect(res.status).toBe(401);
    });
  });
});
