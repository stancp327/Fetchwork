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
      console.log('🔍 AuthContext - fetchUser called');
      const response = await axios.get(`${apiBaseUrl}/api/auth/me`);
      const userData = response.data.user;
      
      const currentToken = localStorage.getItem('token');
      console.log('🔍 AuthContext - token from localStorage:', currentToken ? 'present' : 'missing');
      
      if (currentToken) {
        try {
          const decoded = jwtDecode(currentToken);
          console.log('🔍 AuthContext - decoded token:', decoded);
          const userWithAdmin = { ...userData, isAdmin: decoded.isAdmin };
          setUser(userWithAdmin);
          console.log('🔍 AuthContext - user set with admin flag:', userWithAdmin);
        } catch (decodeError) {
          console.error('❌ AuthContext - JWT decode error:', decodeError);
          logout();
          return;
        }
      } else {
        console.log('🔍 AuthContext - no token found');
        setUser(userData);
      }
    } catch (error) {
      console.error('❌ AuthContext - fetchUser error:', error);
      logout();
    } finally {
      setLoading(false);
      console.log('🔍 AuthContext - loading set to false');
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
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${apiBaseUrl}/api/auth/register`, userData);

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

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
