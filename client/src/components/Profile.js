import React, { useState, useEffect } from 'react';
import Navigation from './Navigation';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user, token } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    bio: '',
    skills: [],
    hourlyRate: 0,
    location: '',
    phone: '',
    website: '',
    workHistory: [],
    portfolio: [],
    profilePicture: '',
    rating: { average: 0, count: 0 },
    isVerified: false,
    verificationBadges: [],
    totalEarnings: 0,
    completedJobs: 0
  });

  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setProfileData(data);
        setError('');
      } else {
        setError(data.message || 'Failed to fetch profile');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'skills') {
      setProfileData({
        ...profileData,
        [name]: value.split(',').map(skill => skill.trim())
      });
    } else {
      setProfileData({
        ...profileData,
        [name]: value
      });
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      const result = await response.json();

      if (response.ok) {
        setProfileData(result);
        setIsEditing(false);
        setError('');
        alert('Profile updated successfully!');
      } else {
        setError(result.message || 'Failed to update profile');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addWorkHistory = () => {
    setProfileData({
      ...profileData,
      workHistory: [...profileData.workHistory, {
        title: '',
        company: '',
        duration: '',
        description: '',
        startDate: '',
        endDate: ''
      }]
    });
  };

  const updateWorkHistory = (index, field, value) => {
    const updatedHistory = [...profileData.workHistory];
    updatedHistory[index][field] = value;
    setProfileData({
      ...profileData,
      workHistory: updatedHistory
    });
  };

  const removeWorkHistory = (index) => {
    const updatedHistory = profileData.workHistory.filter((_, i) => i !== index);
    setProfileData({
      ...profileData,
      workHistory: updatedHistory
    });
  };

  const addPortfolioItem = () => {
    setProfileData({
      ...profileData,
      portfolio: [...profileData.portfolio, {
        title: '',
        description: '',
        imageUrl: '',
        projectUrl: '',
        technologies: [],
        completedDate: ''
      }]
    });
  };

  const updatePortfolioItem = (index, field, value) => {
    const updatedPortfolio = [...profileData.portfolio];
    if (field === 'technologies') {
      updatedPortfolio[index][field] = value.split(',').map(tech => tech.trim());
    } else {
      updatedPortfolio[index][field] = value;
    }
    setProfileData({
      ...profileData,
      portfolio: updatedPortfolio
    });
  };

  const removePortfolioItem = (index) => {
    const updatedPortfolio = profileData.portfolio.filter((_, i) => i !== index);
    setProfileData({
      ...profileData,
      portfolio: updatedPortfolio
    });
  };

  if (loading) {
    return (
      <div>
        <Navigation />
        <div className="page-container">
          <div className="loading">Loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="page-container">
        <div className="profile">
          {error && <div className="error-message">{error}</div>}
          
          <div className="profile-header">
            <div className="profile-avatar">
              {profileData.profilePicture ? (
                <img src={profileData.profilePicture} alt="Profile" className="avatar-image" />
              ) : (
                <div className="avatar-placeholder">
                  {profileData.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              {profileData.isVerified && (
                <div className="verification-badge">✓</div>
              )}
            </div>
            <div className="profile-info">
              <h1>{profileData.name}</h1>
              <p className="user-type">{profileData.userType}</p>
              <p className="location">📍 {profileData.location}</p>
              <div className="profile-stats">
                <div className="stat">
                  <span className="stat-value">⭐ {profileData.rating.average.toFixed(1)}</span>
                  <span className="stat-label">({profileData.rating.count} reviews)</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{profileData.completedJobs}</span>
                  <span className="stat-label">Jobs Completed</span>
                </div>
                {profileData.userType === 'freelancer' && (
                  <div className="stat">
                    <span className="stat-value">${profileData.hourlyRate}/hr</span>
                    <span className="stat-label">Hourly Rate</span>
                  </div>
                )}
              </div>
              <div className="verification-badges">
                {profileData.verificationBadges.map((badge, index) => (
                  <span key={index} className={`badge ${badge}`}>
                    {badge.charAt(0).toUpperCase() + badge.slice(1)} Verified
                  </span>
                ))}
              </div>
            </div>
            <div className="profile-actions">
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="edit-btn">
                  Edit Profile
                </button>
              ) : (
                <div className="edit-actions">
                  <button onClick={handleSave} className="save-btn" disabled={loading}>
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setIsEditing(false)} className="cancel-btn">Cancel</button>
                </div>
              )}
            </div>
          </div>
          
          <div className="profile-content">
            <div className="profile-section">
              <h3>About</h3>
              {isEditing ? (
                <textarea
                  name="bio"
                  value={profileData.bio}
                  onChange={handleChange}
                  rows="4"
                  className="edit-textarea"
                />
              ) : (
                <p>{profileData.bio}</p>
              )}
            </div>
            
            <div className="profile-section">
              <h3>Skills</h3>
              {isEditing ? (
                <input
                  type="text"
                  name="skills"
                  value={Array.isArray(profileData.skills) ? profileData.skills.join(', ') : profileData.skills}
                  onChange={handleChange}
                  className="edit-input"
                  placeholder="Comma separated skills"
                />
              ) : (
                <div className="skills-list">
                  {(Array.isArray(profileData.skills) ? profileData.skills : []).map((skill, index) => (
                    <span key={index} className="skill-tag">{skill}</span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="profile-section">
              <h3>Contact Information</h3>
              <div className="contact-info">
                <div className="contact-item">
                  <strong>Email:</strong>
                  {isEditing ? (
                    <input
                      type="email"
                      name="email"
                      value={profileData.email}
                      onChange={handleChange}
                      className="edit-input"
                    />
                  ) : (
                    <span>{profileData.email}</span>
                  )}
                </div>
                
                <div className="contact-item">
                  <strong>Phone:</strong>
                  {isEditing ? (
                    <input
                      type="tel"
                      name="phone"
                      value={profileData.phone}
                      onChange={handleChange}
                      className="edit-input"
                    />
                  ) : (
                    <span>{profileData.phone}</span>
                  )}
                </div>
                
                <div className="contact-item">
                  <strong>Website:</strong>
                  {isEditing ? (
                    <input
                      type="url"
                      name="website"
                      value={profileData.website}
                      onChange={handleChange}
                      className="edit-input"
                    />
                  ) : (
                    <a href={profileData.website} target="_blank" rel="noopener noreferrer">
                      {profileData.website}
                    </a>
                  )}
                </div>
                
                {profileData.userType === 'freelancer' && (
                  <div className="contact-item">
                    <strong>Hourly Rate:</strong>
                    {isEditing ? (
                      <input
                        type="number"
                        name="hourlyRate"
                        value={profileData.hourlyRate}
                        onChange={handleChange}
                        className="edit-input"
                        placeholder="50"
                      />
                    ) : (
                      <span>${profileData.hourlyRate}/hr</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="profile-section">
              <h3>Work History</h3>
              {isEditing && (
                <button onClick={addWorkHistory} className="add-btn">Add Work Experience</button>
              )}
              <div className="work-history">
                {profileData.workHistory.map((work, index) => (
                  <div key={index} className="work-item">
                    {isEditing ? (
                      <div className="work-edit">
                        <input
                          type="text"
                          placeholder="Job Title"
                          value={work.title}
                          onChange={(e) => updateWorkHistory(index, 'title', e.target.value)}
                          className="edit-input"
                        />
                        <input
                          type="text"
                          placeholder="Company"
                          value={work.company}
                          onChange={(e) => updateWorkHistory(index, 'company', e.target.value)}
                          className="edit-input"
                        />
                        <input
                          type="text"
                          placeholder="Duration (e.g., Jan 2020 - Dec 2021)"
                          value={work.duration}
                          onChange={(e) => updateWorkHistory(index, 'duration', e.target.value)}
                          className="edit-input"
                        />
                        <textarea
                          placeholder="Job Description"
                          value={work.description}
                          onChange={(e) => updateWorkHistory(index, 'description', e.target.value)}
                          className="edit-textarea"
                          rows="3"
                        />
                        <button onClick={() => removeWorkHistory(index)} className="remove-btn">Remove</button>
                      </div>
                    ) : (
                      <div className="work-display">
                        <h4>{work.title}</h4>
                        <p className="work-company">{work.company}</p>
                        <p className="work-duration">{work.duration}</p>
                        <p className="work-description">{work.description}</p>
                      </div>
                    )}
                  </div>
                ))}
                {profileData.workHistory.length === 0 && !isEditing && (
                  <p>No work history added yet.</p>
                )}
              </div>
            </div>

            <div className="profile-section">
              <h3>Portfolio</h3>
              {isEditing && (
                <button onClick={addPortfolioItem} className="add-btn">Add Portfolio Item</button>
              )}
              <div className="portfolio-grid">
                {profileData.portfolio.map((item, index) => (
                  <div key={index} className="portfolio-item">
                    {isEditing ? (
                      <div className="portfolio-edit">
                        <input
                          type="text"
                          placeholder="Project Title"
                          value={item.title}
                          onChange={(e) => updatePortfolioItem(index, 'title', e.target.value)}
                          className="edit-input"
                        />
                        <input
                          type="url"
                          placeholder="Image URL"
                          value={item.imageUrl}
                          onChange={(e) => updatePortfolioItem(index, 'imageUrl', e.target.value)}
                          className="edit-input"
                        />
                        <input
                          type="url"
                          placeholder="Project URL"
                          value={item.projectUrl}
                          onChange={(e) => updatePortfolioItem(index, 'projectUrl', e.target.value)}
                          className="edit-input"
                        />
                        <input
                          type="text"
                          placeholder="Technologies (comma separated)"
                          value={Array.isArray(item.technologies) ? item.technologies.join(', ') : item.technologies}
                          onChange={(e) => updatePortfolioItem(index, 'technologies', e.target.value)}
                          className="edit-input"
                        />
                        <textarea
                          placeholder="Project Description"
                          value={item.description}
                          onChange={(e) => updatePortfolioItem(index, 'description', e.target.value)}
                          className="edit-textarea"
                          rows="3"
                        />
                        <button onClick={() => removePortfolioItem(index)} className="remove-btn">Remove</button>
                      </div>
                    ) : (
                      <div className="portfolio-display">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="portfolio-image" />
                        ) : (
                          <div className="portfolio-placeholder">{item.title || 'Project'}</div>
                        )}
                        <h4>{item.title}</h4>
                        <p className="portfolio-description">{item.description}</p>
                        {item.technologies && item.technologies.length > 0 && (
                          <div className="portfolio-technologies">
                            {item.technologies.map((tech, techIndex) => (
                              <span key={techIndex} className="tech-tag">{tech}</span>
                            ))}
                          </div>
                        )}
                        {item.projectUrl && (
                          <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" className="portfolio-link">
                            View Project
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {profileData.portfolio.length === 0 && !isEditing && (
                  <p>No portfolio items added yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
