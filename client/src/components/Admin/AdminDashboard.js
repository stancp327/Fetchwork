import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import { formatBudget } from '../../utils/formatters';
import AdminDisputePanel from './AdminDisputePanel';
import AdminEmailPanel from './AdminEmailPanel';
import ActivitySection from './ActivitySection';
import StatCard from '../common/StatCard';
import TabButton from '../common/TabButton';
import AnalyticsTab from './AnalyticsTab';
import TracingErrorBoundary from '../common/TracingErrorBoundary';
import ErrorDashboard from './ErrorDashboard';
import AdminUserDrawer from './AdminUserDrawer';
import AdminVerifications from './AdminVerifications';
import AdminBillingTab from './AdminBillingTab';
import './AdminDashboard.css';
import './AdminMonitoring.css';

// ── Permissions Tab ─────────────────────────────────────────────
const PermissionsTab = () => {
  const [catalog,    setCatalog]    = useState([]);
  const [defaults,   setDefaults]   = useState({});
  const [moderators, setModerators] = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [draft,      setDraft]      = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest('/api/admin/permissions'),
      apiRequest('/api/admin/users?role=moderator&limit=100'),
    ]).then(([perms, users]) => {
      setCatalog(perms.permissions || []);
      setDefaults(perms.roleDefaults || {});
      setModerators((users.users || users || []).filter(u => u.role === 'moderator'));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const selectModerator = (mod) => {
    setSelected(mod);
    const base   = defaults.moderator || [];
    const custom = mod.permissions || [];
    setDraft([...new Set([...base, ...custom])]);
    setSaved(false);
  };

  const togglePerm = (key) => {
    setDraft(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    setSaved(false);
  };

  const savePerms = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiRequest(`/api/admin/users/${selected._id}/permissions`, {
        method: 'PUT', body: JSON.stringify({ permissions: draft }),
      });
      setModerators(prev => prev.map(m => m._id === selected._id ? { ...m, permissions: draft } : m));
      setSelected(prev => ({ ...prev, permissions: draft }));
      setSaved(true);
    } catch (err) {
      alert(err.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading…</div>;

  return (
    <div className="perm-tab">
      <section className="perm-section">
        <h2 className="perm-section-title">Permission Catalog</h2>
        <div className="perm-catalog">
          {catalog.map(p => (
            <div key={p.key} className="perm-catalog-row">
              <div className="perm-catalog-badges">
                <span className="perm-role-badge admin">admin</span>
                {(defaults.moderator || []).includes(p.key) && (
                  <span className="perm-role-badge moderator">mod default</span>
                )}
              </div>
              <div className="perm-catalog-text">
                <span className="perm-catalog-label">{p.label}</span>
                <span className="perm-catalog-desc">{p.description}</span>
              </div>
              <code className="perm-catalog-key">{p.key}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="perm-section">
        <h2 className="perm-section-title">Moderator Permissions</h2>
        {moderators.length === 0 ? (
          <p className="perm-empty">No moderators yet. Promote a user from the Users tab.</p>
        ) : (
          <div className="perm-mod-layout">
            <div className="perm-mod-list">
              {moderators.map(mod => (
                <button key={mod._id} className={`perm-mod-item ${selected?._id === mod._id ? 'active' : ''}`} onClick={() => selectModerator(mod)}>
                  <span className="perm-mod-name">{mod.firstName} {mod.lastName}</span>
                  <span className="perm-mod-email">{mod.email}</span>
                  <span className="perm-mod-count">{[...new Set([...(defaults.moderator||[]),...(mod.permissions||[])])].length}/{catalog.length} perms</span>
                </button>
              ))}
            </div>
            {selected ? (
              <div className="perm-mod-editor">
                <div className="perm-editor-header">
                  <div>
                    <strong>{selected.firstName} {selected.lastName}</strong>
                    <span className="perm-editor-email">{selected.email}</span>
                  </div>
                  <button className="perm-save-btn" onClick={savePerms} disabled={saving}>
                    {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
                  </button>
                </div>
                <div className="perm-toggles">
                  {catalog.map(p => {
                    const isDefault = (defaults.moderator || []).includes(p.key);
                    const isEnabled = draft.includes(p.key);
                    return (
                      <label key={p.key} className={`perm-toggle-row ${isEnabled ? 'on' : ''}`}>
                        <div className="perm-toggle-info">
                          <span className="perm-toggle-label">{p.label}</span>
                          <span className="perm-toggle-desc">{p.description}</span>
                          {isDefault && <span className="perm-default-badge">default</span>}
                        </div>
                        <div className="perm-toggle-switch">
                          <input type="checkbox" checked={isEnabled} onChange={() => togglePerm(p.key)} />
                          <span className="perm-switch-track" />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="perm-mod-placeholder"><span>👈</span><p>Select a moderator to edit their permissions</p></div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [usersData, setUsersData] = useState(null);
  const [jobsData, setJobsData] = useState(null);
  const [servicesData, setServicesData] = useState(null);
  const [paymentsData, setPaymentsData] = useState(null);
  const [reviewsData, setReviewsData] = useState(null);
  const [monitoringData, setMonitoringData] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedUser, setSelectedUser] = useState(null);

  const loadUserDetail = async (userId) => {
    try {
      const data = await apiRequest(`/api/admin/users/${userId}/detail`);
      setSelectedUser(data);
    } catch (err) {
      console.error('Failed to load user detail:', err);
    }
  };

  const isAdminAuthenticated = user?.isAdmin;

  useEffect(() => {
    if (!isAdminAuthenticated) {
      setError('Admin access required. Please contact support if you believe this is an error.');
    }
  }, [isAdminAuthenticated, setError]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiRequest('/api/admin/dashboard');
      
      setDashboardData(response);
      setError(null);
    } catch (error) {
      console.error('AdminDashboard fetch error:', error);
      if (error.response?.status === 401) {
        setError('Authentication failed - please log in again');
      } else {
        setError('Unable to load dashboard data. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsersData = useCallback(async (page = 1, search = '', status = 'all') => {
    try {
      const response = await apiRequest('/api/admin/users', {
        params: { page, search, status, limit: 10 }
      });
      setUsersData(response);
    } catch (error) {
      console.error('Failed to fetch users data:', error);
    }
  }, []);

  const [jobFilters, setJobFilters] = useState({ status: 'all', category: 'all', search: '', sortBy: 'createdAt', sortOrder: 'desc', budgetMin: '', budgetMax: '' });

  const fetchJobsData = useCallback(async (page = 1, filters = jobFilters) => {
    try {
      const params = { page, limit: 15 };
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.category !== 'all') params.category = filters.category;
      if (filters.search) params.search = filters.search;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;
      if (filters.budgetMin) params.budgetMin = filters.budgetMin;
      if (filters.budgetMax) params.budgetMax = filters.budgetMax;
      const response = await apiRequest('/api/admin/jobs', { params });
      setJobsData(response);
    } catch (error) {
      console.error('Failed to fetch jobs data:', error);
    }
  }, [jobFilters]);

  const fetchServicesData = useCallback(async (page = 1, status = 'all') => {
    try {
      const response = await apiRequest('/api/admin/services', {
        params: { page, status, limit: 10 }
      });
      setServicesData(response);
    } catch (error) {
      console.error('Failed to fetch services data:', error);
    }
  }, []);

  const fetchPaymentsData = useCallback(async (page = 1, status = 'all') => {
    try {
      const response = await apiRequest('/api/admin/payments', {
        params: { page, status, limit: 10 }
      });
      setPaymentsData(response);
    } catch (error) {
      console.error('Failed to fetch payments data:', error);
    }
  }, []);

  const fetchReviewsData = useCallback(async (page = 1, status = 'all') => {
    try {
      const response = await apiRequest('/api/admin/reviews', {
        params: { page, status, limit: 10 }
      });
      setReviewsData(response);
    } catch (error) {
      console.error('Failed to fetch reviews data:', error);
    }
  }, []);

  const fetchMonitoringData = useCallback(async () => {
    try {
      const response = await apiRequest('/api/admin/monitoring');
      setMonitoringData(response);
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    }
  }, []);

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchDashboardData().catch(error => {
        console.error('Failed to fetch dashboard data on mount:', error);
      });
    }
  }, [isAdminAuthenticated, fetchDashboardData]);

  useEffect(() => {
    if (activeTab === 'users' && isAdminAuthenticated) {
      fetchUsersData().catch(error => {
        console.error('Failed to fetch users data:', error);
      });
    } else if (activeTab === 'jobs' && isAdminAuthenticated) {
      fetchJobsData().catch(error => {
        console.error('Failed to fetch jobs data:', error);
      });
    } else if (activeTab === 'services' && isAdminAuthenticated) {
      fetchServicesData().catch(error => {
        console.error('Failed to fetch services data:', error);
      });
    } else if (activeTab === 'payments' && isAdminAuthenticated) {
      fetchPaymentsData().catch(error => {
        console.error('Failed to fetch payments data:', error);
      });
    } else if (activeTab === 'reviews' && isAdminAuthenticated) {
      fetchReviewsData().catch(error => {
        console.error('Failed to fetch reviews data:', error);
      });
    } else if (activeTab === 'monitoring' && isAdminAuthenticated) {
      fetchMonitoringData().catch(error => {
        console.error('Failed to fetch monitoring data:', error);
      });
    }
  }, [activeTab, isAdminAuthenticated, fetchUsersData, fetchJobsData, fetchServicesData, fetchPaymentsData, fetchReviewsData, fetchMonitoringData]);

  useEffect(() => {
    let interval;
    if (activeTab === 'monitoring' && autoRefresh && isAdminAuthenticated) {
      interval = setInterval(() => {
        fetchMonitoringData().catch(error => {
          console.error('Failed to fetch monitoring data on interval:', error);
        });
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, autoRefresh, isAdminAuthenticated, fetchMonitoringData]);


  const suspendUser = async (userId, reason) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/suspend`, {
        method: 'PUT',
        body: JSON.stringify({ reason })
      });
      fetchUsersData();
    } catch (error) {
      console.error('Failed to suspend user:', error);
    }
  };

  const unsuspendUser = async (userId) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/unsuspend`, {
        method: 'PUT'
      });
      fetchUsersData();
    } catch (error) {
      console.error('Failed to unsuspend user:', error);
    }
  };

  const promoteUser = async (userId) => {
    try {
      const response = await apiRequest(`/api/admin/users/${userId}/promote`, {
        method: 'PUT'
      });
      if (response) {
        alert('User promoted to admin successfully');
        fetchUsersData();
      }
    } catch (error) {
      console.error('Error promoting user:', error);
      alert('Failed to promote user: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  const demoteUser = async (userId) => {
    try {
      const response = await apiRequest(`/api/admin/users/${userId}/demote`, {
        method: 'PUT'
      });
      if (response) {
        alert('User demoted from admin successfully');
        fetchUsersData();
      }
    } catch (error) {
      console.error('Error demoting user:', error);
      alert('Failed to demote user: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  const makeModerator = async (userId) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/make-moderator`, { method: 'PUT', body: JSON.stringify({ permissions: [] }) });
      fetchUsersData();
    } catch (err) {
      alert('Failed to make moderator: ' + (err.data?.error || err.message));
    }
  };

  const removeModerator = async (userId) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/remove-moderator`, { method: 'PUT' });
      fetchUsersData();
    } catch (err) {
      alert('Failed to remove moderator: ' + (err.data?.error || err.message));
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    const reason = window.prompt('Please provide a reason for deleting this user:');
    if (!reason) {
      return;
    }

    try {
      const response = await apiRequest(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason })
      });
      if (response) {
        alert('User deleted successfully');
        fetchUsersData();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="error-container">
          <h2>Dashboard Error</h2>
          <p>{error}</p>
          <button onClick={fetchDashboardData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <div className="header-actions">
          <button onClick={fetchDashboardData} className="refresh-button">
            Refresh Data
          </button>
        </div>
      </header>

      <div className="dashboard-tabs">
        <TabButton
          id="overview"
          label="Overview"
          active={activeTab === 'overview'}
          onClick={setActiveTab}
        />
        <TabButton
          id="users"
          label="Users"
          active={activeTab === 'users'}
          onClick={setActiveTab}
        />
        <TabButton
          id="jobs"
          label="Jobs"
          active={activeTab === 'jobs'}
          onClick={setActiveTab}
        />
        <TabButton
          id="services"
          label="Services"
          active={activeTab === 'services'}
          onClick={setActiveTab}
        />
        <TabButton
          id="payments"
          label="Payments"
          active={activeTab === 'payments'}
          onClick={setActiveTab}
        />
        <TabButton
          id="reviews"
          label="Reviews"
          active={activeTab === 'reviews'}
          onClick={setActiveTab}
        />
        <TabButton
          id="disputes"
          label="Disputes"
          active={activeTab === 'disputes'}
          onClick={setActiveTab}
        />
        <TabButton
          id="verifications"
          label="Verifications"
          active={activeTab === 'verifications'}
          onClick={setActiveTab}
        />
        <TabButton
          id="email"
          label="Email"
          active={activeTab === 'email'}
          onClick={setActiveTab}
        />
        <TabButton
          id="monitoring"
          label="Monitoring"
          active={activeTab === 'monitoring'}
          onClick={setActiveTab}
        />
        <TabButton
          id="analytics"
          label="Analytics"
          active={activeTab === 'analytics'}
          onClick={setActiveTab}
        />
        <TabButton
          id="errors"
          label="Errors"
          active={activeTab === 'errors'}
          onClick={setActiveTab}
        />
        <TabButton
          id="billing"
          label="Billing"
          active={activeTab === 'billing'}
          onClick={setActiveTab}
        />
        <TabButton
          id="permissions"
          label="Permissions"
          active={activeTab === 'permissions'}
          onClick={setActiveTab}
        />
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && dashboardData && (
          <div className="overview-tab">
            <div className="stats-grid">
              <StatCard
                title="Total Users"
                value={dashboardData.stats?.users?.total || 0}
                subtitle={`${dashboardData.stats?.users?.active || 0} active`}
                className="users-stat"
              />
              <StatCard
                title="Total Jobs"
                value={dashboardData.stats?.jobs?.total || 0}
                subtitle={`${dashboardData.stats?.jobs?.active || 0} active`}
                className="jobs-stat"
              />
              <StatCard
                title="Payment Volume"
                value={`$${(dashboardData.stats?.payments?.totalVolume || 0).toLocaleString()}`}
                subtitle={`${dashboardData.stats?.payments?.thisMonth || 0} this month`}
                className="payments-stat"
              />
              <StatCard
                title="Average Rating"
                value={(dashboardData.stats?.reviews?.averageRating || 0).toFixed(1)}
                subtitle={`${dashboardData.stats?.reviews?.total || 0} total reviews`}
                className="reviews-stat"
              />
            </div>

            <div className="recent-activity">
              <h2>Recent Activity</h2>
              <div className="activity-grid">
                <ActivitySection
                  title="New Users"
                  items={dashboardData.recentActivity?.newUsers}
                  renderItem={(user) => (
                    <>
                      <div>
                        <div className="user-name">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="user-email">{user.email}</div>
                      </div>
                      <div className="activity-date">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </>
                  )}
                />

                <ActivitySection
                  title="Recent Jobs"
                  items={dashboardData.recentActivity?.recentJobs}
                  renderItem={(job) => (
                    <>
                      <div>
                        <div className="job-title">{job.title}</div>
                        <div className="job-budget">{formatBudget(job.budget)}</div>
                      </div>
                      <div className="activity-date">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </div>
                    </>
                  )}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <TracingErrorBoundary componentName="UsersTab">
            <div className="users-tab">
              <h2>User Management</h2>

              {/* User Detail Drawer */}
              {selectedUser && (
                <AdminUserDrawer
                  data={selectedUser}
                  onClose={() => setSelectedUser(null)}
                  onRefresh={() => loadUserDetail(selectedUser.user._id)}
                />
              )}

              {usersData ? (
                <div className="users-management">
                  <div className="users-controls">
                    <input
                      type="text"
                      placeholder="🔍 Search by name, email, username..."
                      className="search-input"
                      onChange={(e) => {
                        clearTimeout(window._userSearchTimeout);
                        window._userSearchTimeout = setTimeout(() => fetchUsersData(1, e.target.value), 300);
                      }}
                    />
                    <select className="status-filter" onChange={(e) => fetchUsersData(1, '', e.target.value)}>
                      <option value="all">All Users</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="users-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Joined</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(usersData?.users) && usersData.users.length > 0 ? usersData.users.map((u) => (
                          <tr key={u._id} style={{ cursor: 'pointer' }} onClick={() => loadUserDetail(u._id)}>
                            <td>
                              {u.firstName} {u.lastName}
                              {u.feeWaiver?.enabled && <span title="Fee waived" style={{ marginLeft: '0.3rem' }}>💚</span>}
                            </td>
                            <td>{u.email}</td>
                            <td>
                              <span style={{
                                padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                                background: u.role === 'admin' ? '#fef2f2' : u.role === 'moderator' ? '#eff6ff' : '#f3f4f6',
                                color: u.role === 'admin' ? '#dc2626' : u.role === 'moderator' ? '#2563eb' : '#6b7280'
                              }}>
                                {u.role}
                              </span>
                            </td>
                            <td>
                              <span className={`status ${u.isSuspended ? 'suspended' : u.isActive ? 'active' : 'inactive'}`}>
                                {u.isSuspended ? 'Suspended' : u.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                            <td>
                              <div className="action-buttons" onClick={e => e.stopPropagation()}>
                                {u.isSuspended ? (
                                  <button className="action-btn unsuspend" onClick={() => unsuspendUser(u._id)}>Unsuspend</button>
                                ) : (
                                  <button className="action-btn suspend" onClick={() => {
                                    const reason = prompt('Reason:');
                                    if (reason) suspendUser(u._id, reason);
                                  }}>Suspend</button>
                                )}
                                {u.role === 'moderator' ? (
                                  <button className="action-btn demote" onClick={() => removeModerator(u._id)}>Remove Mod</button>
                                ) : u.isAdminPromoted ? (
                                  <button className="action-btn demote" onClick={() => demoteUser(u._id)}>Remove Admin</button>
                                ) : (
                                  <>
                                    <button className="action-btn promote" onClick={() => promoteUser(u._id)}>Make Admin</button>
                                    <button className="action-btn moderator" onClick={() => makeModerator(u._id)}>Make Moderator</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan="6" className="no-data">No users found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagination">
                    <span>Page {usersData?.pagination?.current || 1} of {usersData?.pagination?.pages || 1}</span>
                    <span>Total: {usersData?.pagination?.total || 0} users</span>
                  </div>
                </div>
              ) : (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading users...</p>
                </div>
              )}
            </div>
          </TracingErrorBoundary>
        )}

        {activeTab === 'jobs' && (
          <TracingErrorBoundary componentName="JobsTab">
            <div className="jobs-tab">
              <h2>Job Management</h2>
              {jobsData ? (
                <div className="jobs-management">
                  {/* Search + Filters */}
                  <div className="jobs-controls">
                    <input
                      type="text"
                      className="search-input"
                      placeholder="🔍 Search jobs by title, skills..."
                      value={jobFilters.search}
                      onChange={(e) => {
                        const f = { ...jobFilters, search: e.target.value };
                        setJobFilters(f);
                        clearTimeout(window._jobSearchTimeout);
                        window._jobSearchTimeout = setTimeout(() => fetchJobsData(1, f), 300);
                      }}
                    />
                    <select className="status-filter" value={jobFilters.status} onChange={(e) => {
                      const f = { ...jobFilters, status: e.target.value };
                      setJobFilters(f);
                      fetchJobsData(1, f);
                    }}>
                      <option value="all">All Statuses</option>
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="disputed">Disputed</option>
                    </select>
                    <select className="status-filter" value={jobFilters.category} onChange={(e) => {
                      const f = { ...jobFilters, category: e.target.value };
                      setJobFilters(f);
                      fetchJobsData(1, f);
                    }}>
                      <option value="all">All Categories</option>
                      {(dashboardData?.stats?.jobs?.categories || []).map(c => (
                        <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                    <select className="status-filter" value={`${jobFilters.sortBy}-${jobFilters.sortOrder}`} onChange={(e) => {
                      const [sortBy, sortOrder] = e.target.value.split('-');
                      const f = { ...jobFilters, sortBy, sortOrder };
                      setJobFilters(f);
                      fetchJobsData(1, f);
                    }}>
                      <option value="createdAt-desc">Newest First</option>
                      <option value="createdAt-asc">Oldest First</option>
                      <option value="budget.amount-desc">Budget: High → Low</option>
                      <option value="budget.amount-asc">Budget: Low → High</option>
                      <option value="proposalCount-desc">Most Proposals</option>
                      <option value="views-desc">Most Views</option>
                    </select>
                  </div>

                  {/* Results summary */}
                  <div style={{ padding: '0.5rem 0', fontSize: '0.85rem', color: '#6b7280' }}>
                    Showing {jobsData.jobs?.length || 0} of {jobsData?.pagination?.total || 0} jobs
                    {jobFilters.search && <> matching "<strong>{jobFilters.search}</strong>"</>}
                  </div>

                  {/* Table */}
                  <div className="jobs-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Client</th>
                          <th>Category</th>
                          <th>Budget</th>
                          <th>Proposals</th>
                          <th>Status</th>
                          <th>Posted</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(jobsData?.jobs) && jobsData.jobs.length > 0 ? jobsData.jobs.map((job) => (
                          <tr key={job._id}>
                            <td>
                              <a href={`/jobs/${job._id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                                {job.title}
                              </a>
                              {job.isUrgent && <span style={{ color: '#dc2626', marginLeft: '0.5rem' }}>🚨</span>}
                            </td>
                            <td>{job.client ? `${job.client.firstName} ${job.client.lastName}` : 'N/A'}</td>
                            <td><span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{(job.category || '').replace(/_/g, ' ')}</span></td>
                            <td>{formatBudget(job.budget)}</td>
                            <td style={{ textAlign: 'center' }}>{job.proposalCount || job.proposals?.length || 0}</td>
                            <td>
                              <span className={`status ${job.status}`}>
                                {job.status?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td>{new Date(job.createdAt).toLocaleDateString()}</td>
                            <td>
                              <div className="action-buttons">
                                {job.status !== 'cancelled' && (
                                  <button className="action-btn cancel" onClick={async () => {
                                    const reason = prompt('Reason for cancellation:');
                                    if (reason) {
                                      try {
                                        await apiRequest(`/api/admin/jobs/${job._id}/cancel`, { method: 'PUT', body: JSON.stringify({ reason }) });
                                        fetchJobsData(jobsData?.pagination?.current || 1, jobFilters);
                                      } catch (err) { console.error('Failed to cancel job:', err); }
                                    }
                                  }}>Cancel</button>
                                )}
                                <button className="action-btn delete" onClick={async () => {
                                  if (!window.confirm(`Remove "${job.title}"?`)) return;
                                  const reason = prompt('Reason for removal:');
                                  if (reason) {
                                    try {
                                      await apiRequest(`/api/admin/jobs/${job._id}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
                                      fetchJobsData(jobsData?.pagination?.current || 1, jobFilters);
                                    } catch (err) { alert('Failed to remove job'); }
                                  }
                                }}>Remove</button>
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="8" className="no-data">
                              {jobFilters.search ? `No jobs matching "${jobFilters.search}"` : 'No jobs found'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="pagination">
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button disabled={(jobsData?.pagination?.current || 1) <= 1}
                        onClick={() => fetchJobsData((jobsData?.pagination?.current || 1) - 1, jobFilters)}
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
                        ← Prev
                      </button>
                      <span style={{ padding: '0.4rem 0.8rem', color: '#374151' }}>
                        Page {jobsData?.pagination?.current || 1} of {jobsData?.pagination?.pages || 1}
                      </span>
                      <button disabled={(jobsData?.pagination?.current || 1) >= (jobsData?.pagination?.pages || 1)}
                        onClick={() => fetchJobsData((jobsData?.pagination?.current || 1) + 1, jobFilters)}
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
                        Next →
                      </button>
                    </div>
                    <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Total: {jobsData?.pagination?.total || 0} jobs</span>
                  </div>
                </div>
              ) : (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading jobs...</p>
                </div>
              )}
            </div>
          </TracingErrorBoundary>
        )}

        {activeTab === 'services' && (
          <TracingErrorBoundary componentName="ServicesTab">
            <div className="jobs-tab">
              <h2>Service Management</h2>
              {servicesData ? (
                <div className="jobs-management">
                  <div className="jobs-controls">
                    <select className="status-filter" onChange={(e) => fetchServicesData(1, e.target.value)}>
                      <option value="all">All Services</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="draft">Draft</option>
                      <option value="under_review">Under Review</option>
                    </select>
                  </div>
                  <div className="jobs-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Freelancer</th>
                          <th>Category</th>
                          <th>Price (Basic)</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(servicesData?.services) && servicesData.services.length > 0 ? servicesData.services.map((service) => (
                          <tr key={service._id}>
                            <td>{service.title}</td>
                            <td>{service.freelancer ? `${service.freelancer.firstName} ${service.freelancer.lastName}` : 'N/A'}</td>
                            <td>{service.category?.replace(/_/g, ' ') || 'N/A'}</td>
                            <td>${service.pricing?.basic?.price || 'N/A'}</td>
                            <td><span className={`status ${service.status}`}>{service.status}</span></td>
                            <td>
                              <div className="action-buttons">
                                <button
                                  className="action-btn delete"
                                  onClick={async () => {
                                    if (!window.confirm(`Remove "${service.title}"?`)) return;
                                    try {
                                      await apiRequest(`/api/admin/services/${service._id}`, { method: 'DELETE' });
                                      alert('Service removed');
                                      fetchServicesData();
                                    } catch (err) {
                                      console.error('Failed to remove service:', err);
                                      alert('Failed to remove service');
                                    }
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan="6" className="no-data">No services found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagination">
                    <span>Page {servicesData?.pagination?.current || 1} of {servicesData?.pagination?.pages || 1}</span>
                    <span>Total: {servicesData?.pagination?.total || 0} services</span>
                  </div>
                </div>
              ) : (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading services...</p>
                </div>
              )}
            </div>
          </TracingErrorBoundary>
        )}

        {activeTab === 'payments' && (
          <TracingErrorBoundary componentName="PaymentsTab">
            <div className="payments-tab">
              <h2>Payment Management</h2>
              {paymentsData ? (
                <div className="payments-management">
                  <div className="payments-controls">
                    <select
                      className="status-filter"
                      onChange={(e) => fetchPaymentsData(1, e.target.value)}
                    >
                      <option value="all">All Payments</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                  <div className="payments-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Amount</th>
                          <th>Client</th>
                          <th>Freelancer</th>
                          <th>Job</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(paymentsData?.payments) && paymentsData.payments.length > 0 ? paymentsData.payments.map((payment) => (
                          <tr key={payment._id}>
                            <td>${payment.amount}</td>
                            <td>{payment.client ? `${payment.client.firstName} ${payment.client.lastName}` : 'N/A'}</td>
                            <td>{payment.freelancer ? `${payment.freelancer.firstName} ${payment.freelancer.lastName}` : 'N/A'}</td>
                            <td>{payment.job ? payment.job.title : 'N/A'}</td>
                            <td>
                              <span className={`status ${payment.status}`}>
                                {payment.status}
                              </span>
                            </td>
                            <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                            <td>
                              <button className="action-btn view">View Details</button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="7" className="no-data">No payments found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagination">
                    <span>Page {paymentsData?.pagination?.current || 1} of {paymentsData?.pagination?.pages || 1}</span>
                    <span>Total: {paymentsData?.pagination?.total || 0} payments</span>
                  </div>
                </div>
              ) : (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading payments...</p>
                </div>
              )}
            </div>
          </TracingErrorBoundary>
        )}

        {activeTab === 'reviews' && (
          <TracingErrorBoundary componentName="ReviewsTab">
            <div className="reviews-tab">
              <h2>Review Management</h2>
              {reviewsData ? (
                <div className="reviews-management">
                  <div className="reviews-controls">
                    <select
                      className="status-filter"
                      onChange={(e) => fetchReviewsData(1, e.target.value)}
                    >
                      <option value="all">All Reviews</option>
                      <option value="flagged">Flagged</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                  <div className="reviews-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Rating</th>
                          <th>Reviewer</th>
                          <th>Reviewee</th>
                          <th>Job</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(reviewsData?.reviews) && reviewsData.reviews.length > 0 ? reviewsData.reviews.map((review) => (
                          <tr key={review._id}>
                            <td>
                              <div className="rating">
                                {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                              </div>
                            </td>
                            <td>{review.reviewer ? `${review.reviewer.firstName} ${review.reviewer.lastName}` : 'N/A'}</td>
                            <td>{review.reviewee ? `${review.reviewee.firstName} ${review.reviewee.lastName}` : 'N/A'}</td>
                            <td>{review.job ? review.job.title : 'N/A'}</td>
                            <td>
                              <span className={`status ${review.moderationStatus || 'pending'}`}>
                                {review.moderationStatus || 'Pending'}
                              </span>
                            </td>
                            <td>{new Date(review.createdAt).toLocaleDateString()}</td>
                            <td>
                              <div className="review-actions">
                                <button
                                  className="action-btn approve"
                                  onClick={async () => {
                                    try {
                                      await apiRequest(`/api/admin/reviews/${review._id}/moderate`, {
                                        method: 'PUT',
                                        body: JSON.stringify({ status: 'approved' })
                                      });
                                      fetchReviewsData();
                                    } catch (err) {
                                      console.error('Failed to approve review:', err);
                                    }
                                  }}
                                >
                                  Approve
                                </button>
                                <button
                                  className="action-btn reject"
                                  onClick={async () => {
                                    const notes = prompt('Reason for rejection:');
                                    try {
                                      await apiRequest(`/api/admin/reviews/${review._id}/moderate`, {
                                        method: 'PUT',
                                        body: JSON.stringify({ status: 'rejected', notes })
                                      });
                                      fetchReviewsData();
                                    } catch (err) {
                                      console.error('Failed to reject review:', err);
                                    }
                                  }}
                                >
                                  Reject
                                </button>
                                <button
                                  className="action-btn"
                                  style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                                  onClick={async () => {
                                    if (!window.confirm(`Delete this review by ${review.reviewer?.firstName || 'unknown'}? This will recalculate the reviewee's rating.`)) return;
                                    try {
                                      await apiRequest(`/api/admin/reviews/${review._id}`, { method: 'DELETE' });
                                      fetchReviewsData();
                                    } catch (err) {
                                      alert('Failed to delete: ' + (err.message || 'Unknown error'));
                                    }
                                  }}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="7" className="no-data">No reviews found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagination">
                    <span>Page {reviewsData?.pagination?.current || 1} of {reviewsData?.pagination?.pages || 1}</span>
                    <span>Total: {reviewsData?.pagination?.total || 0} reviews</span>
                  </div>
                </div>
              ) : (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading reviews...</p>
                </div>
              )}
            </div>
          </TracingErrorBoundary>
        )}

        {activeTab === 'disputes' && (
          <TracingErrorBoundary componentName="AdminDisputePanel">
            <div className="disputes-tab">
              <h2>Dispute Management</h2>
              <AdminDisputePanel />
            </div>
          </TracingErrorBoundary>
        )}

        {activeTab === 'verifications' && (
          <TracingErrorBoundary componentName="AdminVerifications">
            <AdminVerifications />
          </TracingErrorBoundary>
        )}

        {activeTab === 'email' && (
          <TracingErrorBoundary componentName="AdminEmailPanel">
            <div className="email-tab">
              <h2>Email Management</h2>
              <AdminEmailPanel />
            </div>
          </TracingErrorBoundary>
        )}

        {activeTab === 'monitoring' && (
          <TracingErrorBoundary componentName="MonitoringTab">
            <div className="monitoring-tab">
              <div className="monitoring-header">
                <h2>Real-time System Monitoring</h2>
                <div className="monitoring-controls">
                  <label>
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                    />
                    Auto-refresh (30s)
                  </label>
                  <button onClick={fetchMonitoringData} className="refresh-button">
                    Refresh Now
                  </button>
                </div>
              </div>

              {monitoringData ? (
                <div className="monitoring-content">
                  <div className="stats-grid">
                    <StatCard
                      title="Active Connections"
                      value={monitoringData.connectionStats?.totalConnections || 0}
                      subtitle={`${monitoringData.connectionStats?.uniqueUsers || 0} unique users`}
                      className="connections-stat"
                    />
                    <StatCard
                      title="Messages (24h)"
                      value={monitoringData.messageStats?.totalMessages || 0}
                      subtitle={`${monitoringData.messageStats?.groupMessages || 0} group, ${monitoringData.messageStats?.directMessages || 0} direct`}
                      className="messages-stat"
                    />
                    <StatCard
                      title="Active Rooms"
                      value={monitoringData.roomStats?.activeRooms || 0}
                      subtitle={`${monitoringData.roomStats?.totalRooms || 0} total rooms`}
                      className="rooms-stat"
                    />
                    <StatCard
                      title="Unread Messages"
                      value={monitoringData.messageStats?.unreadMessages || 0}
                      subtitle="Across all users"
                      className="unread-stat"
                    />
                  </div>

                  <div className="monitoring-sections">
                    <div className="online-users-section">
                      <h3>Online Users ({monitoringData.onlineUsers?.length || 0})</h3>
                      <div className="online-users-list">
                        {Array.isArray(monitoringData?.onlineUsers) && monitoringData.onlineUsers.length > 0 ? monitoringData.onlineUsers.map((user, index) => (
                          <div key={index} className="online-user-item">
                            <div className="user-info">
                              <div className="user-name">{user.firstName} {user.lastName}</div>
                              <div className="user-email">{user.email}</div>
                            </div>
                            <div className="connection-indicator online"></div>
                          </div>
                        )) : <p>No users currently online</p>}
                      </div>
                    </div>

                    <div className="system-health-section">
                      <h3>System Health</h3>
                      <div className="health-metrics">
                        <div className="health-item">
                          <span className="metric-label">Uptime:</span>
                          <span className="metric-value">
                            {Math.floor((monitoringData.systemHealth?.uptime || 0) / 3600)}h {Math.floor(((monitoringData.systemHealth?.uptime || 0) % 3600) / 60)}m
                          </span>
                        </div>
                        <div className="health-item">
                          <span className="metric-label">Memory Usage:</span>
                          <span className="metric-value">
                            {Math.round((monitoringData.systemHealth?.memoryUsage?.used || 0) / 1024 / 1024)}MB
                          </span>
                        </div>
                        <div className="health-item">
                          <span className="metric-label">Last Updated:</span>
                          <span className="metric-value">
                            {new Date(monitoringData.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading monitoring data...</p>
                </div>
              )}
            </div>
          </TracingErrorBoundary>
        )}

        {activeTab === 'analytics' && (
          <div className="analytics-tab">
            <TracingErrorBoundary componentName="AnalyticsTab">
              <AnalyticsTab />
            </TracingErrorBoundary>
          </div>
        )}
        {activeTab === 'errors' && (
          <div className="errors-tab">
            <TracingErrorBoundary componentName="ErrorDashboard">
              <ErrorDashboard />
            </TracingErrorBoundary>
          </div>
        )}
        {activeTab === 'billing' && (
          <div className="billing-tab">
            <TracingErrorBoundary componentName="AdminBillingTab">
              <AdminBillingTab />
            </TracingErrorBoundary>
          </div>
        )}

        {activeTab === 'permissions' && (
          <PermissionsTab />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
