/**
 * Integration tests: /api/reviews
 * Key invariants: no double-submit, requires completed job.
 */
const request = require('supertest');
const { connectDB, clearDB, closeDB } = require('../setup/dbHelpers');
const { createUser, createJob, createReview, authHeader } = require('../../../test-utils/factories');

process.env.JWT_SECRET     = 'test-secret-key-for-jest';
process.env.NODE_ENV       = 'test';
process.env.SESSION_SECRET = 'test-session-secret';

jest.mock('../../services/emailService', () => ({ sendEmailVerification: jest.fn() }));
jest.mock('stripe', () => jest.fn(() => ({})));

let app, client, freelancer, completedJob;

beforeAll(async () => {
  await connectDB();
  const express      = require('express');
  const reviewsRoute = require('../../routes/reviews');
  app = express();
  app.use(express.json());
  app.use('/api/reviews', reviewsRoute);
});

beforeEach(async () => {
  await clearDB();
  client     = await createUser({ accountType: 'client' });
  freelancer = await createUser({ accountType: 'freelancer' });
  completedJob = await createJob(client._id, {
    status:     'completed',
    freelancer: freelancer._id,
  });
});

afterAll(closeDB);

describe('POST /api/reviews', () => {
  const reviewBody = () => ({
    jobId:    completedJob._id.toString(),
    rating:   5,
    comment:  'Excellent work!',
  });

  it('client can review freelancer on completed job', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', authHeader(client._id))
      .send({ ...reviewBody(), revieweeId: freelancer._id.toString() });
    expect([200, 201]).toContain(res.status);
  });

  it('prevents double-submit from same reviewer', async () => {
    await createReview(client._id, freelancer._id, completedJob._id);
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', authHeader(client._id))
      .send({ ...reviewBody(), revieweeId: freelancer._id.toString() });
    expect([400, 409]).toContain(res.status);
  });

  it('rejects review for non-completed job', async () => {
    const openJob = await createJob(client._id, {
      status: 'in_progress',
      freelancer: freelancer._id,
    });
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', authHeader(client._id))
      .send({
        jobId:      openJob._id.toString(),
        revieweeId: freelancer._id.toString(),
        rating:     5,
        comment:    'Too early',
      });
    expect([400, 403]).toContain(res.status);
  });

  it('rejects invalid rating (out of 1–5)', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', authHeader(client._id))
      .send({ ...reviewBody(), revieweeId: freelancer._id.toString(), rating: 10 });
    expect([400, 422]).toContain(res.status);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/reviews').send(reviewBody());
    expect(res.status).toBe(401);
  });
});
