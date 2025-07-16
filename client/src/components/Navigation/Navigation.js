import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Navigation.css';

const Navigation = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const getNavigationItems = () => {
    const commonItems = [
      { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
      { path: '/search', label: 'Search', icon: '🔍' },
      { path: '/profile', label: 'Profile', icon: '👤' },
      { path: '/messages', label: 'Messages', icon: '💬' },
      { path: '/payments', label: 'Payments', icon: '💳' },
      { path: '/reviews', label: 'Reviews', icon: '⭐' },
      { path: '/admin', label: 'Admin', icon: '⚙️' }
    ];

    if (user?.userType === 'freelancer') {
      return [
        ...commonItems.slice(0, 2),
        { path: '/browse-jobs', label: 'Browse Jobs', icon: '💼' },
        ...commonItems.slice(2)
      ];
    } else {
      return [
        ...commonItems.slice(0, 2),
        { path: '/post-job', label: 'Post Job', icon: '📝' },
        { path: '/browse-jobs', label: 'Browse Freelancers', icon: '👥' },
        ...commonItems.slice(2)
      ];
    }
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to="/dashboard" className="brand-link">
            <span className="brand-icon">⚡</span>
            <span className="brand-text">FetchWork</span>
          </Link>
        </div>

        <div className="nav-menu">
          {getNavigationItems().map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="nav-user">
          <div className="user-info">
            <div className="user-avatar">
              {user?.profile?.firstName?.[0]}{user?.profile?.lastName?.[0]}
            </div>
            <div className="user-details">
              <span className="user-name">
                {user?.profile?.firstName} {user?.profile?.lastName}
              </span>
              <span className="user-type">
                {user?.userType === 'freelancer' ? 'Freelancer' : 'Client'}
              </span>
            </div>
          </div>
          <button onClick={logout} className="logout-button">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
