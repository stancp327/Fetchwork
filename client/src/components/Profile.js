import React, { useState } from 'react';
import Navigation from './Navigation';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    bio: 'Experienced freelancer specializing in web development and design.',
    skills: 'React, Node.js, MongoDB, UI/UX Design',
    hourlyRate: '$50',
    location: 'New York, NY',
    phone: '+1 (555) 123-4567',
    website: 'https://portfolio.example.com'
  });

  const handleChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = () => {
    console.log('Profile updated:', profileData);
    setIsEditing(false);
    alert('Profile updated successfully!');
  };

  return (
    <div>
      <Navigation />
      <div className="page-container">
        <div className="profile">
          <div className="profile-header">
            <div className="profile-avatar">
              <div className="avatar-placeholder">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="profile-info">
              <h1>{profileData.name}</h1>
              <p className="user-type">{user?.userType}</p>
              <p className="location">📍 {profileData.location}</p>
            </div>
            <div className="profile-actions">
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="edit-btn">
                  Edit Profile
                </button>
              ) : (
                <div className="edit-actions">
                  <button onClick={handleSave} className="save-btn">Save</button>
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
                  value={profileData.skills}
                  onChange={handleChange}
                  className="edit-input"
                  placeholder="Comma separated skills"
                />
              ) : (
                <div className="skills-list">
                  {profileData.skills.split(',').map((skill, index) => (
                    <span key={index} className="skill-tag">{skill.trim()}</span>
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
                
                <div className="contact-item">
                  <strong>Hourly Rate:</strong>
                  {isEditing ? (
                    <input
                      type="text"
                      name="hourlyRate"
                      value={profileData.hourlyRate}
                      onChange={handleChange}
                      className="edit-input"
                    />
                  ) : (
                    <span>{profileData.hourlyRate}</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="profile-section">
              <h3>Portfolio</h3>
              <div className="portfolio-grid">
                <div className="portfolio-item">
                  <div className="portfolio-placeholder">Project 1</div>
                  <p>E-commerce Website</p>
                </div>
                <div className="portfolio-item">
                  <div className="portfolio-placeholder">Project 2</div>
                  <p>Mobile App Design</p>
                </div>
                <div className="portfolio-item">
                  <div className="portfolio-placeholder">Project 3</div>
                  <p>Brand Identity</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
