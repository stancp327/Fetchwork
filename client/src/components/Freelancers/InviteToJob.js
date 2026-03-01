import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import { useToast } from '../common/Toast';
import '../Jobs/QuickApply.css'; // Reuse modal styles

const InviteToJob = ({ freelancer, onClose }) => {
  const { addToast } = useToast();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch client's open jobs
    apiRequest('/api/jobs/my-jobs?status=open')
      .then(data => setJobs(data.jobs || data || []))
      .catch(() => setJobs([]));
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;
    setLoading(true);
    try {
      await apiRequest(`/api/messages/conversations`, {
        method: 'POST',
        body: JSON.stringify({
          recipientId: freelancer._id,
          content: message || `Hi ${freelancer.firstName}, I'd like to invite you to apply to my job. Check it out and let me know if you're interested!`,
          jobId: selectedJob,
        })
      });
      addToast(`Invitation sent to ${freelancer.firstName}!`, 'success');
      onClose();
    } catch (err) {
      addToast(err.message || 'Failed to send invite', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="qa-overlay" onClick={onClose}>
      <div className="qa-modal" onClick={e => e.stopPropagation()}>
        <div className="qa-header">
          <h3>📩 Invite {freelancer.firstName} to a Job</h3>
          <button className="qa-close" onClick={onClose}>×</button>
        </div>

        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: '#6b7280' }}>
            <p>You don't have any open jobs yet.</p>
            <a href="/post-job" className="qa-btn-primary" style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px' }}>
              Post a Job First
            </a>
          </div>
        ) : (
          <form onSubmit={handleInvite}>
            <div className="qa-field">
              <label>Select a Job *</label>
              <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)} required>
                <option value="">Choose a job...</option>
                {jobs.map(j => (
                  <option key={j._id} value={j._id}>{j.title}</option>
                ))}
              </select>
            </div>
            <div className="qa-field">
              <label>Personal Message (optional)</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={`Hi ${freelancer.firstName}, I think you'd be great for this project...`}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="qa-actions">
              <button type="button" className="qa-btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="qa-btn-primary" disabled={loading || !selectedJob}>
                {loading ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default InviteToJob;
