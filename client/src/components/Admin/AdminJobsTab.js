import React from 'react';
import { apiRequest } from '../../utils/api';
import { formatBudget } from '../../utils/formatters';
import TracingErrorBoundary from '../common/TracingErrorBoundary';

const CATEGORIES = [
  { id: 'web_development', label: 'Web Development' },
  { id: 'mobile_development', label: 'Mobile Development' },
  { id: 'design', label: 'Design' },
  { id: 'writing', label: 'Writing' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'video_editing', label: 'Video & Animation' },
  { id: 'music_audio', label: 'Music & Audio' },
  { id: 'data_entry', label: 'Data & Research' },
  { id: 'virtual_assistant', label: 'Virtual Assistant' },
  { id: 'translation', label: 'Translation' },
  { id: 'consulting', label: 'Consulting' },
  { id: 'customer_service', label: 'Customer Service' },
  { id: 'tutoring', label: 'Tutoring & Lessons' },
  { id: 'home_repair', label: 'Home Repair' },
  { id: 'cleaning', label: 'Cleaning' },
  { id: 'moving_hauling', label: 'Moving & Hauling' },
  { id: 'landscaping', label: 'Landscaping & Yard' },
  { id: 'delivery', label: 'Delivery & Errands' },
  { id: 'assembly', label: 'Assembly & Installation' },
  { id: 'auto_services', label: 'Auto Services' },
  { id: 'pet_care', label: 'Pet Care' },
  { id: 'event_help', label: 'Event Help' },
  { id: 'personal_care', label: 'Personal Care' },
  { id: 'photography', label: 'Photography' },
  { id: 'cooking_classes', label: 'Cooking Classes' },
  { id: 'fitness_classes', label: 'Fitness & Training' },
  { id: 'art_classes', label: 'Art & Crafts' },
  { id: 'music_lessons', label: 'Music Lessons' },
  { id: 'language_classes', label: 'Language Classes' },
  { id: 'dance_classes', label: 'Dance Classes' },
  { id: 'tech_workshops', label: 'Tech Workshops' },
  { id: 'yoga_meditation', label: 'Yoga & Meditation' },
  { id: 'other', label: 'Other' },
];

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
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
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
                    <th>Ref</th>
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
                      <td><span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' }}>{job.jobRef || '—'}</span></td>
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
