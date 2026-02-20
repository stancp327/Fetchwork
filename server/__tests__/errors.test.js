const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-key-for-jest';
process.env.NODE_ENV = 'test';

jest.mock('../config/env', () => ({
  PORT: 3001,
  MONGO_URI: 'mongodb://localhost/test',
  JWT_SECRET: 'test-secret-key-for-jest',
  CLIENT_URL: 'http://localhost:3000',
  ADMIN_EMAILS: ['admin@fetchwork.com'],
}));

const mockUser = {
  _id: '507f1f77bcf86cd799439022',
  userId: '507f1f77bcf86cd799439022',
  email: 'user@test.com',
  firstName: 'Test',
  lastName: 'User',
  isVerified: true,
  isActive: true,
  isSuspended: false,
};

const mockAdmin = {
  _id: '507f1f77bcf86cd799439033',
  userId: '507f1f77bcf86cd799439033',
  email: 'admin@fetchwork.com',
  firstName: 'Admin',
  lastName: 'User',
  isAdmin: true,
  isActive: true,
  isSuspended: false,
  role: 'admin',
  toObject() {
    return { ...this };
  },
  getPublicProfile: jest.fn(),
  hasPermission: () => true,
};

const mockError = {
  _id: '507f1f77bcf86cd799439044',
  message: 'Cannot read properties of undefined',
  stack: 'Error: Cannot read properties...',
  name: 'TypeError',
  source: 'server',
  severity: 'high',
  resolved: false,
  occurrences: 3,
  lastSeenAt: new Date(),
  createdAt: new Date(),
  save: jest.fn().mockResolvedValue(true),
};

jest.mock('../models/ServerError', () => {
  const Mock = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: '507f1f77bcf86cd799439044',
    save: jest.fn().mockResolvedValue(true),
  }));
  Mock.find = jest.fn();
  Mock.findById = jest.fn();
  Mock.findOne = jest.fn();
  Mock.findOneAndUpdate = jest.fn();
  Mock.countDocuments = jest.fn();
  Mock.aggregate = jest.fn();
  Mock.updateMany = jest.fn();
  Mock.deleteMany = jest.fn();
  Mock.create = jest.fn();
  return Mock;
});

jest.mock('../models/User', () => {
  const UserMock = jest.fn();
  UserMock.findById = jest.fn();
  return UserMock;
});

const ServerError = require('../models/ServerError');
const User = require('../models/User');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/errors', require('../routes/errors'));
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
};

const generateToken = (user = mockUser) => {
  return jwt.sign(
    { userId: user._id, email: user.email },
    'test-secret-key-for-jest',
    { expiresIn: '1h' }
  );
};

const generateAdminToken = () => {
  return jwt.sign(
    { userId: mockAdmin._id, email: mockAdmin.email, isAdmin: true, role: 'admin' },
    'test-secret-key-for-jest',
    { expiresIn: '1h' }
  );
};

describe('Errors API', () => {
  let app;
  let token;
  let adminToken;

  beforeEach(() => {
    app = createApp();
    token = generateToken();
    adminToken = generateAdminToken();
    jest.clearAllMocks();
    User.findById.mockImplementation((id) => {
      if (id === mockAdmin._id || id?.toString() === mockAdmin._id) return Promise.resolve(mockAdmin);
      return Promise.resolve(mockUser);
    });
  });

  describe('POST /api/errors/client', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/errors/client')
        .send({ message: 'Test error' });

      expect(res.status).toBe(401);
    });

    it('should log a client error', async () => {
      ServerError.findOneAndUpdate.mockResolvedValue(null);
      ServerError.create.mockResolvedValue(mockError);

      const res = await request(app)
        .post('/api/errors/client')
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: 'Cannot read property of undefined',
          stack: 'TypeError: Cannot read...',
          url: 'https://fetchwork.net/dashboard',
          component: 'Dashboard'
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Error logged');
    });

    it('should require error message', async () => {
      const res = await request(app)
        .post('/api/errors/client')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/errors/admin/stats', () => {
    it('should require admin auth', async () => {
      const res = await request(app)
        .get('/api/errors/admin/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });

    it('should return error stats for admin', async () => {
      ServerError.countDocuments
        .mockResolvedValueOnce(50)   // total
        .mockResolvedValueOnce(30)   // unresolved
        .mockResolvedValueOnce(5)    // critical
        .mockResolvedValueOnce(8);   // today

      ServerError.aggregate
        .mockResolvedValueOnce([{ _id: 'server', count: 20 }, { _id: 'client', count: 10 }])
        .mockResolvedValueOnce([{ _id: 'high', count: 15 }, { _id: 'medium', count: 10 }])
        .mockResolvedValueOnce([{ _id: '2026-02-20', count: 8 }]);

      const res = await request(app)
        .get('/api/errors/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(50);
      expect(res.body.unresolved).toBe(30);
      expect(res.body.critical).toBe(5);
      expect(res.body.bySource).toBeDefined();
    });
  });

  describe('GET /api/errors/admin', () => {
    it('should return paginated errors for admin', async () => {
      const chainMock = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue([mockError]),
      };
      ServerError.find.mockReturnValue(chainMock);
      ServerError.countDocuments.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/errors/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeDefined();
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter by severity', async () => {
      const chainMock = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue([]),
      };
      ServerError.find.mockReturnValue(chainMock);
      ServerError.countDocuments.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/errors/admin?severity=critical')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /api/errors/admin/:id/resolve', () => {
    it('should resolve an error', async () => {
      ServerError.findById.mockResolvedValue({
        ...mockError,
        save: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app)
        .patch(`/api/errors/admin/${mockError._id}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resolved: true, notes: 'Fixed in PR #110' });

      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent error', async () => {
      ServerError.findById.mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/errors/admin/507f1f77bcf86cd799439099/resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resolved: true });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/errors/admin/bulk-resolve', () => {
    it('should bulk resolve errors', async () => {
      ServerError.updateMany.mockResolvedValue({ modifiedCount: 3 });

      const res = await request(app)
        .post('/api/errors/admin/bulk-resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: ['id1', 'id2', 'id3'] });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('3');
    });

    it('should reject empty ids', async () => {
      const res = await request(app)
        .post('/api/errors/admin/bulk-resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [] });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/errors/admin/cleanup', () => {
    it('should clean up old resolved errors', async () => {
      ServerError.deleteMany.mockResolvedValue({ deletedCount: 10 });

      const res = await request(app)
        .delete('/api/errors/admin/cleanup')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('10');
    });
  });
});
