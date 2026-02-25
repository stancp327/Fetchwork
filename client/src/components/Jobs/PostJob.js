import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../../utils/api';
import { CATEGORIES } from '../../utils/categories';
import './PostJob.css';

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
    budgetMax: '',
    currency: 'USD',
    duration: '',
    experienceLevel: '',
    locationType: 'remote',
    city: '',
    state: '',
    zipCode: '',
    deadline: '',
    scheduledDate: '',
    cancellationPolicy: 'flexible',
    isUrgent: false
  });
  const [errors, setErrors] = useState({});

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

    if (formData.budgetType === 'range') {
      if (!formData.budgetMax || parseFloat(formData.budgetMax) < 1) {
        newErrors.budgetMax = 'Max budget is required for range pricing';
      } else if (parseFloat(formData.budgetMax) <= parseFloat(formData.budgetAmount)) {
        newErrors.budgetMax = 'Max budget must be greater than min budget';
      }
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
          maxAmount: formData.budgetType === 'range' && formData.budgetMax ? parseFloat(formData.budgetMax) : undefined,
          currency: formData.currency
        },
        duration: formData.duration,
        experienceLevel: formData.experienceLevel,
        location: {
          locationType: formData.locationType,
          city: formData.city.trim(),
          state: formData.state.trim(),
          zipCode: formData.zipCode.trim(),
          address: formData.city && formData.state ? `${formData.city.trim()}, ${formData.state.trim()}` : '',
          coordinates: { type: 'Point', coordinates: [0, 0] },
          serviceRadius: 25
        },
        deadline: formData.deadline || null,
        scheduledDate: formData.scheduledDate || null,
        cancellationPolicy: formData.locationType !== 'remote' ? formData.cancellationPolicy : 'flexible',
        isUrgent: formData.isUrgent
      };

      const token = localStorage.getItem('token');
      await axios.post(`${getApiBaseUrl()}/api/jobs`, jobData, {
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
      <div className="post-job-success">
        <h3>✅ Job Posted Successfully!</h3>
        <p>Your job is now live. Redirecting to browse jobs...</p>
      </div>
    );
  }

  return (
    <div className="post-job-page">
      <div className="post-job-header">
        <h1>Post a Job</h1>
        <p>Find the perfect freelancer for your project</p>
      </div>

      <div className="post-job-form">
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-section-title">Job Details</div>

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
                rows={6}
                maxLength={5000}
              />
              <div className="char-count">
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
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                ))}
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
          </div>

          <div className="form-section">
            <div className="form-section-title">Budget & Timeline</div>

            <div className="post-job-grid-3">
              <div className="form-group">
                <label htmlFor="budgetType">Budget Type *</label>
                <select
                  id="budgetType"
                  name="budgetType"
                  value={formData.budgetType}
                  onChange={handleInputChange}
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="range">Budget Range</option>
                  <option value="hourly">Hourly Rate</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="budgetAmount">
                  {formData.budgetType === 'range' ? 'Min Budget *' : `Amount * (${formData.budgetType === 'hourly' ? '/hr' : 'total'})`}
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

              {formData.budgetType === 'range' && (
                <div className="form-group">
                  <label htmlFor="budgetMax">Max Budget *</label>
                  <input
                    type="number"
                    id="budgetMax"
                    name="budgetMax"
                    value={formData.budgetMax}
                    onChange={handleInputChange}
                    placeholder="0"
                    min={formData.budgetAmount || 1}
                    step="0.01"
                  />
                  {errors.budgetMax && <div className="error-text">{errors.budgetMax}</div>}
                </div>
              )}

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
              <label htmlFor="experienceLevel">Experience Level *</label>
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
              <label htmlFor="deadline">Deadline (optional)</label>
              <input
                type="date"
                id="deadline"
                name="deadline"
                value={formData.deadline}
                onChange={handleInputChange}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Location</div>

            <div className="form-group">
              <label htmlFor="locationType">Work Type</label>
              <select
                id="locationType"
                name="locationType"
                value={formData.locationType}
                onChange={handleInputChange}
              >
                <option value="remote">🌐 Remote</option>
                <option value="local">📍 Local / On-site</option>
                <option value="hybrid">🔄 Hybrid</option>
              </select>
            </div>

            {formData.locationType !== 'remote' && (
              <div className="post-job-grid-location">
                <div className="form-group">
                  <label htmlFor="city">City</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="e.g. Concord"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="state">State</label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="CA"
                    maxLength={2}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="zipCode">Zip Code</label>
                  <input
                    type="text"
                    id="zipCode"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleInputChange}
                    placeholder="94520"
                    maxLength={10}
                  />
                </div>
              </div>
            )}
          </div>

          {formData.locationType !== 'remote' && (
            <div className="form-section">
              <div className="form-section-title">📅 Scheduling & Cancellation</div>

              <div className="form-group">
                <label htmlFor="scheduledDate">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  id="scheduledDate"
                  name="scheduledDate"
                  value={formData.scheduledDate}
                  onChange={handleInputChange}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <span className="field-hint">When the freelancer should arrive on-site</span>
              </div>

              <div className="form-group">
                <label htmlFor="cancellationPolicy">Cancellation Policy</label>
                <select
                  id="cancellationPolicy"
                  name="cancellationPolicy"
                  value={formData.cancellationPolicy}
                  onChange={handleInputChange}
                >
                  <option value="flexible">🟢 Flexible — Cancel anytime, no fee</option>
                  <option value="moderate">🟡 Moderate — Free cancellation 1hr+ before, 10% fee under 1hr</option>
                  <option value="strict">🔴 Strict — Free 24hr+ before, 25% under 24hr, 50% under 1hr</option>
                </select>
              </div>
            </div>
          )}

          <div className="post-job-checkbox">
            <input
              type="checkbox"
              id="isUrgent"
              name="isUrgent"
              checked={formData.isUrgent}
              onChange={handleInputChange}
            />
            <label htmlFor="isUrgent">⚡ This is an urgent job</label>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <div className="post-job-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Posting...' : 'Post Job'}
            </button>
            <button
              type="button"
              className="btn-secondary"
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
