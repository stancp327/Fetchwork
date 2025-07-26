import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationBadge from './NotificationBadge';
import './Navigation.css';

const Navigation = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { currentRole, switchRole } = useRole();
  const { notifications } = useNotifications();
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

  const closeMobileMenu = () => {
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
      
      {isAuthenticated && (user?.accountType === 'freelancer' || user?.accountType === 'both') && (
        <div className="role-switcher">
          <span className="role-label">Viewing as:</span>
          <div className="role-toggle">
            <button 
              className={`role-btn ${currentRole === 'freelancer' ? 'active' : ''}`}
              onClick={() => handleRoleSwitch('freelancer')}
            >
              Freelancer
            </button>
            {(user?.accountType === 'both' || user?.accountType === 'client') && (
              <button 
                className={`role-btn ${currentRole === 'client' ? 'active' : ''}`}
                onClick={() => handleRoleSwitch('client')}
              >
                Client
              </button>
            )}
          </div>
        </div>
      )}

      <button 
        className="mobile-menu-toggle"
        onClick={toggleMobileMenu}
        aria-label="Toggle mobile menu"
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>

      <div className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        {isAuthenticated ? (
          <>
            <Link to="/dashboard" onClick={closeMobileMenu}>Dashboard</Link>
            {currentRole === 'freelancer' ? (
              <>
                <Link to="/browse-jobs" onClick={closeMobileMenu}>Browse Jobs</Link>
                <Link to="/browse-services" onClick={closeMobileMenu}>Browse Services</Link>
                <Link to="/create-service" onClick={closeMobileMenu}>Create Service</Link>
              </>
            ) : (
              <>
                <Link to="/post-job" onClick={closeMobileMenu}>Post Job</Link>
                <Link to="/browse-services" onClick={closeMobileMenu}>Browse Services</Link>
                {notifications.pendingProposals > 0 && (
                  <NotificationBadge type="proposal" count={notifications.pendingProposals}>
                    <Link to="/dashboard" onClick={closeMobileMenu}>
                      <span>New Proposals</span>
                    </Link>
                  </NotificationBadge>
                )}
              </>
            )}
            <NotificationBadge type="message" count={notifications.unreadMessages}>
              <Link to="/messages" onClick={closeMobileMenu}>Messages</Link>
            </NotificationBadge>
            {user?.isAdmin && <Link to="/admin" onClick={closeMobileMenu}>Admin</Link>}
            <Link to="/profile" onClick={closeMobileMenu}>Profile</Link>
            <button className="nav-logout-btn" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/browse-jobs" onClick={closeMobileMenu}>Browse Jobs</Link>
            <Link to="/browse-services" onClick={closeMobileMenu}>Browse Services</Link>
            <Link to="/login" onClick={closeMobileMenu}>Login</Link>
            <Link to="/register" onClick={closeMobileMenu}>Register</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
