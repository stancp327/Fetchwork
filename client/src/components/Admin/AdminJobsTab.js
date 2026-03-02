import React from 'react';
import { apiRequest } from '../../utils/api';
import { formatBudget } from '../../utils/formatters';
import TracingErrorBoundary from '../common/TracingErrorBoundary';

const AdminJobsTab = ({ jobsData, jobFilters, setJobFilters, fetchJobsData, dashboardData }) => {
  return (
    <TracingErrorBoundary componentName="JobsTab">
      <div className="jobs-tab">
        <h2>Job Management</h2>
        {jobsData ? (
          <div className="jobs-management">
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

            <div style={{ padding: '0.5rem 0', fontSize: '0.85rem', color: '#6b7280' }}>
              Showing {jobsData.jobs?.length || 0} of {jobsData?.pagination?.total || 0} jobs
              {jobFilters.search && <> matching "<strong>{jobFilters.search}</strong>"</>}
            </div>

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
                      <td><span className={`status ${job.status}`}>{job.status?.replace(/_/g, ' ')}</span></td>
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
  );
};

export default AdminJobsTab;
