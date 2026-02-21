import React from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatters';
import { getLocationDisplay } from '../../utils/location';

const FreelancerCard = ({ freelancer }) => {
  const profilePath = `/freelancer/${freelancer.username || freelancer._id}`;
  return (
    <div className="freelancer-card">
      <div className="freelancer-header">
        <img 
          src={freelancer.profilePicture || '/default-avatar.png'} 
          alt={`${freelancer.firstName} ${freelancer.lastName}`}
          className="freelancer-avatar"
        />
        <div className="freelancer-info">
          <h3>{freelancer.firstName} {freelancer.lastName}</h3>
          <div className="freelancer-rating">
            <span className="rating">★ {Number(freelancer.rating || 0).toFixed(1)}</span>
            <span className="reviews">({freelancer.totalReviews || 0} reviews)</span>
          </div>
          <div className="freelancer-card-stats">
            <span className="stat-badge">⭐ {Number(freelancer.rating || 0).toFixed(1)}</span>
            <span className="stat-badge">✓ {freelancer.completedJobs || 0} jobs</span>
          </div>
        </div>
      </div>

      <div className="freelancer-bio">
        <p>{freelancer.bio || 'No bio available'}</p>
      </div>

      <div className="freelancer-skills">
        {Array.isArray(freelancer.skills) && freelancer.skills.slice(0, 5).map((skill, index) => (
          <span key={index} className="skill-tag">{skill}</span>
        ))}
        {Array.isArray(freelancer.skills) && freelancer.skills.length > 5 && (
          <span className="skill-more">+{freelancer.skills.length - 5} more</span>
        )}
      </div>

      <div className="freelancer-stats">
        <div className="stat">
          <span className="stat-value">{freelancer.completedJobs || 0}</span>
          <span className="stat-label">Jobs Completed</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formatCurrency(freelancer.totalEarnings || 0)}</span>
          <span className="stat-label">Total Earned</span>
        </div>
      </div>

      <div className="freelancer-location">
        📍 {getLocationDisplay(freelancer.location) || 'Location not specified'}
      </div>

      <div className="freelancer-actions">
        <Link to={profilePath} className="btn btn-primary">
          View Profile
        </Link>
        <Link to={`/messages/new?freelancer=${freelancer._id}`} className="btn btn-secondary">
          Contact
        </Link>
      </div>
    </div>
  );
};

export default FreelancerCard;
