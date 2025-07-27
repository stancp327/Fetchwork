import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://fetchwork-1.onrender.com';
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const apiBaseUrl = getApiBaseUrl();

  const fetchUser = useCallback(async () => {
    try {
      const currentToken = localStorage.getItem('token');
      
      if (!currentToken) {
        setLoading(false);
        return;
      }

      try {
        const decoded = jwtDecode(currentToken);
        
        if (decoded.exp * 1000 < Date.now()) {
          logout();
          return;
        }
      } catch (decodeError) {
        console.error('❌ AuthContext - JWT decode error:', decodeError);
        logout();
        return;
      }

      const response = await axios.get(`${apiBaseUrl}/api/auth/me`);
      const userData = response.data.user;
      
      const decoded = jwtDecode(currentToken);
      const userWithAdmin = { ...userData, isAdmin: decoded.isAdmin };
      setUser(userWithAdmin);
    } catch (error) {
      console.error('❌ AuthContext - fetchUser error:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        logout();
      } else {
        setLoading(false);
      }
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${apiBaseUrl}/api/auth/login`, {
        email,
        password
      });

      const { token: newToken, user: userData } = response.data;
      
      const decoded = jwtDecode(newToken);
      const userWithAdmin = { ...userData, isAdmin: decoded.isAdmin };
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userWithAdmin);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      return { success: true, user: userWithAdmin };
    } catch (error) {
      console.error('Login failed:', error);
      const errorData = error.response?.data;
      return { 
        success: false, 
        error: errorData?.error || 'Login failed',
        requiresVerification: errorData?.requiresVerification || false
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${apiBaseUrl}/api/auth/register`, userData);

      if (response.data.requiresVerification) {
        return { 
          success: true, 
          requiresVerification: true,
          message: response.data.message 
        };
      }

      const { token: newToken, user: newUser } = response.data;
      
      const decoded = jwtDecode(newToken);
      const userWithAdmin = { ...newUser, isAdmin: decoded.isAdmin };
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userWithAdmin);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      return { success: true, user: userWithAdmin };
    } catch (error) {
      console.error('Registration failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Registration failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    sessionStorage.clear();
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
    
    window.location.href = '/login';
  };

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  };

  const requestPasswordReset = async (email) => {
    try {
      await axios.post(`${apiBaseUrl}/api/auth/forgot-password`, { email });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Password reset request failed' };
    }
  };

  const resetPassword = async (token, password) => {
    try {
      await axios.post(`${apiBaseUrl}/api/auth/reset-password`, { token, password });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Password reset failed' };
    }
  };

  const verifyEmail = async (token) => {
    try {
      await axios.get(`${apiBaseUrl}/api/auth/verify-email?token=${token}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Email verification failed' };
    }
  };

  const setAuthFromOAuth = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    requestPasswordReset,
    resetPassword,
    verifyEmail,
    setAuthFromOAuth,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
