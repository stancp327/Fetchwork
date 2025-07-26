import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

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

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  defaults: {
    headers: {
      common: {}
    }
  }
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn()
}));

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!user) {
    return <div>Redirecting to login...</div>;
  }
  
  return children;
};

const TestProtectedRoute = ({ children }) => {
  return (
    <BrowserRouter>
      <ProtectedRoute>
        {children}
      </ProtectedRoute>
    </BrowserRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  test('should show loading state initially', () => {
    useAuth.mockReturnValue({
      user: null,
      loading: true
    });
    
    render(
      <TestProtectedRoute>
        <div>Protected Content</div>
      </TestProtectedRoute>
    );
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('should redirect to login when no user', () => {
    useAuth.mockReturnValue({
      user: null,
      loading: false
    });
    
    render(
      <TestProtectedRoute>
        <div>Protected Content</div>
      </TestProtectedRoute>
    );
    
    expect(screen.getByText('Redirecting to login...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('should render protected content when user is authenticated', () => {
    useAuth.mockReturnValue({
      user: { 
        id: '123', 
        email: 'test@example.com', 
        firstName: 'Test', 
        lastName: 'User' 
      },
      loading: false
    });
    
    render(
      <TestProtectedRoute>
        <div>Protected Content</div>
      </TestProtectedRoute>
    );
    
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  test('should handle authentication errors gracefully', () => {
    useAuth.mockReturnValue({
      user: null,
      loading: false
    });
    
    render(
      <TestProtectedRoute>
        <div>Protected Content</div>
      </TestProtectedRoute>
    );
    
    expect(screen.getByText('Redirecting to login...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
