import React, { useState } from 'react';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const mockStats = {
    totalUsers: 1247,
    activeJobs: 89,
    totalRevenue: 45670,
    pendingDisputes: 3,
    newSignups: 23,
    completedJobs: 456
  };

  const mockUsers = [
    { id: 1, name: 'John Doe', type: 'Client', status: 'Active', joinDate: '2024-01-15' },
    { id: 2, name: 'Sarah Johnson', type: 'Freelancer', status: 'Active', joinDate: '2024-02-20' },
    { id: 3, name: 'Mike Chen', type: 'Freelancer', status: 'Suspended', joinDate: '2024-01-10' }
  ];

  const mockJobs = [
    { id: 1, title: 'Logo Design', client: 'TechStart Inc.', freelancer: 'Sarah Johnson', status: 'In Progress', budget: 500 },
    { id: 2, title: 'Website Development', client: 'Creative Agency', freelancer: 'Mike Chen', status: 'Completed', budget: 2000 },
    { id: 3, title: 'Content Writing', client: 'Marketing Co.', freelancer: 'Emma Wilson', status: 'Disputed', budget: 300 }
  ];

  const mockDisputes = [
    { id: 1, job: 'Content Writing', client: 'Marketing Co.', freelancer: 'Emma Wilson', issue: 'Quality concerns', status: 'Open' },
    { id: 2, job: 'App Development', client: 'StartupXYZ', freelancer: 'Alex Thompson', issue: 'Payment delay', status: 'Resolved' }
  ];

  const OverviewTab = () => (
    <div className="admin-overview">
      <div className="admin-stats grid grid-3">
        <div className="stat-card card">
          <h3>Total Users</h3>
          <div className="stat-number">{mockStats.totalUsers}</div>
          <div className="stat-change positive">+{mockStats.newSignups} this week</div>
        </div>
        <div className="stat-card card">
          <h3>Active Jobs</h3>
          <div className="stat-number">{mockStats.activeJobs}</div>
        </div>
        <div className="stat-card card">
          <h3>Total Revenue</h3>
          <div className="stat-number">${mockStats.totalRevenue}</div>
        </div>
        <div className="stat-card card">
          <h3>Completed Jobs</h3>
          <div className="stat-number">{mockStats.completedJobs}</div>
        </div>
        <div className="stat-card card">
          <h3>Pending Disputes</h3>
          <div className="stat-number">{mockStats.pendingDisputes}</div>
          <div className="stat-change negative">Needs attention</div>
        </div>
        <div className="stat-card card">
          <h3>Platform Health</h3>
          <div className="stat-number">98.5%</div>
          <div className="stat-change positive">Uptime</div>
        </div>
      </div>

      <div className="recent-activity card">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          <div className="activity-item">
            <span className="activity-icon">👤</span>
            <span>New user registration: Alex Thompson (Freelancer)</span>
            <span className="activity-time">2 hours ago</span>
          </div>
          <div className="activity-item">
            <span className="activity-icon">💼</span>
            <span>Job completed: Website Development by Mike Chen</span>
            <span className="activity-time">4 hours ago</span>
          </div>
          <div className="activity-item">
            <span className="activity-icon">⚠️</span>
            <span>New dispute opened: Content Writing project</span>
            <span className="activity-time">6 hours ago</span>
          </div>
        </div>
      </div>
    </div>
  );

  const UsersTab = () => (
    <div className="admin-users">
      <div className="tab-header">
        <h3>User Management</h3>
        <div className="tab-actions">
          <input type="text" placeholder="Search users..." className="search-input" />
          <button className="btn btn-secondary">Export Users</button>
        </div>
      </div>

      <div className="users-table card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Join Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockUsers.map(user => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.type}</td>
                <td>
                  <span className={`status ${user.status.toLowerCase()}`}>
                    {user.status}
                  </span>
                </td>
                <td>{user.joinDate}</td>
                <td>
                  <button className="btn btn-secondary">View</button>
                  <button className="btn btn-secondary">Edit</button>
                  {user.status === 'Active' ? (
                    <button className="btn btn-danger">Suspend</button>
                  ) : (
                    <button className="btn">Activate</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const JobsTab = () => (
    <div className="admin-jobs">
      <div className="tab-header">
        <h3>Job Management</h3>
        <div className="tab-actions">
          <select>
            <option value="all">All Jobs</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>
      </div>

      <div className="jobs-table card">
        <table>
          <thead>
            <tr>
              <th>Job Title</th>
              <th>Client</th>
              <th>Freelancer</th>
              <th>Status</th>
              <th>Budget</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockJobs.map(job => (
              <tr key={job.id}>
                <td>{job.title}</td>
                <td>{job.client}</td>
                <td>{job.freelancer}</td>
                <td>
                  <span className={`status ${job.status.toLowerCase().replace(' ', '-')}`}>
                    {job.status}
                  </span>
                </td>
                <td>${job.budget}</td>
                <td>
                  <button className="btn btn-secondary">View</button>
                  {job.status === 'Disputed' && (
                    <button className="btn">Resolve</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const DisputesTab = () => (
    <div className="admin-disputes">
      <div className="tab-header">
        <h3>Dispute Management</h3>
        <div className="tab-actions">
          <select>
            <option value="all">All Disputes</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div className="disputes-table card">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Client</th>
              <th>Freelancer</th>
              <th>Issue</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockDisputes.map(dispute => (
              <tr key={dispute.id}>
                <td>{dispute.job}</td>
                <td>{dispute.client}</td>
                <td>{dispute.freelancer}</td>
                <td>{dispute.issue}</td>
                <td>
                  <span className={`status ${dispute.status.toLowerCase()}`}>
                    {dispute.status}
                  </span>
                </td>
                <td>
                  <button className="btn btn-secondary">View Details</button>
                  {dispute.status === 'Open' && (
                    <button className="btn">Resolve</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const PaymentsTab = () => (
    <div className="admin-payments">
      <div className="tab-header">
        <h3>Payment Management</h3>
        <div className="tab-actions">
          <button className="btn btn-secondary">Export Transactions</button>
        </div>
      </div>

      <div className="payment-controls card">
        <h4>Payment Controls</h4>
        <div className="control-buttons">
          <button className="btn">Release Held Payments</button>
          <button className="btn btn-secondary">Hold Payments</button>
          <button className="btn btn-secondary">Process Refunds</button>
        </div>
      </div>

      <div className="payment-stats card">
        <h4>Payment Statistics</h4>
        <div className="grid grid-3">
          <div className="payment-stat">
            <h5>Total Processed</h5>
            <p>${mockStats.totalRevenue}</p>
          </div>
          <div className="payment-stat">
            <h5>Held in Escrow</h5>
            <p>$12,450</p>
          </div>
          <div className="payment-stat">
            <h5>Platform Fees</h5>
            <p>$2,283</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-dashboard-page">
      <div className="page-container">
        <div className="admin-header">
          <h1>Admin Dashboard</h1>
          <div className="admin-actions">
            <button className="btn btn-secondary">System Settings</button>
            <button className="btn btn-secondary">Generate Report</button>
          </div>
        </div>

        <div className="admin-tabs">
          <button 
            className={activeTab === 'overview' ? 'tab-active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={activeTab === 'users' ? 'tab-active' : ''}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button 
            className={activeTab === 'jobs' ? 'tab-active' : ''}
            onClick={() => setActiveTab('jobs')}
          >
            Jobs
          </button>
          <button 
            className={activeTab === 'disputes' ? 'tab-active' : ''}
            onClick={() => setActiveTab('disputes')}
          >
            Disputes
          </button>
          <button 
            className={activeTab === 'payments' ? 'tab-active' : ''}
            onClick={() => setActiveTab('payments')}
          >
            Payments
          </button>
        </div>

        <div className="admin-content">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'jobs' && <JobsTab />}
          {activeTab === 'disputes' && <DisputesTab />}
          {activeTab === 'payments' && <PaymentsTab />}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
