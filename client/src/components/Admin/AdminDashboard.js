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
import AdminVerifications from './AdminVerifications';
import AdminBillingTab from './AdminBillingTab';
import FeatureGroupsPanel from './FeatureGroupsPanel';
import AdminUsersTab from './AdminUsersTab';
import AdminJobsTab from './AdminJobsTab';
import AdminServicesTab from './AdminServicesTab';
import AdminPaymentsTab from './AdminPaymentsTab';
import AdminReviewsTab from './AdminReviewsTab';
import AdminMonitoringTab from './AdminMonitoringTab';
import AdminBookingsTab from './AdminBookingsTab';
import AdminBoostsTab from './AdminBoostsTab';
import AdminContractsTab from './AdminContractsTab';
import AdminMessagesTab from './AdminMessagesTab';
import AdminOrdersTab from './AdminOrdersTab';
import AdminAISettingsTab from './AdminAISettingsTab';
import AdminWalletsTab from './AdminWalletsTab';
import AdminTeamsTab from './AdminTeamsTab';
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
        <TabButton
          id="feature-groups"
          label="🏷 Groups"
          active={activeTab === 'feature-groups'}
          onClick={setActiveTab}
        />
        <TabButton
          id="bookings"
          label="Bookings"
          active={activeTab === 'bookings'}
          onClick={setActiveTab}
        />
        <TabButton
          id="boosts"
          label="Boosts"
          active={activeTab === 'boosts'}
          onClick={setActiveTab}
        />
        <TabButton
          id="contracts"
          label="Contracts"
          active={activeTab === 'contracts'}
          onClick={setActiveTab}
        />
        <TabButton
          id="messages"
          label="Messages"
          active={activeTab === 'messages'}
          onClick={setActiveTab}
        />
        <TabButton
          id="orders"
          label="Orders"
          active={activeTab === 'orders'}
          onClick={setActiveTab}
        />
        <TabButton
          id="wallets"
          label="Wallets"
          active={activeTab === 'wallets'}
          onClick={setActiveTab}
        />
        <TabButton
          id="teams"
          label="Teams"
          active={activeTab === 'teams'}
          onClick={setActiveTab}
        />
        <TabButton
          id="ai-settings"
          label="✨ AI"
          active={activeTab === 'ai-settings'}
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
          <AdminUsersTab
            usersData={usersData} selectedUser={selectedUser} setSelectedUser={setSelectedUser}
            loadUserDetail={loadUserDetail} fetchUsersData={fetchUsersData}
            suspendUser={suspendUser} unsuspendUser={unsuspendUser}
            promoteUser={promoteUser} demoteUser={demoteUser}
            makeModerator={makeModerator} removeModerator={removeModerator}
          />
        )}

        {activeTab === 'jobs' && (
          <AdminJobsTab jobsData={jobsData} jobFilters={jobFilters} setJobFilters={setJobFilters} fetchJobsData={fetchJobsData} dashboardData={dashboardData} />
        )}

        {activeTab === 'services' && (
          <AdminServicesTab servicesData={servicesData} fetchServicesData={fetchServicesData} />
        )}

        {activeTab === 'payments' && (
          <AdminPaymentsTab paymentsData={paymentsData} fetchPaymentsData={fetchPaymentsData} />
        )}

        {activeTab === 'reviews' && (
          <AdminReviewsTab reviewsData={reviewsData} fetchReviewsData={fetchReviewsData} />
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
          <AdminMonitoringTab monitoringData={monitoringData} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} fetchMonitoringData={fetchMonitoringData} />
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

        {activeTab === 'feature-groups' && (
          <div className="billing-tab">
            <TracingErrorBoundary componentName="FeatureGroupsPanel">
              <FeatureGroupsPanel />
            </TracingErrorBoundary>
          </div>
        )}

        {activeTab === 'bookings' && (
          <TracingErrorBoundary componentName="AdminBookingsTab">
            <AdminBookingsTab />
          </TracingErrorBoundary>
        )}

        {activeTab === 'boosts' && (
          <TracingErrorBoundary componentName="AdminBoostsTab">
            <AdminBoostsTab />
          </TracingErrorBoundary>
        )}

        {activeTab === 'contracts' && (
          <TracingErrorBoundary componentName="AdminContractsTab">
            <AdminContractsTab />
          </TracingErrorBoundary>
        )}

        {activeTab === 'messages' && (
          <TracingErrorBoundary componentName="AdminMessagesTab">
            <AdminMessagesTab />
          </TracingErrorBoundary>
        )}

        {activeTab === 'orders' && (
          <TracingErrorBoundary componentName="AdminOrdersTab">
            <AdminOrdersTab />
          </TracingErrorBoundary>
        )}

        {activeTab === 'wallets' && (
          <TracingErrorBoundary componentName="AdminWalletsTab">
            <AdminWalletsTab />
          </TracingErrorBoundary>
        )}

        {activeTab === 'teams' && (
          <TracingErrorBoundary componentName="AdminTeamsTab">
            <AdminTeamsTab />
          </TracingErrorBoundary>
        )}

        {activeTab === 'ai-settings' && (
          <TracingErrorBoundary componentName="AdminAISettingsTab">
            <AdminAISettingsTab />
          </TracingErrorBoundary>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

