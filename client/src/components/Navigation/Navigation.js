import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Navigation.css';

const Navigation = () => {
  const { user, logout, switchUserType } = useAuth();
  const location = useLocation();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getMainNavigationItems = () => {
    const mainItems = [
      { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
      { path: '/search', label: 'Search', icon: '🔍' },
      { path: '/browse-jobs', label: 'Browse Jobs', icon: '💼' },
      { path: '/local-jobs', label: 'Local Jobs', icon: '📍' }
    ];

    if (user?.userType === 'client') {
      mainItems.splice(2, 0, { path: '/post-job', label: 'Post Job', icon: '📝' });
    }

    return mainItems;
  };

  const getUserDropdownItems = () => [
    { path: '/profile', label: 'Profile', icon: '👤' },
    { path: '/messages', label: 'Messages', icon: '💬' },
    { path: '/payments', label: 'Payments', icon: '💳' },
    { path: '/reviews', label: 'Reviews', icon: '⭐' },
    { path: '/projects', label: 'Projects', icon: '📊' },
    { path: '/security', label: 'Security', icon: '🔒' },
    { path: '/admin', label: 'Admin', icon: '⚙️' }
  ];

  const handleRoleSwitch = async () => {
    setSwitchingRole(true);
    const newRole = user.userType === 'client' ? 'freelancer' : 'client';
    const result = await switchUserType(newRole);
    
    if (!result.success) {
      alert(result.error || 'Failed to switch role');
    }
    setSwitchingRole(false);
    setShowUserDropdown(false);
  };

  if (!user) {
    return (
      <nav className="navigation">
        <div className="nav-container">
          <div className="nav-brand">
            <Link to="/" className="brand-link">
              <span className="brand-icon"><span role="img" aria-label="lightning bolt">⚡</span></span>
              <span className="brand-text">FetchWork</span>
            </Link>
          </div>

          <div className="nav-menu">
            <Link to="/browse-jobs" className="nav-item">
              <span className="nav-icon"><span role="img" aria-label="briefcase">💼</span></span>
              <span className="nav-label">Browse Jobs</span>
            </Link>
            <Link to="/local-jobs" className="nav-item">
              <span className="nav-icon"><span role="img" aria-label="round pushpin">📍</span></span>
              <span className="nav-label">Local Jobs</span>
            </Link>
            <Link to="/search" className="nav-item">
              <span className="nav-icon"><span role="img" aria-label="magnifying glass">🔍</span></span>
              <span className="nav-label">Search</span>
            </Link>
          </div>

          <div className="nav-auth">
            <Link to="/login" className="auth-link">Login</Link>
            <Link to="/register" className="auth-link primary">Sign Up</Link>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to="/dashboard" className="brand-link">
            <span className="brand-icon"><span role="img" aria-label="lightning bolt">⚡</span></span>
            <span className="brand-text">FetchWork</span>
          </Link>
        </div>

        <div className="nav-menu">
          {getMainNavigationItems().map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="nav-user" ref={dropdownRef}>
          <div 
            className="user-info"
            onClick={() => setShowUserDropdown(!showUserDropdown)}
          >
            <div className="user-avatar">
              {user?.profile?.firstName?.[0] || user?.email?.[0] || 'U'}
            </div>
            <div className="user-details">
              <span className="user-name">
                {user?.profile?.firstName} {user?.profile?.lastName}
              </span>
              <span className="user-type">
                {user?.userType === 'freelancer' ? 'Freelancer' : 'Client'}
              </span>
            </div>
            <span className="dropdown-arrow">▼</span>
          </div>

          {showUserDropdown && (
            <div className="user-dropdown">
              {getUserDropdownItems().map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="dropdown-item"
                  onClick={() => setShowUserDropdown(false)}
                >
                  <span className="dropdown-icon">{item.icon}</span>
                  <span className="dropdown-label">{item.label}</span>
                </Link>
              ))}
              
              <div className="dropdown-divider"></div>
              
              <button 
                className="dropdown-item role-switch"
                onClick={handleRoleSwitch}
                disabled={switchingRole}
              >
                <span className="dropdown-icon"><span role="img" aria-label="counterclockwise arrows button">🔄</span></span>
                <span className="dropdown-label">
                  {switchingRole ? 'Switching...' : `Switch to ${user.userType === 'client' ? 'Freelancer' : 'Client'}`}
                </span>
              </button>
              
              <div className="dropdown-divider"></div>
              
              <button 
                className="dropdown-item logout"
                onClick={() => {
                  logout();
                  setShowUserDropdown(false);
                }}
              >
                <span className="dropdown-icon"><span role="img" aria-label="door">🚪</span></span>
                <span className="dropdown-label">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
