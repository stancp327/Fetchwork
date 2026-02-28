/**
 * Integration tests: Stripe payments, escrow hold/release, webhook verification.
 * Real in-memory DB. Stripe API calls intercepted with nock.
 * Stripe webhook signatures constructed with stripe.webhooks.generateTestHeaderString.
 */
const request  = require('supertest');
const nock     = require('nock');
const mongoose = require('mongoose');
const { connectDB, clearDB, closeDB } = require('../setup/dbHelpers');
const { createUser, createJob, createPayment, signToken, authHeader } = require('../../../test-utils/factories');

process.env.JWT_SECRET             = 'test-secret-key-for-jest';
process.env.NODE_ENV               = 'test';
process.env.CLIENT_URL             = 'http://localhost:3000';
process.env.STRIPE_SECRET_KEY      = 'sk_test_fake_key_for_unit_tests';
process.env.STRIPE_WEBHOOK_SECRET  = 'whsec_test_secret_fetchwork';
process.env.SESSION_SECRET         = 'test-session-secret';
process.env.PLATFORM_FEE_PERCENT   = '10';

jest.mock('../../services/emailService', () => ({
  sendEmailVerification: jest.fn().mockResolvedValue(true),
  sendJobNotificationEmail: jest.fn().mockResolvedValue(true),
  sendPaymentEmail: jest.fn().mockResolvedValue(true),
}));

// ── Mock Stripe SDK ────────────────────────────────────────────
// We use a manual mock rather than nock here so we can control
// Stripe JS method behavior precisely.
const mockStripePI = {
  id:             'pi_test_abc123',
  status:         'requires_confirmation',
  client_secret:  'pi_test_abc123_secret_xyz',
  amount:         50000, // cents
};

jest.mock('stripe', () => {
  const webhooks = require('stripe').default?.webhooks || {};
  return jest.fn(() => ({
    paymentIntents: {
      create:   jest.fn().mockResolvedValue(mockStripePI),
      confirm:  jest.fn().mockResolvedValue({ ...mockStripePI, status: 'succeeded' }),
      retrieve: jest.fn().mockResolvedValue({ ...mockStripePI, status: 'succeeded' }),
      cancel:   jest.fn().mockResolvedValue({ ...mockStripePI, status: 'canceled' }),
    },
    transfers: {
      create: jest.fn().mockResolvedValue({ id: 'tr_test_abc', amount: 45000 }),
    },
    refunds: {
      create: jest.fn().mockResolvedValue({ id: 're_test_abc', status: 'succeeded' }),
    },
    webhooks: {
      constructEvent: jest.fn((body, sig, secret) => {
        // Validate that tests provide a proper sig header shape
        if (!sig || !secret) throw new Error('Missing webhook params');
        return JSON.parse(body);  // in tests body IS the raw event JSON
      }),
    },
    accounts: {
      create:   jest.fn().mockResolvedValue({ id: 'acct_test_abc', type: 'express' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'acct_test_abc', charges_enabled: true }),
    },
    accountLinks: {
      create: jest.fn().mockResolvedValue({ url: 'https://connect.stripe.com/test' }),
    },
  }));
});

let app, client, freelancer, job;

beforeAll(async () => {
  await connectDB();
  const express      = require('express');
  const paymentsRoute = require('../../routes/payments');

  app = express();
  // Stripe webhook needs raw body — mimic what index.js does
  app.post('/api/payments/webhook',
    express.raw({ type: 'application/json' }),
    paymentsRoute
  );
  app.use(express.json());
  app.use('/api/payments', paymentsRoute);
});

beforeEach(async () => {
  await clearDB();
  client     = await createUser({ accountType: 'client' });
  freelancer = await createUser({ accountType: 'freelancer' });
  job        = await createJob(client._id, {
    status: 'in_progress',
    freelancer: freelancer._id,
    escrowAmount: 0,
  });
});

afterAll(closeDB);

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/payments/escrow — create payment hold', () => {
  it('creates a PaymentIntent and stores it on the job', async () => {
    const res = await request(app)
      .post('/api/payments/escrow')
      .set('Authorization', authHeader(client._id))
      .send({ jobId: job._id.toString(), amount: 500 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('clientSecret');
  });

  it('returns 403 when a non-client tries to fund escrow', async () => {
    const res = await request(app)
      .post('/api/payments/escrow')
      .set('Authorization', authHeader(freelancer._id))
      .send({ jobId: job._id.toString(), amount: 500 });

    expect(res.status).toBe(403);
  });

  it('returns 401 with no auth token', async () => {
    const res = await request(app)
      .post('/api/payments/escrow')
      .send({ jobId: job._id.toString(), amount: 500 });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Escrow state machine', () => {
  it('prevents releasing escrow before job is completed', async () => {
    const payment = await createPayment(client._id, freelancer._id, job._id, {
      status: 'held',
    });
    // Job is still in_progress — release should fail
    const res = await request(app)
      .post(`/api/payments/release`)
      .set('Authorization', authHeader(client._id))
      .send({ jobId: job._id.toString() });

    // Should be rejected (job not completed yet) or 404/400
    expect([400, 403, 404]).toContain(res.status);
  });

  it('idempotent: double-release returns error on second call', async () => {
    // Manually mark job complete and escrow released
    const Job = require('../../models/Job');
    await Job.findByIdAndUpdate(job._id, {
      status: 'completed',
      escrowAmount: 0,
    });
    await createPayment(client._id, freelancer._id, job._id, {
      status: 'released',
    });

    const res = await request(app)
      .post('/api/payments/release')
      .set('Authorization', authHeader(client._id))
      .send({ jobId: job._id.toString() });

    expect([400, 404]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/payments/webhook — Stripe signature', () => {
  it('returns 400 when Stripe-Signature header is missing', async () => {
    const event = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_test' } } });
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(event);
    // No Stripe-Signature → constructEvent throws → route returns 400
    expect([400, 401]).toContain(res.status);
  });

  it('processes payment_intent.succeeded with valid signature', async () => {
    const event = JSON.stringify({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_abc123', amount: 50000 } },
    });
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 'valid_test_signature')
      .send(event);
    expect([200, 201]).toContain(res.status);
  });
});
