import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import jobService from '../services/jobService';

function Dashboard() {
  const { user } = useAuth();
  const [userType, setUserType] = useState(user?.userType || 'client');
  const [activeTab, setActiveTab] = useState('overview');
  const [userJobs, setUserJobs] = useState([]);

  const mockClientData = {
    activeJobs: 3,
    completedJobs: 12,
    totalSpent: 2450,
    savedFreelancers: 8,
    recentJobs: [
      { id: 1, title: 'Logo Design', freelancer: 'Sarah Johnson', status: 'In Progress', budget: 150 },
      { id: 2, title: 'Website Development', freelancer: 'Mike Chen', status: 'Review', budget: 800 },
      { id: 3, title: 'Content Writing', freelancer: 'Emma Wilson', status: 'Completed', budget: 200 }
    ]
  };

  const mockFreelancerData = {
    activeProjects: 2,
    completedProjects: 28,
    totalEarned: 8750,
    clientRating: 4.9,
    recentProjects: [
      { id: 1, title: 'E-commerce Website', client: 'TechStart Inc.', status: 'In Progress', earnings: 1200 },
      { id: 2, title: 'Mobile App Design', client: 'Creative Agency', status: 'Delivered', earnings: 600 }
    ]
  };

  const ClientDashboard = () => (
    <div className="dashboard-content">
      <div className="dashboard-stats grid grid-2">
        <div className="stat-card card">
          <h3>Active Jobs</h3>
          <div className="stat-number">{mockClientData.activeJobs}</div>
        </div>
        <div className="stat-card card">
          <h3>Completed Jobs</h3>
          <div className="stat-number">{mockClientData.completedJobs}</div>
        </div>
        <div className="stat-card card">
          <h3>Total Spent</h3>
          <div className="stat-number">${mockClientData.totalSpent}</div>
        </div>
        <div className="stat-card card">
          <h3>Saved Freelancers</h3>
          <div className="stat-number">{mockClientData.savedFreelancers}</div>
        </div>
      </div>

      <div className="dashboard-actions">
        <Link to="/post-job" className="btn">Post New Job</Link>
        <Link to="/browse" className="btn btn-secondary">Browse Freelancers</Link>
      </div>

      <div className="recent-activity card">
        <h3>Recent Jobs</h3>
        <div className="job-list">
          {mockClientData.recentJobs.map(job => (
            <div key={job.id} className="job-item">
              <div className="job-info">
                <h4>{job.title}</h4>
                <p>Freelancer: {job.freelancer}</p>
              </div>
              <div className="job-status">
                <span className={`status ${job.status.toLowerCase().replace(' ', '-')}`}>
                  {job.status}
                </span>
                <span className="budget">${job.budget}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const FreelancerDashboard = () => (
    <div className="dashboard-content">
      <div className="dashboard-stats grid grid-2">
        <div className="stat-card card">
          <h3>Active Projects</h3>
          <div className="stat-number">{mockFreelancerData.activeProjects}</div>
        </div>
        <div className="stat-card card">
          <h3>Completed Projects</h3>
          <div className="stat-number">{mockFreelancerData.completedProjects}</div>
        </div>
        <div className="stat-card card">
          <h3>Total Earned</h3>
          <div className="stat-number">${mockFreelancerData.totalEarned}</div>
        </div>
        <div className="stat-card card">
          <h3>Client Rating</h3>
          <div className="stat-number">⭐ {mockFreelancerData.clientRating}</div>
        </div>
      </div>

      <div className="dashboard-actions">
        <Link to="/browse" className="btn">Find New Projects</Link>
        <Link to="/profile" className="btn btn-secondary">Update Profile</Link>
      </div>

      <div className="recent-activity card">
        <h3>Recent Projects</h3>
        <div className="project-list">
          {mockFreelancerData.recentProjects.map(project => (
            <div key={project.id} className="project-item">
              <div className="project-info">
                <h4>{project.title}</h4>
                <p>Client: {project.client}</p>
              </div>
              <div className="project-status">
                <span className={`status ${project.status.toLowerCase().replace(' ', '-')}`}>
                  {project.status}
                </span>
                <span className="earnings">${project.earnings}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-page">
      <div className="page-container">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <div className="user-type-toggle">
            <button 
              className={userType === 'client' ? 'active' : ''}
              onClick={() => setUserType('client')}
            >
              Client View
            </button>
            <button 
              className={userType === 'freelancer' ? 'active' : ''}
              onClick={() => setUserType('freelancer')}
            >
              Freelancer View
            </button>
          </div>
        </div>

        <div className="dashboard-tabs">
          <button 
            className={activeTab === 'overview' ? 'tab-active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={activeTab === 'projects' ? 'tab-active' : ''}
            onClick={() => setActiveTab('projects')}
          >
            {userType === 'client' ? 'My Jobs' : 'My Projects'}
          </button>
          <button 
            className={activeTab === 'payments' ? 'tab-active' : ''}
            onClick={() => setActiveTab('payments')}
          >
            Payments
          </button>
        </div>

        {activeTab === 'overview' && (
          userType === 'client' ? <ClientDashboard /> : <FreelancerDashboard />
        )}

        {activeTab === 'projects' && (
          <div className="projects-tab card">
            <h3>{userType === 'client' ? 'All Jobs' : 'All Projects'}</h3>
            <p>Detailed {userType === 'client' ? 'job' : 'project'} management interface would go here.</p>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="payments-tab card">
            <h3>Payment History</h3>
            <p>Payment management and transaction history would go here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
