import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../UserComponents.css';

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://fetchwork-1.onrender.com';
};

const PostJob = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    subcategory: '',
    skills: '',
    budgetType: 'fixed',
    budgetAmount: '',
    currency: 'USD',
    duration: '',
    experienceLevel: '',
    location: 'Remote',
    isRemote: true,
    isUrgent: false
  });
  const [errors, setErrors] = useState({});

  const apiBaseUrl = getApiBaseUrl();

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Job title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title cannot exceed 100 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Job description is required';
    } else if (formData.description.length > 5000) {
      newErrors.description = 'Description cannot exceed 5000 characters';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.budgetAmount || parseFloat(formData.budgetAmount) < 1) {
      newErrors.budgetAmount = 'Budget must be at least $1';
    }

    if (!formData.duration) {
      newErrors.duration = 'Duration is required';
    }

    if (!formData.experienceLevel) {
      newErrors.experienceLevel = 'Experience level is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const skillsArray = formData.skills
        .split(',')
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);

      const jobData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        subcategory: formData.subcategory.trim() || undefined,
        skills: skillsArray,
        budget: {
          type: formData.budgetType,
          amount: parseFloat(formData.budgetAmount),
          currency: formData.currency
        },
        duration: formData.duration,
        experienceLevel: formData.experienceLevel,
        location: formData.location.trim(),
        isRemote: formData.isRemote,
        isUrgent: formData.isUrgent
      };

      const token = localStorage.getItem('token');
      await axios.post(`${apiBaseUrl}/api/jobs`, jobData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/browse-jobs');
      }, 2000);

    } catch (error) {
      console.error('Failed to post job:', error);
      setError(error.response?.data?.error || 'Failed to post job');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="user-container">
        <div className="success">
          <h3>Job Posted Successfully!</h3>
          <p>Your job has been posted and is now live. Redirecting to browse jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-container">
      <div className="user-header">
        <h1>Post a Job</h1>
        <p>Find the perfect freelancer for your project</p>
      </div>

      <div className="main-content">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Job Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g. Build a responsive website"
              maxLength={100}
            />
            {errors.title && <div className="error-text">{errors.title}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="description">Job Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe your project in detail..."
              rows={8}
              maxLength={5000}
            />
            <div style={{ fontSize: '0.8rem', color: '#6c757d', textAlign: 'right' }}>
              {formData.description.length}/5000 characters
            </div>
            {errors.description && <div className="error-text">{errors.description}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
            >
              <option value="">Select a category</option>
              <option value="web_development">Web Development</option>
              <option value="mobile_development">Mobile Development</option>
              <option value="design">Design</option>
              <option value="writing">Writing</option>
              <option value="marketing">Marketing</option>
              <option value="data_entry">Data Entry</option>
              <option value="customer_service">Customer Service</option>
              <option value="translation">Translation</option>
              <option value="video_editing">Video Editing</option>
              <option value="photography">Photography</option>
              <option value="consulting">Consulting</option>
              <option value="other">Other</option>
            </select>
            {errors.category && <div className="error-text">{errors.category}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="subcategory">Subcategory</label>
            <input
              type="text"
              id="subcategory"
              name="subcategory"
              value={formData.subcategory}
              onChange={handleInputChange}
              placeholder="e.g. React Development, Logo Design"
            />
          </div>

          <div className="form-group">
            <label htmlFor="skills">Required Skills</label>
            <input
              type="text"
              id="skills"
              name="skills"
              value={formData.skills}
              onChange={handleInputChange}
              placeholder="e.g. JavaScript, React, Node.js (comma separated)"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label htmlFor="budgetType">Budget Type *</label>
              <select
                id="budgetType"
                name="budgetType"
                value={formData.budgetType}
                onChange={handleInputChange}
              >
                <option value="fixed">Fixed Price</option>
                <option value="hourly">Hourly Rate</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="budgetAmount">
                Budget Amount * ({formData.budgetType === 'hourly' ? 'per hour' : 'total'})
              </label>
              <input
                type="number"
                id="budgetAmount"
                name="budgetAmount"
                value={formData.budgetAmount}
                onChange={handleInputChange}
                placeholder="0"
                min="1"
                step="0.01"
              />
              {errors.budgetAmount && <div className="error-text">{errors.budgetAmount}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="currency">Currency</label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="duration">Project Duration *</label>
            <select
              id="duration"
              name="duration"
              value={formData.duration}
              onChange={handleInputChange}
            >
              <option value="">Select duration</option>
              <option value="less_than_1_week">Less than 1 week</option>
              <option value="1_2_weeks">1-2 weeks</option>
              <option value="1_month">1 month</option>
              <option value="2_3_months">2-3 months</option>
              <option value="3_6_months">3-6 months</option>
              <option value="more_than_6_months">More than 6 months</option>
            </select>
            {errors.duration && <div className="error-text">{errors.duration}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="experienceLevel">Experience Level Required *</label>
            <select
              id="experienceLevel"
              name="experienceLevel"
              value={formData.experienceLevel}
              onChange={handleInputChange}
            >
              <option value="">Select experience level</option>
              <option value="entry">Entry Level</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
            {errors.experienceLevel && <div className="error-text">{errors.experienceLevel}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="e.g. New York, NY or Remote"
            />
          </div>

          <div className="checkbox-group">
            <input
              type="checkbox"
              id="isRemote"
              name="isRemote"
              checked={formData.isRemote}
              onChange={handleInputChange}
            />
            <label htmlFor="isRemote">This is a remote job</label>
          </div>

          <div className="checkbox-group">
            <input
              type="checkbox"
              id="isUrgent"
              name="isUrgent"
              checked={formData.isUrgent}
              onChange={handleInputChange}
            />
            <label htmlFor="isUrgent">This is an urgent job</label>
          </div>

          {error && <div className="error">{error}</div>}

          <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Posting Job...' : 'Post Job'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostJob;
