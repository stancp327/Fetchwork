/**
 * MSW (Mock Service Worker) server setup for React Testing Library tests.
 * Import this in any test file that needs API mocks:
 *
 *   import { server } from './setup/server';
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 */
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// ── Default handlers ────────────────────────────────────────────
// Override per-test with server.use(http.get(...)) as needed.

export const handlers = [
  // Auth
  http.post('/api/auth/login', ({ request }) =>
    HttpResponse.json({
      token: 'mock-jwt-token',
      user:  { _id: 'user1', id: 'user1', email: 'test@test.com', firstName: 'Test', lastName: 'User', accountType: 'both', role: 'user' },
    })
  ),
  http.post('/api/auth/register', () =>
    HttpResponse.json({
      token: 'mock-jwt-token',
      user:  { _id: 'user1', id: 'user1', email: 'new@test.com', firstName: 'New', lastName: 'User', accountType: 'both' },
    }, { status: 201 })
  ),
  http.get('/api/auth/me', () =>
    HttpResponse.json({
      user: { _id: 'user1', id: 'user1', email: 'test@test.com', firstName: 'Test', lastName: 'User', accountType: 'both', role: 'user', isVerified: true },
    })
  ),

  // Jobs
  http.get('/api/jobs', () =>
    HttpResponse.json({
      jobs:       [],
      pagination: { page: 1, limit: 10, total: 0, pages: 0 },
    })
  ),
  http.post('/api/jobs', () =>
    HttpResponse.json({ job: { _id: 'job1', title: 'Mock Job', status: 'open' } }, { status: 201 })
  ),

  // Notifications
  http.get('/api/notifications', () =>
    HttpResponse.json({ notifications: [], unreadCount: 0 })
  ),

  // Dashboard
  http.get('/api/users/dashboard', () =>
    HttpResponse.json({
      stats: { unreadMessages: 0, pendingProposals: 0, activeJobs: 0 },
      recentJobs: [],
    })
  ),

  // Freelancers
  http.get('/api/freelancers', () =>
    HttpResponse.json({ freelancers: [], pagination: { total: 0, pages: 0 } })
  ),

  // Messages
  http.get('/api/messages/conversations', () =>
    HttpResponse.json({ conversations: [] })
  ),
];

export const server = setupServer(...handlers);
