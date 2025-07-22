import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';

const Navigation = () => {
  const { user, isAuthenticated } = useAuth();
  const { currentRole, switchRole } = useRole();

  const handleRoleSwitch = (role) => {
    switchRole(role);
  };

  return (
    <nav className="navigation">
      <div className="nav-brand">
        <Link to="/">FetchWork</Link>
      </div>
      
      {isAuthenticated && (
        <div className="role-switcher">
          <button 
            className={`role-btn ${currentRole === 'freelancer' ? 'active' : ''}`}
            onClick={() => handleRoleSwitch('freelancer')}
          >
            Freelancer
          </button>
          <button 
            className={`role-btn ${currentRole === 'client' ? 'active' : ''}`}
            onClick={() => handleRoleSwitch('client')}
          >
            Client
          </button>
        </div>
      )}
      
      <div className="nav-links">
        {isAuthenticated ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            {currentRole === 'freelancer' ? (
              <>
                <Link to="/browse-jobs">Browse Jobs</Link>
                <Link to="/browse-services">Browse Services</Link>
                <Link to="/create-service">Create Service</Link>
              </>
            ) : (
              <>
                <Link to="/post-job">Post Job</Link>
                <Link to="/browse-services">Browse Services</Link>
              </>
            )}
            <Link to="/messages">Messages</Link>
            {user?.isAdmin && <Link to="/admin">Admin</Link>}
            <Link to="/profile">Profile</Link>
          </>
        ) : (
          <>
            <Link to="/browse-jobs">Browse Jobs</Link>
            <Link to="/browse-services">Browse Services</Link>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
