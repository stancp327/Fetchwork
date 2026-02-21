import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatBudget, formatDuration, formatCategory, formatJobStatus, getStatusClass } from '../../utils/formatters';
import { getLocationDisplay } from '../../utils/location';

const JobCard = ({ job }) => {
  const navigate = useNavigate();

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">{job.title}</h3>
          <div className="card-meta">
            Posted by {job.client.firstName} {job.client.lastName} • {formatBudget(job.budget)} • {formatDuration(job.duration)}
          </div>
        </div>
        <div className="tags">
          <span className={getStatusClass(job.status)}>{formatJobStatus(job.status)}</span>
          <span className="tag primary">{formatCategory(job.category)}</span>
          <span className="tag">{job.experienceLevel}</span>
          {job.isUrgent && <span className="tag warning">Urgent</span>}
          {job.isFeatured && <span className="tag success">Featured</span>}
        </div>
      </div>

      <div className="card-content">
        <p>{job.description.substring(0, 300)}{job.description.length > 300 ? '...' : ''}</p>
        
        {job.skills && job.skills.length > 0 && (
          <div className="tags">
            {job.skills.slice(0, 5).map((skill, index) => (
              <span key={index} className="tag">{skill}</span>
            ))}
            {job.skills.length > 5 && <span className="tag">+{job.skills.length - 5} more</span>}
          </div>
        )}
      </div>

      <div className="card-footer">
        <div className="card-meta">
          {job.proposalCount} proposals • {job.views} views • {getLocationDisplay(job.location)}
        </div>
        <button 
          onClick={() => navigate(`/jobs/${job._id}`)}
          className="btn btn-primary"
        >
          View Details
        </button>
      </div>
    </div>
  );
};

export default JobCard;
