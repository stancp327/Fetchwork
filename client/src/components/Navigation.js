import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navigation.css';

function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <h2>FetchWork</h2>
        </Link>

        <div className={`nav-menu ${isMenuOpen ? 'nav-menu-active' : ''}`}>
          <Link 
            to="/" 
            className={`nav-link ${isActive('/') ? 'nav-link-active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-text">Home</span>
          </Link>

          <Link 
            to="/browse" 
            className={`nav-link ${isActive('/browse') ? 'nav-link-active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <span className="nav-icon">🔍</span>
            <span className="nav-text">Browse Services</span>
          </Link>

          {isAuthenticated && (
            <>
              <Link 
                to="/post-job" 
                className={`nav-link ${isActive('/post-job') ? 'nav-link-active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="nav-icon">📝</span>
                <span className="nav-text">Post Job</span>
              </Link>

              <Link 
                to="/dashboard" 
                className={`nav-link ${isActive('/dashboard') ? 'nav-link-active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="nav-icon">📊</span>
                <span className="nav-text">Dashboard</span>
              </Link>

              <Link 
                to="/messages" 
                className={`nav-link ${isActive('/messages') ? 'nav-link-active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="nav-icon">💬</span>
                <span className="nav-text">Messages</span>
              </Link>

              <Link 
                to="/profile" 
                className={`nav-link ${isActive('/profile') ? 'nav-link-active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="nav-icon">👤</span>
                <span className="nav-text">Profile</span>
              </Link>

              {user?.userType === 'admin' && (
                <Link 
                  to="/admin" 
                  className={`nav-link ${isActive('/admin') ? 'nav-link-active' : ''}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="nav-icon">⚙️</span>
                  <span className="nav-text">Admin</span>
                </Link>
              )}
            </>
          )}
        </div>

        <div className="nav-auth">
          {!isAuthenticated ? (
            <>
              <Link to="/login" className="nav-auth-link">Login</Link>
              <Link to="/signup" className="nav-auth-btn">Sign Up</Link>
            </>
          ) : (
            <div className="nav-user-menu">
              <span className="nav-user-name">Welcome, {user?.firstName}!</span>
              <button 
                className="nav-logout-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>

        <div className="nav-hamburger" onClick={toggleMenu}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
