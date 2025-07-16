import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navigation = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="navigation">
      <div className="nav-brand">
        <Link to="/dashboard">FetchWork</Link>
      </div>
      <div className="nav-links">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/browse-jobs">Browse Jobs</Link>
        <Link to="/post-job">Post Job</Link>
        <Link to="/profile">Profile</Link>
        <Link to="/messages">Messages</Link>
        {user && user.userType === 'admin' && (
          <Link to="/admin" className="admin-link">Admin</Link>
        )}
      </div>
      <div className="nav-user">
        <span>Welcome, {user.name}</span>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>
    </nav>
  );
};

export default Navigation;
