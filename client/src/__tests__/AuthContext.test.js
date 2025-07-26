import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import axios from 'axios';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  defaults: {
    headers: {
      common: {}
    }
  }
}));

const mockAxios = axios;

const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost',
    href: 'http://localhost:3000'
  },
  writable: true
});

const TestComponent = () => {
  const { user, loading, login, logout, isAuthenticated } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="user">{user ? JSON.stringify(user) : 'no-user'}</div>
      <button onClick={() => login('test@example.com', 'password')} data-testid="login-btn">
        Login
      </button>
      <button onClick={logout} data-testid="logout-btn">
        Logout
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    delete axios.defaults.headers.common['Authorization'];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize with loading state', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
  });

  test('should handle no token in localStorage', async () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });

  test('should fetch user data when valid token exists', async () => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiaXNBZG1pbiI6ZmFsc2UsImV4cCI6OTk5OTk5OTk5OX0.Ks_BdfH4CKJHSIpM-9gAhcufMkgO6AikvvzlpOLvtpY';
    const mockUser = { id: '123', email: 'test@example.com', firstName: 'Test', lastName: 'User' };

    mockLocalStorage.getItem.mockReturnValue(mockToken);
    mockAxios.get.mockResolvedValueOnce({
      data: { user: mockUser }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify({...mockUser, isAdmin: false}));
    expect(mockAxios.get).toHaveBeenCalledWith('http://localhost:10000/api/auth/me');
  });

  test('should handle expired token', async () => {
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiaXNBZG1pbiI6ZmFsc2UsImV4cCI6MTAwMDAwMDAwMH0.Ks_BdfH4CKJHSIpM-9gAhcufMkgO6AikvvzlpOLvtpY';
    
    mockLocalStorage.getItem.mockReturnValue(expiredToken);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
  });

  test('should handle successful login', async () => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiaXNBZG1pbiI6ZmFsc2UsImV4cCI6OTk5OTk5OTk5OX0.Ks_BdfH4CKJHSIpM-9gAhcufMkgO6AikvvzlpOLvtpY';
    const mockUser = { id: '123', email: 'test@example.com', firstName: 'Test', lastName: 'User' };

    mockAxios.post.mockResolvedValueOnce({
      data: { token: mockToken, user: mockUser }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', mockToken);
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
    expect(mockAxios.defaults.headers.common['Authorization']).toBe(`Bearer ${mockToken}`);
  });

  test('should handle login failure', async () => {
    mockAxios.post.mockRejectedValueOnce({
      response: { data: { error: 'Invalid credentials' } }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
    expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
  });

  test('should handle logout', async () => {
    const mockToken = 'existing-token';
    mockLocalStorage.getItem.mockReturnValue(mockToken);

    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    await act(async () => {
      screen.getByTestId('logout-btn').click();
    });

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
    expect(window.location.href).toBe('/login');
  });

  test('should detect admin user correctly', async () => {
    const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiaXNBZG1pbiI6dHJ1ZSwiZXhwIjo5OTk5OTk5OTk5fQ.Ks_BdfH4CKJHSIpM-9gAhcufMkgO6AikvvzlpOLvtpY';
    const mockAdminUser = { id: '123', email: 'admin@fetchwork.com', firstName: 'Admin', lastName: 'User' };

    mockLocalStorage.getItem.mockReturnValue(adminToken);
    mockAxios.get.mockResolvedValueOnce({
      data: { user: mockAdminUser }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify({...mockAdminUser, isAdmin: true}));
  });
});
