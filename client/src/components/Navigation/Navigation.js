import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import './Navigation.css';

const Navigation = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { currentRole, switchRole } = useRole();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleRoleSwitch = (role) => {
    switchRole(role);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="navigation">
      <div className="nav-brand">
        <Link to="/" className="brand-link">
          <img src="/fetchwork-logo.png" alt="FetchWork" className="nav-logo" />
          <span className="brand-text">FetchWork</span>
        </Link>
      </div>
      
      {isAuthenticated && (
        <div className="role-switcher">
          <span className="role-label">Viewing as:</span>
          <div className="role-toggle">
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
        </div>
      )}

      <button 
        className={`mobile-menu-toggle ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={toggleMobileMenu}
        aria-label="Toggle mobile menu"
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>
      
      <div 
        className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}
        data-role={isAuthenticated ? currentRole : ''}
      >
        {isAuthenticated ? (
          <>
            <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>Dashboard</Link>
            {currentRole === 'freelancer' ? (
              <>
                <Link to="/browse-jobs" onClick={() => setIsMobileMenuOpen(false)}>Browse Jobs</Link>
                <Link to="/browse-services" onClick={() => setIsMobileMenuOpen(false)}>Browse Services</Link>
                <Link to="/create-service" onClick={() => setIsMobileMenuOpen(false)}>Create Service</Link>
              </>
            ) : (
              <>
                <Link to="/post-job" onClick={() => setIsMobileMenuOpen(false)}>Post Job</Link>
                <Link to="/browse-services" onClick={() => setIsMobileMenuOpen(false)}>Browse Services</Link>
              </>
            )}
            <Link to="/messages" onClick={() => setIsMobileMenuOpen(false)}>Messages</Link>
            {user?.isAdmin && <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)}>Admin</Link>}
            <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)}>Profile</Link>
            <button className="nav-logout-btn" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/browse-jobs" onClick={() => setIsMobileMenuOpen(false)}>Browse Jobs</Link>
            <Link to="/browse-services" onClick={() => setIsMobileMenuOpen(false)}>Browse Services</Link>
            <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>Login</Link>
            <Link to="/register" onClick={() => setIsMobileMenuOpen(false)}>Register</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
