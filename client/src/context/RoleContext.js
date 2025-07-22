import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const RoleContext = createContext();

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};

export const RoleProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentRole, setCurrentRole] = useState(() => {
    const savedRole = localStorage.getItem('userRole');
    return savedRole || 'freelancer';
  });

  useEffect(() => {
    localStorage.setItem('userRole', currentRole);
  }, [currentRole]);

  useEffect(() => {
    if (!user) {
      setCurrentRole('freelancer');
      localStorage.removeItem('userRole');
    }
  }, [user]);

  const switchRole = (role) => {
    if (role === 'client' || role === 'freelancer') {
      setCurrentRole(role);
    }
  };

  const value = {
    currentRole,
    switchRole,
    isFreelancerMode: currentRole === 'freelancer',
    isClientMode: currentRole === 'client'
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
};
