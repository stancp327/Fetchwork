import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getApiBaseUrl } from '../utils/api';

// ---------------------------------------------------------------------------
// Lightweight fetch wrapper — replaces axios in this file.
// Throws an error shaped like axios errors so callers don't need to change:
//   error.response.status  — HTTP status code
//   error.response.data    — parsed JSON body
// ---------------------------------------------------------------------------
const apiFetch = async (method, path, body) => {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.response = { status: res.status, data };
    throw err;
  }
  return { data, status: res.status };
};

// ---------------------------------------------------------------------------

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken]     = useState(localStorage.getItem('token'));

  // ── fetchUser ────────────────────────────────────────────────────────────
  const fetchUser = useCallback(async () => {
    try {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) { setLoading(false); return; }

      try {
        const decoded = jwtDecode(currentToken);
        if (decoded.exp * 1000 < Date.now()) { logout(); return; }
      } catch {
        logout(); return;
      }

      const { data } = await apiFetch('GET', '/api/auth/me');
      setUser({ ...data.user, isAdmin: data.user.isAdmin });
    } catch (error) {
      console.error('❌ AuthContext - fetchUser error:', error);
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        logout();
        console.log('Session expired or unauthorized. Redirecting to login.');
        alert('Your session has expired or you are not authorized. You will be redirected to the login page.');
      }
      else setLoading(false);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (token) fetchUser();
    else setLoading(false);
  }, [token, fetchUser]);

  // ── login ────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    try {
      const { data } = await apiFetch('POST', '/api/auth/login', { email, password });
      const { token: newToken, user: userData } = data;
      const decoded = jwtDecode(newToken);
      const userWithAdmin = { ...userData, isAdmin: decoded.isAdmin };
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userWithAdmin);
      return { success: true, user: userWithAdmin };
    } catch (error) {
      console.error('Login failed:', error);
      const errorData = error.response?.data;
      return {
        success: false,
        error: errorData?.error || 'Login failed',
        requiresVerification: errorData?.requiresVerification || false,
      };
    }
  };

  // ── register ─────────────────────────────────────────────────────────────
  const register = async (userData) => {
    try {
      const { data } = await apiFetch('POST', '/api/auth/register', userData);
      if (data.requiresVerification) {
        return { success: true, requiresVerification: true, message: data.message };
      }
      const { token: newToken, user: newUser } = data;
      const decoded = jwtDecode(newToken);
      const userWithAdmin = { ...newUser, isAdmin: decoded.isAdmin };
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userWithAdmin);
      return { success: true, user: userWithAdmin };
    } catch (error) {
      console.error('Registration failed:', error);
      const errData = error.response?.data;
      let msg = errData?.error || 'Registration failed';
      if (errData?.details?.length) {
        msg = errData.details.map(d => d.msg).join('. ');
      }
      return { success: false, error: msg };
    }
  };

  // ── logout ───────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      await apiFetch('POST', '/api/auth/logout');
    } catch (_) {
      // best-effort; continue local logout
    }

    localStorage.removeItem('token');
    sessionStorage.clear();
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  // ── misc ─────────────────────────────────────────────────────────────────
  const updateUser = (userData) => setUser(prev => ({ ...prev, ...userData }));

  const requestPasswordReset = async (email) => {
    try {
      await apiFetch('POST', '/api/auth/forgot-password', { email });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Password reset request failed' };
    }
  };

  const resetPassword = async (token, password) => {
    try {
      await apiFetch('POST', '/api/auth/reset-password', { token, password });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Password reset failed' };
    }
  };

  const verifyEmail = async (token) => {
    try {
      await apiFetch('GET', `/api/auth/verify-email?token=${token}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Email verification failed' };
    }
  };

  const setAuthFromOAuth = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const value = {
    user, loading,
    login, register, logout, updateUser,
    requestPasswordReset, resetPassword, verifyEmail,
    setAuthFromOAuth,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
