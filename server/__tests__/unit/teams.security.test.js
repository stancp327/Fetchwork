const request = require('supertest');
const express = require('express');

process.env.NODE_ENV = 'test';

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      _id: 'owner-user-id',
      userId: 'owner-user-id',
      id: 'owner-user-id',
      email: 'owner@test.com',
    };
    next();
  },
}));

jest.mock('../../models/User', () => ({
  findByIdAndUpdate: jest.fn().mockResolvedValue(true),
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  findOne: jest.fn(),
}));

jest.mock('../../models/BillingCredit', () => ({
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
      limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    }),
  }),
}));

jest.mock('../../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../models/TeamAuditLog', () => ({
  logSafe: jest.fn().mockResolvedValue(true),
  find: jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
  }),
  countDocuments: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../models/Team', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  updateOne: jest.fn(),
}));

const Team = require('../../models/Team');
const TeamAuditLog = require('../../models/TeamAuditLog');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/teams', require('../../routes/teams'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
};

const createTeamDoc = (overrides = {}) => {
  const members = overrides.members || [
    {
      _id: 'owner-member-row',
      user: 'owner-user-id',
      role: 'owner',
      status: 'active',
      permissions: ['manage_members', 'manage_billing', 'approve_orders', 'assign_work'],
      title: 'Owner',
    },
    {
      _id: 'target-member-row',
      user: 'target-user-id',
      role: 'member',
      status: 'active',
      permissions: ['view_analytics'],
      title: 'Contributor',
    },
  ];

  return {
    _id: 'team-1',
    isActive: true,
    transferState: 'idle',
    transferTargetUserId: null,
    lockVersion: 0,
    owner: 'owner-user-id',
    members,
    getMember(userId) {
      return members.find((m) => String(m.user) === String(userId) && m.status === 'active') || null;
    },
    ...overrides,
  };
};

describe('Teams security and race-safety routes', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  it('returns 409 when member role update conflicts on lockVersion', async () => {
    const team = createTeamDoc();
    Team.findById.mockResolvedValue(team);
    Team.updateOne.mockResolvedValue({ modifiedCount: 0 });

    const res = await request(app)
      .patch('/api/teams/team-1/members/target-user-id')
      .send({ role: 'manager' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Team changed while updating member/i);
    expect(TeamAuditLog.logSafe).not.toHaveBeenCalled();
  });

  it('blocks delete when ownership transfer is in progress', async () => {
    const team = createTeamDoc({ transferState: 'applying' });
    Team.findById.mockResolvedValue(team);

    const res = await request(app).delete('/api/teams/team-1');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ownership transfer is in progress/i);
  });

  it('transfers ownership with two-phase conditional updates and audit logs', async () => {
    const team = createTeamDoc();
    const populatedUpdated = {
      ...team,
      owner: { _id: 'target-user-id', firstName: 'New', lastName: 'Owner' },
      members: team.members,
      toObject: undefined,
    };

    Team.findById
      .mockResolvedValueOnce(team)
      .mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(populatedUpdated),
      });

    Team.updateOne
      .mockResolvedValueOnce({ modifiedCount: 1 })
      .mockResolvedValueOnce({ modifiedCount: 1 });

    const res = await request(app)
      .post('/api/teams/team-1/transfer-ownership')
      .send({ targetUserId: 'target-user-id' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Ownership transferred');
    expect(Team.updateOne).toHaveBeenCalledTimes(2);
    expect(TeamAuditLog.logSafe).toHaveBeenCalledTimes(2);
  });

  it('allows owner/admin to read audit logs with pagination envelope', async () => {
    const team = createTeamDoc();
    Team.findById.mockResolvedValue(team);

    const res = await request(app).get('/api/teams/team-1/audit-logs?page=1&limit=20');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('logs');
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination.limit).toBe(20);
  });
});

