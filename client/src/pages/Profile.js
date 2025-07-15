import React, { useState } from 'react';

function Profile() {
  const [userType, setUserType] = useState('freelancer');
  const [profileData, setProfileData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    location: 'New York, NY',
    bio: 'Experienced full-stack developer with 5+ years of experience in React, Node.js, and MongoDB.',
    skills: 'React, Node.js, MongoDB, JavaScript, TypeScript, Python',
    hourlyRate: 75,
    availability: 'full-time',
    portfolio: '',
    experience: [
      {
        id: 1,
        title: 'Senior Full-Stack Developer',
        company: 'Tech Solutions Inc.',
        duration: '2021 - Present',
        description: 'Lead development of web applications using React and Node.js'
      }
    ]
  });

  const [isEditing, setIsEditing] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = () => {
    console.log('Profile saved:', profileData);
    setIsEditing(false);
    alert('Profile updated successfully!');
  };

  const addExperience = () => {
    const newExperience = {
      id: Date.now(),
      title: '',
      company: '',
      duration: '',
      description: ''
    };
    setProfileData(prev => ({
      ...prev,
      experience: [...prev.experience, newExperience]
    }));
  };

  const updateExperience = (id, field, value) => {
    setProfileData(prev => ({
      ...prev,
      experience: prev.experience.map(exp => 
        exp.id === id ? { ...exp, [field]: value } : exp
      )
    }));
  };

  const removeExperience = (id) => {
    setProfileData(prev => ({
      ...prev,
      experience: prev.experience.filter(exp => exp.id !== id)
    }));
  };

  return (
    <div className="profile-page">
      <div className="page-container">
        <div className="profile-header">
          <h1>My Profile</h1>
          <div className="profile-actions">
            {!isEditing ? (
              <button className="btn" onClick={() => setIsEditing(true)}>
                Edit Profile
              </button>
            ) : (
              <div>
                <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button className="btn" onClick={handleSave}>
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="profile-type-toggle">
          <button 
            className={userType === 'freelancer' ? 'active' : ''}
            onClick={() => setUserType('freelancer')}
          >
            Freelancer Profile
          </button>
          <button 
            className={userType === 'client' ? 'active' : ''}
            onClick={() => setUserType('client')}
          >
            Client Profile
          </button>
        </div>

        <div className="profile-content">
          <div className="profile-section card">
            <h2>Basic Information</h2>
            <div className="profile-avatar">
              <div className="avatar-placeholder">
                <span>👤</span>
              </div>
              {isEditing && (
                <button className="btn btn-secondary">Upload Photo</button>
              )}
            </div>
            
            <div className="form-grid grid grid-2">
              <div className="form-group">
                <label>First Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="firstName"
                    value={profileData.firstName}
                    onChange={handleInputChange}
                  />
                ) : (
                  <p>{profileData.firstName}</p>
                )}
              </div>
              
              <div className="form-group">
                <label>Last Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="lastName"
                    value={profileData.lastName}
                    onChange={handleInputChange}
                  />
                ) : (
                  <p>{profileData.lastName}</p>
                )}
              </div>
              
              <div className="form-group">
                <label>Email</label>
                {isEditing ? (
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    onChange={handleInputChange}
                  />
                ) : (
                  <p>{profileData.email}</p>
                )}
              </div>
              
              <div className="form-group">
                <label>Phone</label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={profileData.phone}
                    onChange={handleInputChange}
                  />
                ) : (
                  <p>{profileData.phone}</p>
                )}
              </div>
              
              <div className="form-group">
                <label>Location</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="location"
                    value={profileData.location}
                    onChange={handleInputChange}
                  />
                ) : (
                  <p>{profileData.location}</p>
                )}
              </div>
            </div>
          </div>

          <div className="profile-section card">
            <h2>Professional Information</h2>
            
            <div className="form-group">
              <label>Bio</label>
              {isEditing ? (
                <textarea
                  name="bio"
                  value={profileData.bio}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Tell clients about your experience and expertise..."
                />
              ) : (
                <p>{profileData.bio}</p>
              )}
            </div>

            {userType === 'freelancer' && (
              <>
                <div className="form-group">
                  <label>Skills</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="skills"
                      value={profileData.skills}
                      onChange={handleInputChange}
                      placeholder="React, Node.js, MongoDB (comma separated)"
                    />
                  ) : (
                    <div className="skills-display">
                      {profileData.skills.split(',').map((skill, index) => (
                        <span key={index} className="skill-tag">{skill.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-grid grid grid-2">
                  <div className="form-group">
                    <label>Hourly Rate ($)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        name="hourlyRate"
                        value={profileData.hourlyRate}
                        onChange={handleInputChange}
                        min="1"
                      />
                    ) : (
                      <p>${profileData.hourlyRate}/hour</p>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label>Availability</label>
                    {isEditing ? (
                      <select
                        name="availability"
                        value={profileData.availability}
                        onChange={handleInputChange}
                      >
                        <option value="full-time">Full-time</option>
                        <option value="part-time">Part-time</option>
                        <option value="project-based">Project-based</option>
                      </select>
                    ) : (
                      <p>{profileData.availability}</p>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Portfolio URL</label>
                  {isEditing ? (
                    <input
                      type="url"
                      name="portfolio"
                      value={profileData.portfolio}
                      onChange={handleInputChange}
                      placeholder="https://yourportfolio.com"
                    />
                  ) : (
                    <p>{profileData.portfolio || 'No portfolio URL provided'}</p>
                  )}
                </div>
              </>
            )}
          </div>

          {userType === 'freelancer' && (
            <div className="profile-section card">
              <div className="section-header">
                <h2>Work Experience</h2>
                {isEditing && (
                  <button className="btn btn-secondary" onClick={addExperience}>
                    Add Experience
                  </button>
                )}
              </div>
              
              {profileData.experience.map(exp => (
                <div key={exp.id} className="experience-item">
                  {isEditing ? (
                    <div className="experience-form">
                      <div className="form-grid grid grid-2">
                        <input
                          type="text"
                          placeholder="Job Title"
                          value={exp.title}
                          onChange={(e) => updateExperience(exp.id, 'title', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Company"
                          value={exp.company}
                          onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Duration (e.g., 2021 - Present)"
                        value={exp.duration}
                        onChange={(e) => updateExperience(exp.id, 'duration', e.target.value)}
                      />
                      <textarea
                        placeholder="Job description..."
                        value={exp.description}
                        onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                        rows="3"
                      />
                      <button 
                        className="btn btn-secondary"
                        onClick={() => removeExperience(exp.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="experience-display">
                      <h4>{exp.title}</h4>
                      <p className="company">{exp.company}</p>
                      <p className="duration">{exp.duration}</p>
                      <p className="description">{exp.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
