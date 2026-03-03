import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationBadge from './NotificationBadge';
import './Navigation.css';

const Navigation = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { currentRole, switchRole } = useRole();
  const { notifications, markAsRead, markAllRead } = useNotifications();
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const totalUnread = (notifications.unreadMessages || 0) + (notifications.unreadNotifications || 0);
  const notifRef = useRef(null);

  // Close notification dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

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
              {isAuthenticated && (
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
                <NavLink to="/projects">Projects</NavLink>
                <NavLink to="/payments">Payments</NavLink>
                <NavLink to="/bookings">Bookings</NavLink>
                <NavLink to="/reviews">Reviews</NavLink>
                <NavLink to="/saved">Saved</NavLink>
                <NavLink to="/offers">Offers</NavLink>
                <NavLink to="/teams">Teams</NavLink>
                <NavLink to="/agencies">Agencies</NavLink>

                <div className="notif-bell-wrapper" ref={notifRef} style={{ position: 'relative' }}>
                  <button 
                    className="notif-bell-btn"
                    onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                    aria-label="Notifications"
                  >
                    🔔
                    {notifications.unreadNotifications > 0 && (
                      <span className="notif-badge">{notifications.unreadNotifications > 9 ? '9+' : notifications.unreadNotifications}</span>
                    )}
                  </button>
                  {showNotifDropdown && (
                    <div className="notif-dropdown">
                      <div className="notif-dropdown-header">
                        <span>Notifications</span>
                        {notifications.unreadNotifications > 0 && (
                          <button className="notif-mark-all" onClick={() => { markAllRead(); }}>Mark all read</button>
                        )}
                      </div>
                      {(notifications.items || []).length === 0 ? (
                        <div className="notif-empty">No new notifications</div>
                      ) : (
                        <div className="notif-list">
                          {notifications.items.slice(0, 8).map(n => (
                            <div 
                              key={n._id} 
                              className={`notif-item ${n.read ? 'read' : 'unread'}`}
                              onClick={async () => {
                                if (!n.read) {
                                  await markAsRead(n._id);
                                }
                                setShowNotifDropdown(false);
                                if (n.link) {
                                  window.location.assign(n.link);
                                }
                              }}
                            >
                              <div className="notif-item-title">{n.title}</div>
                              <div className="notif-item-msg">{n.message}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {(user?.isAdmin || user?.role === 'admin' || user?.role === 'moderator') && (
                  <NavLink to="/admin">
                    {user?.role === 'moderator' ? '🛡️ Mod' : '⚙️ Admin'}
                  </NavLink>
                )}

                <div className="nav-divider" />

                <NavLink to="/billing">Billing</NavLink>
                <NavLink to="/wallet">Wallet</NavLink>
                <NavLink to="/analytics">Analytics</NavLink>
                <NavLink to="/spend">Spend</NavLink>
                <NavLink to="/contracts">Contracts</NavLink>
                <NavLink to="/security">Security</NavLink>
                <NavLink to="/job-alerts">Job Alerts 🔔</NavLink>
                <NavLink to="/discovery-settings">Discovery 🔍</NavLink>
                <NavLink to="/referrals">Referrals 🎁</NavLink>
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
                <NavLink to="/pricing">Pricing</NavLink>

                <div className="nav-spacer" />

                <Link to="/login" className="nav-login-btn" onClick={closeMobileMenu}>Log In</Link>
                <Link to="/register" className="nav-cta-btn" onClick={closeMobileMenu}>Sign Up Free</Link>
              </>
            )}
          </div>

          {/* Desktop role switcher */}
          {isAuthenticated && (
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
