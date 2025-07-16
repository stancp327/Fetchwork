import React from 'react';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();

  const getGreeting = () => {
    if (user?.userType === 'freelancer') {
      return `Welcome back, ${user.profile?.firstName || 'Freelancer'}!`;
    } else {
      return `Welcome back, ${user.profile?.firstName || 'Client'}!`;
    }
  };

  const getQuickActions = () => {
    if (user?.userType === 'freelancer') {
      return [
        { title: 'Browse Jobs', description: 'Find new opportunities', link: '/browse-jobs' },
        { title: 'My Applications', description: 'Track your proposals', link: '/applications' },
        { title: 'Create Service', description: 'Offer your skills', link: '/create-service' },
        { title: 'Messages', description: 'Chat with clients', link: '/messages' }
      ];
    } else {
      return [
        { title: 'Post a Job', description: 'Find the right freelancer', link: '/post-job' },
        { title: 'Browse Services', description: 'Discover talent', link: '/browse-services' },
        { title: 'My Jobs', description: 'Manage your projects', link: '/my-jobs' },
        { title: 'Messages', description: 'Chat with freelancers', link: '/messages' }
      ];
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{getGreeting()}</h1>
          <p className="user-type-badge">
            {user?.userType === 'freelancer' ? 'Freelancer Account' : 'Client Account'}
          </p>
        </div>
        <button onClick={logout} className="logout-btn">
          Logout
        </button>
      </div>

      <div className="dashboard-content">
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Active Projects</h3>
            <div className="stat-number">3</div>
          </div>
          <div className="stat-card">
            <h3>Messages</h3>
            <div className="stat-number">12</div>
          </div>
          <div className="stat-card">
            <h3>This Month</h3>
            <div className="stat-number">$2,450</div>
          </div>
          <div className="stat-card">
            <h3>Rating</h3>
            <div className="stat-number">4.8★</div>
          </div>
        </div>

        <div className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="actions-grid">
            {getQuickActions().map((action, index) => (
              <div key={index} className="action-card">
                <h3>{action.title}</h3>
                <p>{action.description}</p>
                <a href={action.link} className="action-link">
                  Get Started →
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="recent-activity">
          <h2>Recent Activity</h2>
          <div className="activity-list">
            <div className="activity-item">
              <div className="activity-icon">💼</div>
              <div className="activity-content">
                <p><strong>New job posted:</strong> React Developer Needed</p>
                <span className="activity-time">2 hours ago</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon">💬</div>
              <div className="activity-content">
                <p><strong>Message received</strong> from Sarah Johnson</p>
                <span className="activity-time">4 hours ago</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon">✅</div>
              <div className="activity-content">
                <p><strong>Project completed:</strong> Website Design</p>
                <span className="activity-time">1 day ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
