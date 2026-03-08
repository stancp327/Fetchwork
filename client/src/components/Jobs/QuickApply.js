import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import './QuickApply.css';

const AiWriteButton = ({ job, user, onDraft }) => {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/ai/write-proposal', {
        method: 'POST',
        body: JSON.stringify({
          jobTitle: job.title,
          jobDescription: job.description,
          jobBudget: job.budget?.amount,
          jobCategory: job.category,
          userBio: user.bio,
          userSkills: user.skills,
        }),
      });
      if (data.draft) {
        onDraft(data.draft);
        addToast('AI draft generated — edit it to make it yours!', 'success');
      }
    } catch (err) {
      if (err.status === 403) {
        addToast('AI Proposal Writer is a Plus+ feature — upgrade to use it.', 'warning');
      } else {
        addToast('Could not generate draft — try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" className="qa-ai-btn" onClick={handleGenerate} disabled={loading}>
      {loading ? '✨ Writing…' : '✨ AI Draft'}
    </button>
  );
};

const QuickApply = ({ job, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [coverLetter, setCoverLetter] = useState('');
  const [proposedBudget, setProposedBudget] = useState(job.budget?.amount || '');
  const [proposedDuration, setProposedDuration] = useState(job.duration || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!coverLetter.trim() || !proposedBudget || !proposedDuration) return;

    setLoading(true);
    try {
      await apiRequest(`/api/jobs/${job._id}/proposals`, {
        method: 'POST',
        body: JSON.stringify({ coverLetter, proposedBudget: parseFloat(proposedBudget), proposedDuration })
      });
      addToast('Proposal submitted!', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      addToast(err.message || 'Failed to submit', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="qa-overlay" onClick={onClose}>
      <div className="qa-modal" onClick={e => e.stopPropagation()}>
        <div className="qa-header">
          <h3>⚡ Quick Apply</h3>
          <button className="qa-close" onClick={onClose}>×</button>
        </div>
        <p className="qa-job-title">{job.title}</p>
        <form onSubmit={handleSubmit}>
          <div className="qa-field">
            <div className="qa-field-header">
              <label>Cover Letter *</label>
              <AiWriteButton job={job} user={user} onDraft={draft => setCoverLetter(draft)} />
            </div>
            <textarea
              value={coverLetter}
              onChange={e => setCoverLetter(e.target.value)}
              placeholder="Why are you a great fit for this job?"
              rows={4}
              maxLength={2000}
              required
            />
            <span className="qa-hint">{coverLetter.length}/2000</span>
          </div>
          <div className="qa-row">
            <div className="qa-field">
              <label>Your Bid ($) *</label>
              <input type="number" value={proposedBudget} onChange={e => setProposedBudget(e.target.value)} min="1" step="0.01" required />
            </div>
            <div className="qa-field">
              <label>Duration *</label>
              <select value={proposedDuration} onChange={e => setProposedDuration(e.target.value)} required>
                <option value="">Select</option>
                <option value="less_than_1_week">Less than 1 week</option>
                <option value="1_2_weeks">1-2 weeks</option>
                <option value="1_month">1 month</option>
                <option value="2_3_months">2-3 months</option>
                <option value="3_6_months">3-6 months</option>
                <option value="more_than_6_months">6+ months</option>
              </select>
            </div>
          </div>
          <div className="qa-actions">
            <button type="button" className="qa-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="qa-btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickApply;
