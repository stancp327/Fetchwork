import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AdminContext = createContext();

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://fetchwork-1.onrender.com';
};

export const AdminProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken'));

  const apiBaseUrl = getApiBaseUrl();

  const fetchAdminProfile = useCallback(async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/api/admin/profile`);
      setAdmin(response.data.admin);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch admin profile:', error);
      adminLogout();
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (adminToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${adminToken}`;
      fetchAdminProfile();
    } else {
      setLoading(false);
    }
  }, [adminToken, fetchAdminProfile]);


  const adminLogin = async (email, password) => {
    try {
      const response = await axios.post(`${apiBaseUrl}/api/admin/login`, {
        email,
        password
      });

      const { token: newToken, admin: adminData } = response.data;
      
      localStorage.setItem('adminToken', newToken);
      setAdminToken(newToken);
      setAdmin(adminData);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

      return { success: true, admin: adminData };
    } catch (error) {
      console.error('Admin login failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Admin login failed' 
      };
    }
  };

  const adminLogout = () => {
    localStorage.removeItem('adminToken');
    setAdminToken(null);
    setAdmin(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const setTempAdminToken = (token) => {
    localStorage.setItem('adminToken', token);
    setAdminToken(token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setAdmin({ email: 'admin@fetchwork.com', role: 'super_admin' });
    setLoading(false);
  };

  const value = {
    admin,
    loading,
    adminLogin,
    adminLogout,
    setTempAdminToken,
    isAdminAuthenticated: !!admin
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};
