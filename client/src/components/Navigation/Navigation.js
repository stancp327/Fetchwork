import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { useNotifications } from '../../hooks/useNotifications';
import './Navigation.css';

// ─── helpers ──────────────────────────────────────────────────────────────────
const Avatar = ({ user, size = 34 }) => {
  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean).map(s => s[0]).join('').toUpperCase() || '?';
  return user?.profilePicture ? (
    <img
      src={user.profilePicture}
      alt="avatar"
      className="nav-avatar-img"
      style={{ width: size, height: size }}
    />
  ) : (
    <span className="nav-avatar-initials" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
};

// Badge pill for nav links
const Badge = ({ count }) =>
  count > 0 ? (
    <span className="nav-badge">{count > 9 ? '9+' : count}</span>
  ) : null;

// A simple NavLink wrapper
const PrimaryLink = ({ to, children, onClick, badge }) => {
  const location = useLocation();
  const active = location.pathname === to || location.pathname.startsWith(to + '/');
  return (
    <Link to={to} className={`nav-primary-link ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
      <Badge count={badge} />
    </Link>
  );
};

// ─── Notification dropdown ────────────────────────────────────────────────────
const NotifBell = ({ notifications, markAsRead, markAllRead }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = notifications.unreadNotifications || 0;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="nav-icon-btn-wrap" ref={ref}>
      <button
        className="nav-icon-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="nav-dot-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="nav-dropdown notif-dropdown-panel">
          <div className="nav-dropdown-header">
            <span className="nav-dropdown-title">Notifications</span>
            {unread > 0 && (
              <button className="nav-dropdown-action" onClick={() => { markAllRead(); }}>
                Mark all read
              </button>
            )}
          </div>
          {(notifications.items || []).length === 0 ? (
            <div className="nav-dropdown-empty">No new notifications</div>
          ) : (
            <div className="notif-list">
              {(notifications.items || []).slice(0, 8).map(n => (
                <button
                  key={n._id}
                  className={`notif-item ${n.read ? 'read' : 'unread'}`}
                  onClick={async () => {
                    if (!n.read) await markAsRead(n._id);
                    setOpen(false);
                    if (n.link) window.location.assign(n.link);
                  }}
                >
                  <div className="notif-item-title">{n.title}</div>
                  <div className="notif-item-msg">{n.message}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Profile/User dropdown ────────────────────────────────────────────────────
const ProfileMenu = ({ user, logout, isAdmin, isMod }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [close]);

  const go = (path) => { close(); navigate(path); };

  const MenuItem = ({ to, icon, label }) => (
    <button className="nav-menu-item" onClick={() => go(to)}>
      {icon && <span className="nav-menu-icon">{icon}</span>}
      <span>{label}</span>
    </button>
  );

  const Divider = () => <div className="nav-menu-divider" />;

  return (
    <div className="nav-icon-btn-wrap" ref={ref}>
      <button
        className={`nav-avatar-btn ${open ? 'active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        aria-expanded={open}
      >
        <Avatar user={user} />
        <svg className="nav-avatar-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="nav-dropdown profile-dropdown-panel">
          {/* User identity */}
          <div className="nav-menu-identity">
            <Avatar user={user} size={36} />
            <div>
              <div className="nav-menu-name">{user?.firstName} {user?.lastName}</div>
              <div className="nav-menu-email">{user?.email}</div>
            </div>
          </div>

          <Divider />

          {/* Primary */}
          <MenuItem to="/dashboard" icon="🏠" label="Dashboard" />
          <MenuItem to="/profile"   icon="👤" label="My Profile" />
          <MenuItem to="/skills"    icon="🏅" label="Skill Assessments" />
          <MenuItem to="/earnings"  icon="💰" label="Earnings" />
          <MenuItem to="/wallet"    icon="💼" label="Wallet" />
          <MenuItem to="/billing"   icon="💳" label="Billing & Plans" />

          <Divider />

          {/* Work */}
          <div className="nav-menu-section-label">Work</div>
          <MenuItem to="/projects"  icon="📋" label="Projects" />
          <MenuItem to="/bookings"  icon="📅" label="Bookings" />
          <MenuItem to="/contracts" icon="📄" label="Contracts" />
          <MenuItem to="/reviews"   icon="⭐" label="Reviews" />
          <MenuItem to="/saved"     icon="🔖" label="Saved" />
          <MenuItem to="/offers"    icon="💬" label="Offers" />
          <MenuItem to="/teams"     icon="👥" label="Teams" />
          <MenuItem to="/agencies"  icon="🏢" label="Agencies" />

          <Divider />

          {/* Tools */}
          <div className="nav-menu-section-label">Tools</div>
          <MenuItem to="/analytics"          icon="📊" label="Analytics" />
          <MenuItem to="/spend"              icon="📈" label="Spend Dashboard" />
          <MenuItem to="/job-alerts"         icon="🔔" label="Job Alerts" />
          <MenuItem to="/discovery-settings" icon="🔍" label="Discovery" />
          <MenuItem to="/referrals"          icon="🎁" label="Referrals" />
          <MenuItem to="/security"           icon="🔒" label="Security" />

          {(isAdmin || isMod) && (
            <>
              <Divider />
              <MenuItem to="/admin" icon={isMod ? '🛡️' : '⚙️'} label={isMod ? 'Mod Panel' : 'Admin Panel'} />
            </>
          )}

          <Divider />

          <button
            className="nav-menu-item nav-menu-item--danger"
            onClick={() => { close(); logout(); }}
          >
            <span className="nav-menu-icon">🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main Navigation ──────────────────────────────────────────────────────────
const Navigation = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { currentRole, switchRole } = useRole();
  const { notifications, markAsRead, markAllRead } = useNotifications();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  const isAdmin = user?.isAdmin || user?.role === 'admin';
  const isMod   = user?.role === 'moderator';
  const unreadMessages = notifications.unreadMessages || 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close drawer on route change
  useEffect(() => { setIsMobileOpen(false); }, [location.pathname]);

  // Body scroll lock when drawer is open
  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  const closeMenu = () => setIsMobileOpen(false);

  const createPath = currentRole === 'freelancer' ? '/create-service' : '/post-job';
  const createLabel = currentRole === 'freelancer' ? '+ Service' : '+ Job';

  return (
    <>
      <nav className={`navigation ${scrolled ? 'scrolled' : ''}`} role="navigation">
        <div className="nav-inner">

          {/* ── Brand ── */}
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="nav-brand" onClick={closeMenu}>
            <img src="/fetchwork-logo.png" alt="FetchWork" className="nav-logo" />
            <span className="brand-text">FetchWork</span>
          </Link>

          {/* ── Primary links (desktop only) ── */}
          <div className="nav-primary-links">
            <PrimaryLink to="/freelancers">Freelancers</PrimaryLink>
            <PrimaryLink to="/browse-jobs">Jobs</PrimaryLink>
            <PrimaryLink to="/browse-services">Services</PrimaryLink>
          </div>

          <div className="nav-spacer" />

          {/* ── Right side actions (desktop) ── */}
          {isAuthenticated ? (
            <div className="nav-actions">
              {/* Role toggle */}
              <div className="role-toggle" aria-label="Switch role">
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

              {/* Create button */}
              <Link to={createPath} className="nav-create-btn">
                {createLabel}
              </Link>

              {/* Messages */}
              <Link to="/messages" className="nav-icon-btn" aria-label="Messages">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {unreadMessages > 0 && <span className="nav-dot-badge">{unreadMessages > 9 ? '9+' : unreadMessages}</span>}
              </Link>

              {/* Notifications */}
              <NotifBell
                notifications={notifications}
                markAsRead={markAsRead}
                markAllRead={markAllRead}
              />

              {/* Profile menu */}
              <ProfileMenu user={user} logout={logout} isAdmin={isAdmin} isMod={isMod} />
            </div>
          ) : (
            <div className="nav-actions">
              <PrimaryLink to="/freelancers">Freelancers</PrimaryLink>
              <PrimaryLink to="/pricing">Pricing</PrimaryLink>
              <Link to="/login" className="nav-login-btn">Log In</Link>
              <Link to="/register" className="nav-cta-btn">Sign Up Free</Link>
            </div>
          )}

          {/* ── Hamburger (mobile only) ── */}
          <button
            className={`mobile-menu-toggle ${isMobileOpen ? 'open' : ''}`}
            onClick={() => setIsMobileOpen(o => !o)}
            aria-label="Toggle menu"
            aria-expanded={isMobileOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* ── Mobile drawer ── */}
      {isMobileOpen && <div className="nav-overlay" onClick={closeMenu} />}
      <div className={`mobile-drawer ${isMobileOpen ? 'open' : ''}`} role="dialog" aria-modal="true">
        <div className="mobile-drawer-header">
          {isAuthenticated ? (
            <div className="mobile-user-row">
              <Avatar user={user} size={40} />
              <div>
                <div className="mobile-user-name">{user?.firstName} {user?.lastName}</div>
                <div className="mobile-user-role">{currentRole === 'freelancer' ? '🛠 Freelancer' : '💼 Client'}</div>
              </div>
            </div>
          ) : (
            <span className="brand-text" style={{ fontSize: '1.1rem' }}>FetchWork</span>
          )}
          <button className="mobile-close-btn" onClick={closeMenu} aria-label="Close menu">×</button>
        </div>

        <div className="mobile-drawer-body">
          {isAuthenticated && (
            <div className="mobile-role-row">
              <button className={`role-pill ${currentRole === 'freelancer' ? 'active' : ''}`} onClick={() => { switchRole('freelancer'); closeMenu(); }}>
                Freelancer
              </button>
              <button className={`role-pill ${currentRole === 'client' ? 'active' : ''}`} onClick={() => { switchRole('client'); closeMenu(); }}>
                Client
              </button>
            </div>
          )}

          <div className="mobile-section">
            <div className="mobile-section-label">Explore</div>
            <PrimaryLink to="/freelancers" onClick={closeMenu}>👩‍💻 Freelancers</PrimaryLink>
            <PrimaryLink to="/browse-jobs" onClick={closeMenu}>💼 Jobs</PrimaryLink>
            <PrimaryLink to="/browse-services" onClick={closeMenu}>🛍 Services</PrimaryLink>
          </div>

          {isAuthenticated && (
            <>
              <div className="mobile-section">
                <div className="mobile-section-label">My Account</div>
                <PrimaryLink to="/dashboard"  onClick={closeMenu}>🏠 Dashboard</PrimaryLink>
                <PrimaryLink to={createPath}  onClick={closeMenu}>✨ {createLabel}</PrimaryLink>
                <PrimaryLink to="/messages"   onClick={closeMenu} badge={unreadMessages}>💬 Messages</PrimaryLink>
                <PrimaryLink to="/profile"    onClick={closeMenu}>👤 Profile</PrimaryLink>
                <PrimaryLink to="/skills"     onClick={closeMenu}>🏅 Skill Assessments</PrimaryLink>
                <PrimaryLink to="/earnings"   onClick={closeMenu}>💰 Earnings</PrimaryLink>
                <PrimaryLink to="/wallet"     onClick={closeMenu}>💼 Wallet</PrimaryLink>
                <PrimaryLink to="/billing"    onClick={closeMenu}>💳 Billing</PrimaryLink>
              </div>

              <div className="mobile-section">
                <div className="mobile-section-label">Work</div>
                <PrimaryLink to="/projects"  onClick={closeMenu}>📋 Projects</PrimaryLink>
                <PrimaryLink to="/bookings"  onClick={closeMenu}>📅 Bookings</PrimaryLink>
                <PrimaryLink to="/contracts" onClick={closeMenu}>📄 Contracts</PrimaryLink>
                <PrimaryLink to="/reviews"   onClick={closeMenu}>⭐ Reviews</PrimaryLink>
                <PrimaryLink to="/saved"     onClick={closeMenu}>🔖 Saved</PrimaryLink>
                <PrimaryLink to="/offers"    onClick={closeMenu}>💬 Offers</PrimaryLink>
                <PrimaryLink to="/teams"     onClick={closeMenu}>👥 Teams</PrimaryLink>
                <PrimaryLink to="/agencies"  onClick={closeMenu}>🏢 Agencies</PrimaryLink>
              </div>

              <div className="mobile-section">
                <div className="mobile-section-label">Tools</div>
                <PrimaryLink to="/analytics"          onClick={closeMenu}>📊 Analytics</PrimaryLink>
                <PrimaryLink to="/spend"              onClick={closeMenu}>📈 Spend</PrimaryLink>
                <PrimaryLink to="/job-alerts"         onClick={closeMenu}>🔔 Job Alerts</PrimaryLink>
                <PrimaryLink to="/discovery-settings" onClick={closeMenu}>🔍 Discovery</PrimaryLink>
                <PrimaryLink to="/referrals"          onClick={closeMenu}>🎁 Referrals</PrimaryLink>
                <PrimaryLink to="/security"           onClick={closeMenu}>🔒 Security</PrimaryLink>
                {(isAdmin || isMod) && (
                  <PrimaryLink to="/admin" onClick={closeMenu}>{isMod ? '🛡️ Mod Panel' : '⚙️ Admin Panel'}</PrimaryLink>
                )}
              </div>

              <div className="mobile-section">
                <button
                  className="mobile-logout-btn"
                  onClick={() => { logout(); closeMenu(); }}
                >
                  🚪 Sign Out
                </button>
              </div>
            </>
          )}

          {!isAuthenticated && (
            <div className="mobile-section">
              <PrimaryLink to="/pricing" onClick={closeMenu}>Pricing</PrimaryLink>
              <Link to="/login"    className="mobile-auth-btn mobile-auth-btn--secondary" onClick={closeMenu}>Log In</Link>
              <Link to="/register" className="mobile-auth-btn mobile-auth-btn--primary"   onClick={closeMenu}>Sign Up Free</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Navigation;
