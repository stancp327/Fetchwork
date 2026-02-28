/**
 * factories.js — create realistic test documents.
 *
 * Two modes:
 *   buildXxx(overrides) — returns a plain object (no DB write, for unit tests)
 *   createXxx(overrides) — saves to DB and returns the document (for integration)
 *
 * Usage:
 *   const { buildUser, createUser, buildJob, createJob } = require('../../test-utils/factories');
 */
const { faker } = require('@faker-js/faker');

// ─────────────────────────────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────────────────────────────
const buildUser = (overrides = {}) => ({
  email:       faker.internet.email().toLowerCase(),
  password:    'TestPass123!',
  firstName:   faker.person.firstName(),
  lastName:    faker.person.lastName(),
  accountType: 'both',
  isVerified:  true,
  isActive:    true,
  isSuspended: false,
  role:        'user',
  providers:   ['local'],
  skills:      ['JavaScript', 'React'],
  bio:         faker.lorem.sentence(),
  hourlyRate:  50,
  ...overrides,
});

const createUser = async (overrides = {}) => {
  const User   = require('../server/models/User');
  const bcrypt = require('bcryptjs');
  const data   = buildUser(overrides);
  if (data.password) {
    data.password = await bcrypt.hash(data.password, 10);
  }
  return User.create(data);
};

const createAdmin = (overrides = {}) =>
  createUser({ role: 'admin', email: 'admin@fetchwork.test', ...overrides });

// ─────────────────────────────────────────────────────────────────────────────
// Job
// ─────────────────────────────────────────────────────────────────────────────
const buildJob = (overrides = {}) => ({
  title:       faker.lorem.words(5),
  description: faker.lorem.paragraph(),
  category:    'Web Development',
  skills:      ['JavaScript', 'Node.js'],
  budget:      { type: 'fixed', amount: 500, currency: 'USD' },
  duration:    '1_2_weeks',
  experienceLevel: 'intermediate',
  status:      'open',
  isActive:    true,
  deadline:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  proposals:   [],
  milestones:  [],
  ...overrides,
});

const createJob = async (clientId, overrides = {}) => {
  const Job  = require('../server/models/Job');
  const data = buildJob({ client: clientId, ...overrides });
  return Job.create(data);
};

// ─────────────────────────────────────────────────────────────────────────────
// Proposal (sub-document — not a standalone model)
// ─────────────────────────────────────────────────────────────────────────────
const buildProposal = (freelancerId, overrides = {}) => ({
  freelancer:    freelancerId,
  coverLetter:   faker.lorem.paragraph(),
  proposedBudget: 400,
  proposedDuration: '1_2_weeks',
  status:        'pending',
  createdAt:     new Date(),
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// Message / Conversation
// ─────────────────────────────────────────────────────────────────────────────
const buildMessage = (senderId, recipientId, conversationId, overrides = {}) => ({
  conversation: conversationId,
  sender:       senderId,
  recipient:    recipientId,
  content:      faker.lorem.sentence(),
  messageType:  'text',
  isRead:       false,
  ...overrides,
});

const createConversation = async (user1Id, user2Id, overrides = {}) => {
  const { Conversation } = require('../server/models/Message');
  return Conversation.create({
    participants: [user1Id, user2Id],
    ...overrides,
  });
};

const createMessage = async (senderId, recipientId, conversationId, overrides = {}) => {
  const { Message } = require('../server/models/Message');
  return Message.create(buildMessage(senderId, recipientId, conversationId, overrides));
};

// ─────────────────────────────────────────────────────────────────────────────
// Review
// ─────────────────────────────────────────────────────────────────────────────
const buildReview = (reviewerId, revieweeId, jobId, overrides = {}) => ({
  reviewer:  reviewerId,
  reviewee:  revieweeId,
  job:       jobId,
  rating:    faker.number.int({ min: 3, max: 5 }),
  comment:   faker.lorem.sentences(2),
  moderationStatus: 'approved',
  ...overrides,
});

const createReview = async (reviewerId, revieweeId, jobId, overrides = {}) => {
  const Review = require('../server/models/Review');
  return Review.create(buildReview(reviewerId, revieweeId, jobId, overrides));
};

// ─────────────────────────────────────────────────────────────────────────────
// Payment
// ─────────────────────────────────────────────────────────────────────────────
const buildPayment = (clientId, freelancerId, jobId, overrides = {}) => ({
  client:          clientId,
  freelancer:      freelancerId,
  job:             jobId,
  amount:          500,
  netAmount:       450,    // after 10% fee
  platformFee:     50,
  currency:        'USD',
  type:            'escrow',
  status:          'pending',
  stripePaymentIntentId: `pi_test_${faker.string.alphanumeric(24)}`,
  ...overrides,
});

const createPayment = async (clientId, freelancerId, jobId, overrides = {}) => {
  const Payment = require('../server/models/Payment');
  return Payment.create(buildPayment(clientId, freelancerId, jobId, overrides));
};

// ─────────────────────────────────────────────────────────────────────────────
// JWT helpers
// ─────────────────────────────────────────────────────────────────────────────
const signToken = (userId, role = 'user', overrides = {}) => {
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'test-secret-key-for-jest';
  return jwt.sign(
    { userId: userId.toString(), role, ...overrides },
    secret,
    { expiresIn: '1h' }
  );
};

const authHeader = (userId, role = 'user') =>
  `Bearer ${signToken(userId, role)}`;

module.exports = {
  // builders (plain objects)
  buildUser, buildJob, buildProposal, buildMessage, buildReview, buildPayment,
  // creators (write to DB)
  createUser, createAdmin, createJob, createConversation, createMessage,
  createReview, createPayment,
  // auth helpers
  signToken, authHeader,
};
