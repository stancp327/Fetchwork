import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Jobs.css';

const PostJob = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Web Development',
    budget: '',
    budgetType: 'fixed',
    skills: '',
    duration: 'less-than-1-month',
    experienceLevel: 'intermediate',
    locationType: 'remote',
    location: {
      address: '',
      city: '',
      state: '',
      zipCode: ''
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const categories = [
    'Web Development',
    'Mobile Development', 
    'Design',
    'Writing',
    'Data Science',
    'Marketing',
    'Video & Animation',
    'Music & Audio',
    'Programming & Tech',
    'Business',
    'Home Improvement',
    'Cleaning',
    'Moving',
    'Tutoring',
    'Personal Care',
    'Event Services',
    'Automotive',
    'Pet Services'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('location.')) {
      const locationField = name.split('.')[1];
      setFormData({
        ...formData,
        location: {
          ...formData.location,
          [locationField]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:10000'
        : 'https://user:31bfdb3e3b3497d64ac61e2dd563996c@fetchwork-verification-app-tunnel-guxp61eo.devinapps.com';

      const response = await fetch(`${API_BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          budget: {
            amount: parseFloat(formData.budget),
            type: formData.budgetType
          },
          skills: formData.skills ? formData.skills.split(',').map(skill => skill.trim()).filter(skill => skill) : [],
          duration: formData.duration,
          experienceLevel: formData.experienceLevel,
          locationType: formData.locationType,
          location: formData.locationType === 'local' ? formData.location : {}
        })
      });

      if (response.ok) {
        setIsSubmitting(false);
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setFormData({
            title: '',
            description: '',
            category: 'Web Development',
            budget: '',
            budgetType: 'fixed',
            skills: '',
            duration: 'less-than-1-month',
            experienceLevel: 'intermediate',
            locationType: 'remote',
            location: {
              address: '',
              city: '',
              state: '',
              zipCode: ''
            }
          });
        }, 3000);
      } else {
        const errorData = await response.json();
        setIsSubmitting(false);
        alert(errorData.message || 'Failed to post job');
      }
    } catch (error) {
      setIsSubmitting(false);
      alert('Error posting job: ' + error.message);
    }
  };

  // if (user?.userType !== 'client') {
  //   return (
  //     <div className="post-job">
  //       <div className="access-denied">
  //         <h2>Access Restricted</h2>
  //         <p>Only clients can post jobs. Switch to a client account to access this feature.</p>
  //       </div>
  //     </div>
  //   );
  // }

  if (success) {
    return (
      <div className="post-job">
        <div className="success-message">
          <div className="success-icon">✅</div>
          <h2>Job Posted Successfully!</h2>
          <p>Your job has been published and freelancers can now apply.</p>
          <button onClick={() => setSuccess(false)} className="post-another-btn">
            Post Another Job
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="post-job">
      <div className="post-job-header">
        <h1>Post a New Job</h1>
        <p>Find the perfect freelancer for your project</p>
      </div>

      <form onSubmit={handleSubmit} className="post-job-form">
        <div className="form-section">
          <h3>Job Details</h3>
          
          <div className="form-group">
            <label htmlFor="title">Job Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g. Build a responsive website with React"
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Job Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows="6"
              placeholder="Describe your project in detail. Include requirements, deliverables, and any specific instructions..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="skills">Required Skills</label>
            <input
              type="text"
              id="skills"
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              placeholder="e.g. React, Node.js, MongoDB (comma separated)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="locationType">Job Type *</label>
            <select
              id="locationType"
              name="locationType"
              value={formData.locationType}
              onChange={handleChange}
              required
            >
              <option value="remote">Remote</option>
              <option value="local">Local/On-site</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>

          {formData.locationType === 'local' && (
            <div className="location-fields">
              <h4>Location Details</h4>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="location.address">Address</label>
                  <input
                    type="text"
                    id="location.address"
                    name="location.address"
                    value={formData.location.address}
                    onChange={handleChange}
                    placeholder="Street address"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="location.city">City *</label>
                  <input
                    type="text"
                    id="location.city"
                    name="location.city"
                    value={formData.location.city}
                    onChange={handleChange}
                    placeholder="City"
                    required={formData.locationType === 'local'}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="location.state">State *</label>
                  <input
                    type="text"
                    id="location.state"
                    name="location.state"
                    value={formData.location.state}
                    onChange={handleChange}
                    placeholder="State"
                    required={formData.locationType === 'local'}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="location.zipCode">ZIP Code</label>
                  <input
                    type="text"
                    id="location.zipCode"
                    name="location.zipCode"
                    value={formData.location.zipCode}
                    onChange={handleChange}
                    placeholder="ZIP Code"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="form-section">
          <h3>Budget & Timeline</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="budgetType">Budget Type *</label>
              <select
                id="budgetType"
                name="budgetType"
                value={formData.budgetType}
                onChange={handleChange}
                required
              >
                <option value="fixed">Fixed Price</option>
                <option value="hourly">Hourly Rate</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="budget">
                {formData.budgetType === 'fixed' ? 'Project Budget ($)' : 'Hourly Rate ($)'} *
              </label>
              <input
                type="number"
                id="budget"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                required
                placeholder={formData.budgetType === 'fixed' ? '1000' : '25'}
                min="1"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="duration">Project Duration *</label>
              <select
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                required
              >
                <option value="less-than-1-month">Less than 1 month</option>
                <option value="1-3-months">1-3 months</option>
                <option value="3-6-months">3-6 months</option>
                <option value="more-than-6-months">More than 6 months</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="experienceLevel">Experience Level *</label>
              <select
                id="experienceLevel"
                name="experienceLevel"
                value={formData.experienceLevel}
                onChange={handleChange}
                required
              >
                <option value="entry">Entry Level</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={isSubmitting} className="submit-job-btn">
            {isSubmitting ? 'Posting Job...' : 'Post Job'}
          </button>
          <button type="button" className="save-draft-btn">
            Save as Draft
          </button>
        </div>
      </form>
    </div>
  );
};

export default PostJob;
