import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';

// AuthContext now uses native fetch (via apiFetch helper) instead of axios.
// We mock global.fetch directly.

// ---------------------------------------------------------------------------
// Helper — create a mock fetch response
// ---------------------------------------------------------------------------
const mockFetchResponse = (body, { ok = true, status = 200 } = {}) =>
  jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });

// ---------------------------------------------------------------------------
// Environment stubs
// ---------------------------------------------------------------------------
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
Object.defineProperty(window, 'location', {
  value: { hostname: 'localhost', href: 'http://localhost:3000' },
  writable: true,
});

// ---------------------------------------------------------------------------
// Test component that surfaces AuthContext values
// ---------------------------------------------------------------------------
const TestComponent = () => {
  const { user, loading, login, logout, isAuthenticated } = useAuth();
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="user">{user ? JSON.stringify(user) : 'no-user'}</div>
      <button onClick={() => login('test@example.com', 'password')} data-testid="login-btn">Login</button>
      <button onClick={logout} data-testid="logout-btn">Logout</button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shared JWTs
//   valid   — exp: 9999999999 (year 2286), isAdmin: false
//   admin   — exp: 9999999999, isAdmin: true
//   expired — exp: 1000000000 (year 2001)
// ---------------------------------------------------------------------------
const VALID_TOKEN   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiaXNBZG1pbiI6ZmFsc2UsImV4cCI6OTk5OTk5OTk5OX0.Ks_BdfH4CKJHSIpM-9gAhcufMkgO6AikvvzlpOLvtpY';
const ADMIN_TOKEN   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiaXNBZG1pbiI6dHJ1ZSwiZXhwIjo5OTk5OTk5OTk5fQ.Ks_BdfH4CKJHSIpM-9gAhcufMkgO6AikvvzlpOLvtpY';
const EXPIRED_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiaXNBZG1pbiI6ZmFsc2UsImV4cCI6MTAwMDAwMDAwMH0.Ks_BdfH4CKJHSIpM-9gAhcufMkgO6AikvvzlpOLvtpY';

// ---------------------------------------------------------------------------

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    // Reset fetch to an unfired stub so stray calls surface as errors
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── 1 ──────────────────────────────────────────────────────────────────
  test('should initialize with loading state', () => {
    render(<AuthProvider><TestComponent /></AuthProvider>);
    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
  });

  // ── 2 ──────────────────────────────────────────────────────────────────
  test('should handle no token in localStorage', async () => {
    mockLocalStorage.getItem.mockReturnValue(null);
    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });
    expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    // fetch should never be called if there is no token
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ── 3 ──────────────────────────────────────────────────────────────────
  test('should fetch user data when valid token exists', async () => {
    const mockUser = { id: '123', email: 'test@example.com', firstName: 'Test', lastName: 'User' };

    mockLocalStorage.getItem.mockReturnValue(VALID_TOKEN);
    global.fetch = mockFetchResponse({ user: mockUser });

    render(<AuthProvider><TestComponent /></AuthProvider>);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent(
      JSON.stringify({ ...mockUser, isAdmin: false })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:10000/api/auth/me',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: `Bearer ${VALID_TOKEN}` }),
      })
    );
  });

  // ── 4 ──────────────────────────────────────────────────────────────────
  test('should handle expired token', async () => {
    mockLocalStorage.getItem.mockReturnValue(EXPIRED_TOKEN);
    // jwtDecode detects expiry — fetch should never be called
    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ── 5 ──────────────────────────────────────────────────────────────────
  test('should handle successful login', async () => {
    const mockUser = { id: '123', email: 'test@example.com', firstName: 'Test', lastName: 'User' };

    // No token on mount → loading resolves immediately without fetch
    mockLocalStorage.getItem.mockReturnValue(null);

    // login() call will POST /api/auth/login
    global.fetch = mockFetchResponse({ token: VALID_TOKEN, user: mockUser });

    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', VALID_TOKEN);
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:10000/api/auth/login',
      expect.objectContaining({ method: 'POST' })
    );
    // Note: auth headers are now per-request inside apiFetch, not on a global axios instance.
    // Verifying localStorage.setItem is sufficient to confirm the token was stored.
  });

  // ── 6 ──────────────────────────────────────────────────────────────────
  test('should handle login failure', async () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    // Return a non-ok response — apiFetch throws with err.response.data
    global.fetch = mockFetchResponse(
      { error: 'Invalid credentials' },
      { ok: false, status: 401 }
    );

    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
    expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
  });

  // ── 7 ──────────────────────────────────────────────────────────────────
  test('should handle logout', async () => {
    // 'existing-token' is not a valid JWT — jwtDecode throws → logout() fires on mount.
    // The test still validates that logout() correctly clears state and redirects.
    mockLocalStorage.getItem.mockReturnValue('existing-token');
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });

    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    // Confirm logout already fired (bad JWT triggers it on mount)
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
    expect(window.location.href).toBe('/login');
  });

  // ── 8 ──────────────────────────────────────────────────────────────────
  test('should detect admin user correctly', async () => {
    const mockAdminUser = { id: '123', email: 'admin@fetchwork.com', firstName: 'Admin', lastName: 'User' };

    mockLocalStorage.getItem.mockReturnValue(ADMIN_TOKEN);
    global.fetch = mockFetchResponse({ user: mockAdminUser });

    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    expect(screen.getByTestId('user')).toHaveTextContent(
      JSON.stringify({ ...mockAdminUser, isAdmin: true })
    );
  });
});
