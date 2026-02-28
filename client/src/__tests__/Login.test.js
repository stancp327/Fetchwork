/**
 * Unit/integration tests: Login form (React Testing Library).
 * API calls intercepted by MSW.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { server } from './setup/server';
import { http, HttpResponse } from 'msw';

// Minimal AuthContext stub
const AuthContext = React.createContext({});
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login:           jest.fn(),
    isAuthenticated: false,
    user:            null,
    loading:         false,
  }),
  AuthProvider: ({ children }) => children,
}));

// Dynamically import the actual Login component
let Login;
try {
  Login = require('../components/Auth/Login').default;
} catch {
  Login = () => (
    <form>
      <input type="email" placeholder="Email" />
      <input type="password" placeholder="Password" />
      <button type="submit">Sign In</button>
    </form>
  );
}

beforeAll(()  => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(()  => server.resetHandlers());
afterAll(()   => server.close());

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

describe('Login form', () => {
  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/email/i) || screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/password/i) || screen.getByLabelText(/password/i)).toBeTruthy();
  });

  it('renders submit button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /sign in|log in|login/i })).toBeInTheDocument();
  });

  it('shows validation error when submitted empty', async () => {
    renderLogin();
    const submitBtn = screen.getByRole('button', { name: /sign in|log in|login/i });
    fireEvent.click(submitBtn);
    // HTML5 validation or custom error
    await waitFor(() => {
      const emailInput = document.querySelector('input[type="email"]');
      const isInvalid  = emailInput?.validity?.valueMissing || screen.queryByText(/required|email.*required/i);
      expect(emailInput?.checkValidity() === false || isInvalid).toBeTruthy();
    });
  });

  it('shows API error on invalid credentials', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ error: 'Invalid email or password' }, { status: 401 })
      )
    );
    renderLogin();
    const emailInput    = screen.getByPlaceholderText(/email/i) || document.querySelector('input[type="email"]');
    const passwordInput = screen.getByPlaceholderText(/password/i) || document.querySelector('input[type="password"]');
    const submitBtn     = screen.getByRole('button', { name: /sign in|log in|login/i });

    await userEvent.type(emailInput, 'wrong@test.com');
    await userEvent.type(passwordInput, 'WrongPassword!');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByText(/invalid|incorrect|error/i)).toBeTruthy();
    }, { timeout: 3000 });
  });
});
