import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatBudget, formatDuration, formatCategory, formatJobStatus, getStatusClass } from '../../utils/formatters';
import { getLocationDisplay } from '../../utils/location';
import TrustBadges from '../common/TrustBadges';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';

const JobCard = ({ job }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messagingLoading, setMessagingLoading] = useState(false);

  const isOwnJob = user && job.client?._id && user._id === job.client._id.toString();

  const handleMessage = async (e) => {
    e.stopPropagation(); // Don't trigger card click
    if (!user) { navigate('/login'); return; }
    const clientId = job.client?._id;
    if (!clientId) return;
    setMessagingLoading(true);
    try {
      // Find or create conversation — no auto-message, user types their own
      const res = await apiRequest('/api/messages/conversations/find-or-create', {
        method: 'POST',
        body: JSON.stringify({ recipientId: clientId, jobId: job._id })
      });
      navigate(`/messages?conversation=${res.conversationId}`);
    } catch {
      navigate('/messages');
    } finally {
      setMessagingLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">{job.title}</h3>
          {(job.team || job.teamId) && (
            <div className="jc-team-badge">
              <span className="jc-team-badge-icon">
                {job.team?.logo ? (
                  <picture>
                    <source srcSet={job.team.logo} type="image/webp" />
                    <img src={job.team.logo} alt="" className="jc-team-badge-logo" loading="lazy" />
                  </picture>
                ) : (
                  (job.team?.name || 'T')[0]
                )}
              </span>
              <span>Posted by {job.team?.name || 'Company'}</span>
            </div>
          )}
          <div className="card-meta">
            Posted by {job.client.firstName} {job.client.lastName} <TrustBadges user={job.client} size="xs" /> • {formatBudget(job.budget)} • {formatDuration(job.duration)}
          </div>
        </div>
        <div className="tags">
          <span className={getStatusClass(job.status)}>{formatJobStatus(job.status)}</span>
          <span className="tag primary">{formatCategory(job.category)}</span>
          <span className="tag">{job.experienceLevel}</span>
          {job.isUrgent && <span className="tag warning">Urgent</span>}
          {job.isFeatured && <span className="tag-featured">⭐ Featured</span>}
        </div>
      </div>

      <div className="card-content">
        <p>{job.description.substring(0, 300)}{job.description.length > 300 ? '...' : ''}</p>
        
        {job.skills && job.skills.length > 0 && (
          <div className="tags">
            {job.skills.slice(0, 5).map((skill, index) => (
              <button
                key={index}
                className="tag tag-clickable"
                title={`Find more jobs requiring ${skill}`}
                onClick={e => { e.stopPropagation(); navigate(`/browse-jobs?search=${encodeURIComponent(skill)}`); }}
              >
                {skill}
              </button>
            ))}
            {job.skills.length > 5 && <span className="tag">+{job.skills.length - 5} more</span>}
          </div>
        )}
      </div>

      <div className="card-footer">
        <div className="card-meta">
          {job.proposalCount || 0} applicant{(job.proposalCount || 0) !== 1 ? 's' : ''} • {job.views || 0} views • {getLocationDisplay(job.location)}
          {job.distanceMiles != null && <span style={{ color: '#2563eb', fontWeight: 500 }}> • 📍 {job.distanceMiles} mi</span>}
          {job.deadline && ` • ⏰ Due ${new Date(job.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
        </div>
        <div className="job-card-actions">
          {!isOwnJob && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleMessage}
              disabled={messagingLoading}
            >
              {messagingLoading ? '...' : '💬 Message'}
            </button>
          )}
          <button
            onClick={() => navigate(`/jobs/${job._id}`)}
            className="btn btn-primary btn-sm"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
