import React from 'react';
import Navigation from './Navigation';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <div>
      <Navigation />
      <div className="page-container">
        <div className="dashboard">
          <h1>Dashboard</h1>
          <div className="welcome-section">
            <h2>Welcome back, {user?.name}!</h2>
            <p>Here's your FetchWork overview</p>
          </div>
          
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <h3>Active Projects</h3>
              <div className="stat-number">3</div>
              <p>Projects in progress</p>
            </div>
            
            <div className="dashboard-card">
              <h3>Total Earnings</h3>
              <div className="stat-number">$2,450</div>
              <p>This month</p>
            </div>
            
            <div className="dashboard-card">
              <h3>New Messages</h3>
              <div className="stat-number">7</div>
              <p>Unread messages</p>
            </div>
            
            <div className="dashboard-card">
              <h3>Profile Views</h3>
              <div className="stat-number">24</div>
              <p>This week</p>
            </div>
          </div>
          
          <div className="recent-activity">
            <h3>Recent Activity</h3>
            <div className="activity-list">
              <div className="activity-item">
                <span className="activity-time">2 hours ago</span>
                <span className="activity-text">New job application received</span>
              </div>
              <div className="activity-item">
                <span className="activity-time">5 hours ago</span>
                <span className="activity-text">Project milestone completed</span>
              </div>
              <div className="activity-item">
                <span className="activity-time">1 day ago</span>
                <span className="activity-text">Payment received for Web Design project</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
