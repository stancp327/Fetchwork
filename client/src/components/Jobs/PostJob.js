import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import CategoryCombobox from '../common/CategoryCombobox';
import UpgradePrompt from '../Billing/UpgradePrompt';
import './PostJob.css';
import SEO from '../common/SEO';

const PostJob = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [upgradeLimit, setUpgradeLimit] = useState(null); // { reason, limit }
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
    isUrgent: false,
    recurringEnabled:  false,
    recurringInterval: 'monthly',
    recurringEndDate:  '',
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
        isUrgent: formData.isUrgent,
        recurring: formData.recurringEnabled ? {
          enabled:  true,
          interval: formData.recurringInterval,
          endDate:  formData.recurringEndDate || null,
          nextRunDate: null, // set server-side on job completion
        } : { enabled: false },
      };

      await apiRequest('/api/jobs', { method: 'POST', body: JSON.stringify(jobData) });
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/browse-jobs');
      }, 2000);

    } catch (error) {
      console.error('Failed to post job:', error);
      const data = error.data;
      if (data?.reason === 'job_limit') {
        setUpgradeLimit({ reason: 'job_limit', limit: data.limit });
      } else {
        setError(data?.error || error.message || 'Failed to post job');
      }
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
      <SEO title="Post a Job" path="/post-job" noIndex={true} />
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
              <CategoryCombobox
                value={formData.category}
                onChange={v => {
                  setFormData(prev => ({ ...prev, category: v }));
                  if (errors.category) setErrors(prev => ({ ...prev, category: '' }));
                }}
                placeholder="Select a category"
                required
              />
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
            <div className="form-section-title">Where is the work done?</div>

            {/* Visual work-type card selector */}
            <div className="work-type-cards">
              {[
                { value: 'remote', icon: '🌐', label: 'Remote', desc: 'Done online, anywhere' },
                { value: 'local', icon: '📍', label: 'Local / On-site', desc: 'Freelancer comes to you' },
                { value: 'hybrid', icon: '🔄', label: 'Hybrid', desc: 'Mix of remote + on-site' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`work-type-card ${formData.locationType === opt.value ? 'selected' : ''}`}
                  onClick={() => handleInputChange({ target: { name: 'locationType', value: opt.value } })}
                >
                  <span className="work-type-icon">{opt.icon}</span>
                  <span className="work-type-label">{opt.label}</span>
                  <span className="work-type-desc">{opt.desc}</span>
                </button>
              ))}
            </div>

            {/* Remote: nothing extra needed */}
            {formData.locationType === 'remote' && (
              <div className="location-info-banner">
                🌐 Great — freelancers worldwide can apply. No location details needed.
              </div>
            )}

            {/* Local / Hybrid: show address fields */}
            {formData.locationType !== 'remote' && (
              <>
                <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
                  📍 Let freelancers know where the work takes place so they can assess travel.
                </p>
                <div className="post-job-grid-location">
                  <div className="form-group">
                    <label htmlFor="city">City *</label>
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
                    <label htmlFor="state">State *</label>
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
              </>
            )}
          </div>

          {/* Scheduling — only for local/hybrid */}
          {formData.locationType !== 'remote' && (
            <div className="form-section">
              <div className="form-section-title">📅 Scheduling</div>
              <div className="form-group">
                <label htmlFor="scheduledDate">When do you need them? <span className="label-optional">(optional)</span></label>
                <input
                  type="datetime-local"
                  id="scheduledDate"
                  name="scheduledDate"
                  value={formData.scheduledDate}
                  onChange={handleInputChange}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <span className="field-hint">Leave blank if you're flexible on timing</span>
              </div>

              <div className="form-group">
                <label htmlFor="cancellationPolicy">Cancellation Policy</label>
                <div className="cancellation-cards">
                  {[
                    { value: 'flexible', icon: '🟢', label: 'Flexible', desc: 'Cancel anytime, no fee' },
                    { value: 'moderate', icon: '🟡', label: 'Moderate', desc: '10% fee if cancelled under 1 hour before' },
                    { value: 'strict', icon: '🔴', label: 'Strict', desc: '25–50% fee depending on notice given' },
                  ].map(p => (
                    <button
                      key={p.value}
                      type="button"
                      className={`cancellation-card ${formData.cancellationPolicy === p.value ? 'selected' : ''}`}
                      onClick={() => handleInputChange({ target: { name: 'cancellationPolicy', value: p.value } })}
                    >
                      <span>{p.icon} <strong>{p.label}</strong></span>
                      <span className="cancellation-desc">{p.desc}</span>
                    </button>
                  ))}
                </div>
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

          <div className="post-job-checkbox">
            <input
              type="checkbox"
              id="recurringEnabled"
              name="recurringEnabled"
              checked={formData.recurringEnabled}
              onChange={handleInputChange}
            />
            <label htmlFor="recurringEnabled">♻️ Make this a recurring job</label>
          </div>

          {formData.recurringEnabled && (
            <div className="post-job-recurring">
              <div className="form-group">
                <label className="form-label">Repeat every</label>
                <select
                  name="recurringInterval"
                  value={formData.recurringInterval}
                  onChange={handleInputChange}
                  className="form-input"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">End date (optional)</label>
                <input
                  type="date"
                  name="recurringEndDate"
                  value={formData.recurringEndDate}
                  onChange={handleInputChange}
                  className="form-input"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <p className="post-job-recurring-hint">
                After each job completes, a new one will be posted automatically and your previous freelancer will get first look.
              </p>
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}
          {upgradeLimit && (
            <UpgradePrompt
              inline
              reason={upgradeLimit.reason}
              limit={upgradeLimit.limit}
              onDismiss={() => setUpgradeLimit(null)}
            />
          )}

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


