import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const NavLink = ({ to, children, badge }) => (
    <Link
      to={to}
      className={`nav-link ${isActive(to) ? 'active' : ''}`}
      onClick={closeMobileMenu}
    >
      {children}
      {badge > 0 && <span className="nav-badge-inline">{badge}</span>}
    </Link>
  );

  return (
    <>
      <nav className={`navigation ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-inner">
          {/* Brand */}
          <Link to="/" className="nav-brand" onClick={closeMobileMenu}>
            <img src="/fetchwork-logo.png" alt="FetchWork" className="nav-logo" />
            <span className="brand-text">FetchWork</span>
          </Link>

          {/* Desktop Nav Links */}
          <div className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
            {/* Mobile-only: role switcher + close */}
            <div className="mobile-nav-header">
              {isAuthenticated && (user?.accountType === 'freelancer' || user?.accountType === 'both') && (
                <div className="mobile-role-switcher">
                  <button
                    className={`role-pill ${currentRole === 'freelancer' ? 'active' : ''}`}
                    onClick={() => switchRole('freelancer')}
                  >
                    Freelancer
                  </button>
                  <button
                    className={`role-pill ${currentRole === 'client' ? 'active' : ''}`}
                    onClick={() => switchRole('client')}
                  >
                    Client
                  </button>
                </div>
              )}
              <button className="mobile-close-btn" onClick={closeMobileMenu}>×</button>
            </div>

            {isAuthenticated ? (
              <>
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/freelancers">Freelancers</NavLink>
                <NavLink to="/browse-jobs">Jobs</NavLink>
                <NavLink to="/browse-services">Services</NavLink>

                <div className="nav-divider" />

                {currentRole === 'freelancer' ? (
                  <NavLink to="/create-service">Create</NavLink>
                ) : (
                  <NavLink to="/post-job">Create</NavLink>
                )}

                <NavLink to="/messages" badge={notifications.unreadMessages}>
                  Messages
                </NavLink>
                <NavLink to="/disputes">Disputes</NavLink>

                {user?.isAdmin && <NavLink to="/admin">Admin</NavLink>}

                <div className="nav-divider" />

                <NavLink to="/profile">Profile</NavLink>
                <button className="nav-logout-btn" onClick={() => { logout(); closeMobileMenu(); }}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink to="/freelancers">Freelancers</NavLink>
                <NavLink to="/browse-jobs">Jobs</NavLink>
                <NavLink to="/browse-services">Services</NavLink>

                <div className="nav-spacer" />

                <Link to="/login" className="nav-link nav-login" onClick={closeMobileMenu}>Login</Link>
                <Link to="/register" className="nav-cta-btn" onClick={closeMobileMenu}>Get Started</Link>
              </>
            )}
          </div>

          {/* Desktop role switcher */}
          {isAuthenticated && (user?.accountType === 'freelancer' || user?.accountType === 'both') && (
            <div className="desktop-role-switcher">
              <div className="role-toggle">
                <button
                  className={`role-btn ${currentRole === 'freelancer' ? 'active' : ''}`}
                  onClick={() => switchRole('freelancer')}
                >
                  Freelancer
                </button>
                <button
                  className={`role-btn ${currentRole === 'client' ? 'active' : ''}`}
                  onClick={() => switchRole('client')}
                >
                  Client
                </button>
              </div>
            </div>
          )}

          {/* Hamburger */}
          <button
            className={`mobile-menu-toggle ${isMobileMenuOpen ? 'open' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Overlay */}
      {isMobileMenuOpen && <div className="nav-overlay" onClick={closeMobileMenu} />}
    </>
  );
};

export default Navigation;
