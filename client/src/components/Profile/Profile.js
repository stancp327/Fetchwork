import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Profile.css';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.profile?.firstName || '',
    lastName: user?.profile?.lastName || '',
    bio: user?.profile?.bio || '',
    skills: user?.profile?.skills?.join(', ') || '',
    location: user?.profile?.location || '',
    hourlyRate: user?.profile?.hourlyRate || '',
    experience: user?.profile?.experience || 'intermediate'
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const profileData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      bio: formData.bio,
      location: formData.location,
      skills: formData.skills
    };

    if (user?.userType === 'freelancer') {
      profileData.hourlyRate = formData.hourlyRate;
      profileData.experience = formData.experience;
    }

    const result = await updateProfile(profileData);
    
    if (result.success) {
      setIsEditing(false);
    } else {
      alert(result.message || 'Failed to update profile');
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.profile?.firstName || '',
      lastName: user?.profile?.lastName || '',
      bio: user?.profile?.bio || '',
      skills: user?.profile?.skills?.join(', ') || '',
      location: user?.profile?.location || '',
      hourlyRate: user?.profile?.hourlyRate || '',
      experience: user?.profile?.experience || 'intermediate'
    });
    setIsEditing(false);
  };

  return (
    <div className="profile">
      <div className="profile-header">
        <div className="profile-avatar">
          <div className="avatar-placeholder">
            {user?.profile?.firstName?.[0]}{user?.profile?.lastName?.[0]}
          </div>
          <button className="change-photo-btn">Change Photo</button>
        </div>
        
        <div className="profile-info">
          <h1>{user?.profile?.firstName} {user?.profile?.lastName}</h1>
          <p className="user-type">{user?.userType === 'freelancer' ? 'Freelancer' : 'Client'}</p>
          <p className="user-email">{user?.email}</p>
          
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="edit-profile-btn">
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="profile-content">
        {isEditing ? (
          <form onSubmit={handleSubmit} className="profile-form">
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
                    onChange={handleChange}
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
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="City, Country"
                />
              </div>

              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Tell us about yourself and your experience..."
                />
              </div>
            </div>

            {user?.userType === 'freelancer' && (
              <div className="form-section">
                <h3>Professional Information</h3>
                
                <div className="form-group">
                  <label htmlFor="skills">Skills</label>
                  <input
                    type="text"
                    id="skills"
                    name="skills"
                    value={formData.skills}
                    onChange={handleChange}
                    placeholder="e.g. React, Node.js, Design, Writing (comma separated)"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="hourlyRate">Hourly Rate ($)</label>
                    <input
                      type="number"
                      id="hourlyRate"
                      name="hourlyRate"
                      value={formData.hourlyRate}
                      onChange={handleChange}
                      placeholder="25"
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="experience">Experience Level</label>
                    <select
                      id="experience"
                      name="experience"
                      value={formData.experience}
                      onChange={handleChange}
                    >
                      <option value="entry">Entry Level</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="save-btn">Save Changes</button>
              <button type="button" onClick={handleCancel} className="cancel-btn">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-display">
            <div className="profile-section">
              <h3>About</h3>
              <p className="bio-text">
                {user?.profile?.bio || 'No bio added yet. Click "Edit Profile" to add information about yourself.'}
              </p>
            </div>

            {user?.userType === 'freelancer' && (
              <>
                <div className="profile-section">
                  <h3>Skills</h3>
                  <div className="skills-list">
                    {user?.profile?.skills?.length > 0 ? (
                      user.profile.skills.map(skill => (
                        <span key={skill} className="skill-tag">{skill}</span>
                      ))
                    ) : (
                      <p className="no-data">No skills added yet.</p>
                    )}
                  </div>
                </div>

                <div className="profile-section">
                  <h3>Professional Details</h3>
                  <div className="details-grid">
                    <div className="detail-item">
                      <strong>Hourly Rate:</strong>
                      <span>${user?.profile?.hourlyRate || 'Not set'}/hour</span>
                    </div>
                    <div className="detail-item">
                      <strong>Experience:</strong>
                      <span>{user?.profile?.experience || 'Not specified'}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Location:</strong>
                      <span>{user?.profile?.location || 'Not specified'}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="profile-section">
              <h3>Statistics</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-number">12</div>
                  <div className="stat-label">
                    {user?.userType === 'freelancer' ? 'Projects Completed' : 'Jobs Posted'}
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">4.8★</div>
                  <div className="stat-label">Average Rating</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">98%</div>
                  <div className="stat-label">Success Rate</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
