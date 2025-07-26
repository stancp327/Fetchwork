import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import './Profile.css';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const { currentRole } = useRole();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    skills: [],
    hourlyRate: 0,
    location: '',
    phone: '',
    profilePicture: '',
    socialLinks: {
      linkedin: '',
      github: '',
      portfolio: '',
      twitter: ''
    }
  });
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        bio: user.bio || '',
        skills: user.skills || [],
        hourlyRate: user.hourlyRate || 0,
        location: user.location || '',
        phone: user.phone || '',
        profilePicture: user.profilePicture || '',
        socialLinks: {
          linkedin: user.socialLinks?.linkedin || '',
          github: user.socialLinks?.github || '',
          portfolio: user.socialLinks?.portfolio || '',
          twitter: user.socialLinks?.twitter || ''
        }
      });
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('socialLinks.')) {
      const socialField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        socialLinks: {
          ...prev.socialLinks,
          [socialField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        updateUser(data.user);
        setMessage('Profile updated successfully!');
        setIsEditing(false);
      } else {
        setMessage(data.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setMessage('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="star filled">★</span>);
    }

    if (hasHalfStar) {
      stars.push(<span key="half" className="star half">★</span>);
    }

    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className="star empty">☆</span>);
    }

    return stars;
  };

  if (!user) {
    return <div className="profile-loading">Loading profile...</div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-avatar-section">
          <img 
            src={user.profilePicture || '/default-avatar.png'} 
            alt={`${user.firstName} ${user.lastName}`}
            className="profile-avatar-large"
          />
          <div className="profile-basic-info">
            <h1>{user.firstName} {user.lastName}</h1>
            <p className="profile-role-badge">{currentRole === 'freelancer' ? 'Freelancer' : 'Client'}</p>
            {user.rating > 0 && (
              <div className="profile-rating">
                <div className="stars">
                  {renderStars(user.rating)}
                </div>
                <span className="rating-text">
                  {user.rating.toFixed(1)} ({user.totalReviews} reviews)
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="profile-stats">
          <div className="stat-item">
            <span className="stat-number">{user.completedJobs || 0}</span>
            <span className="stat-label">Jobs Completed</span>
          </div>
          {currentRole === 'freelancer' && (
            <div className="stat-item">
              <span className="stat-number">${user.totalEarnings || 0}</span>
              <span className="stat-label">Total Earned</span>
            </div>
          )}
          <div className="stat-item">
            <span className="stat-number">{new Date(user.createdAt).getFullYear()}</span>
            <span className="stat-label">Member Since</span>
          </div>
        </div>

        <button 
          className="btn btn-primary edit-profile-btn"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="profile-content">
        {isEditing ? (
          <form onSubmit={handleSubmit} className="profile-edit-form">
            <div className="form-section">
              <h3>Basic Information</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Tell us about yourself..."
                  maxLength="500"
                />
                <small>{formData.bio.length}/500 characters</small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="location">Location</label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="City, Country"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="phone">Phone</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              {currentRole === 'freelancer' && (
                <div className="form-group">
                  <label htmlFor="hourlyRate">Hourly Rate ($)</label>
                  <input
                    type="number"
                    id="hourlyRate"
                    name="hourlyRate"
                    value={formData.hourlyRate}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                  />
                </div>
              )}
            </div>

            {currentRole === 'freelancer' && (
              <div className="form-section">
                <h3>Skills</h3>
                <div className="skills-input">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="Add a skill..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                  />
                  <button type="button" onClick={handleAddSkill} className="btn btn-secondary">
                    Add
                  </button>
                </div>
                <div className="skills-list">
                  {formData.skills.map((skill, index) => (
                    <span key={index} className="skill-tag">
                      {skill}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveSkill(skill)}
                        className="remove-skill"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="form-section">
              <h3>Social Links</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="socialLinks.linkedin">LinkedIn</label>
                  <input
                    type="url"
                    id="socialLinks.linkedin"
                    name="socialLinks.linkedin"
                    value={formData.socialLinks.linkedin}
                    onChange={handleInputChange}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="socialLinks.github">GitHub</label>
                  <input
                    type="url"
                    id="socialLinks.github"
                    name="socialLinks.github"
                    value={formData.socialLinks.github}
                    onChange={handleInputChange}
                    placeholder="https://github.com/username"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="socialLinks.portfolio">Portfolio</label>
                  <input
                    type="url"
                    id="socialLinks.portfolio"
                    name="socialLinks.portfolio"
                    value={formData.socialLinks.portfolio}
                    onChange={handleInputChange}
                    placeholder="https://yourportfolio.com"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="socialLinks.twitter">Twitter</label>
                  <input
                    type="url"
                    id="socialLinks.twitter"
                    name="socialLinks.twitter"
                    value={formData.socialLinks.twitter}
                    onChange={handleInputChange}
                    placeholder="https://twitter.com/username"
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-view">
            <div className="profile-section">
              <h3>About</h3>
              <p className="profile-bio">
                {user.bio || 'No bio provided yet.'}
              </p>
            </div>

            <div className="profile-section">
              <h3>Details</h3>
              <div className="profile-details">
                {user.location && (
                  <div className="detail-item">
                    <span className="detail-label">📍 Location:</span>
                    <span className="detail-value">{user.location}</span>
                  </div>
                )}
                {user.phone && (
                  <div className="detail-item">
                    <span className="detail-label">📞 Phone:</span>
                    <span className="detail-value">{user.phone}</span>
                  </div>
                )}
                {currentRole === 'freelancer' && user.hourlyRate > 0 && (
                  <div className="detail-item">
                    <span className="detail-label">💰 Hourly Rate:</span>
                    <span className="detail-value">${user.hourlyRate}/hour</span>
                  </div>
                )}
                <div className="detail-item">
                  <span className="detail-label">📧 Email:</span>
                  <span className="detail-value">{user.email}</span>
                </div>
              </div>
            </div>

            {currentRole === 'freelancer' && user.skills && user.skills.length > 0 && (
              <div className="profile-section">
                <h3>Skills</h3>
                <div className="skills-display">
                  {user.skills.map((skill, index) => (
                    <span key={index} className="skill-tag-display">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(user.socialLinks?.linkedin || user.socialLinks?.github || user.socialLinks?.portfolio || user.socialLinks?.twitter) && (
              <div className="profile-section">
                <h3>Social Links</h3>
                <div className="social-links">
                  {user.socialLinks.linkedin && (
                    <a href={user.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="social-link">
                      LinkedIn
                    </a>
                  )}
                  {user.socialLinks.github && (
                    <a href={user.socialLinks.github} target="_blank" rel="noopener noreferrer" className="social-link">
                      GitHub
                    </a>
                  )}
                  {user.socialLinks.portfolio && (
                    <a href={user.socialLinks.portfolio} target="_blank" rel="noopener noreferrer" className="social-link">
                      Portfolio
                    </a>
                  )}
                  {user.socialLinks.twitter && (
                    <a href={user.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="social-link">
                      Twitter
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
