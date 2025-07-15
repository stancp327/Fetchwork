import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import jobService from '../services/jobService';

function PostJob() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    budget: '',
    budgetType: 'fixed',
    deadline: '',
    skills: '',
    attachments: null
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const categories = [
    'Design & Creative',
    'Development & IT',
    'Writing & Translation',
    'Digital Marketing',
    'Video & Animation',
    'Music & Audio',
    'Business',
    'Data',
    'Photography'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({
      ...prev,
      attachments: e.target.files
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Job title is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Job description is required';
    }
    
    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }
    
    if (!formData.budget || formData.budget <= 0) {
      newErrors.budget = 'Please enter a valid budget';
    }
    
    if (!formData.deadline) {
      newErrors.deadline = 'Please set a deadline';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      setIsLoading(true);
      
      try {
        const response = await jobService.createJob({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          budget: formData.budget,
          budgetType: formData.budgetType,
          deadline: formData.deadline,
          skills: formData.skills
        });
        
        if (response.job) {
          navigate('/dashboard');
          alert('Job posted successfully!');
        } else {
          setErrors({ general: response.message || 'Failed to post job' });
        }
      } catch (error) {
        setErrors({ general: 'Failed to post job. Please try again.' });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="post-job-page">
      <div className="page-container">
        <h1>Post a New Job</h1>
        <p>Tell us about your project and find the perfect freelancer for the job.</p>
        
        {errors.general && (
          <div className="error-banner">
            {errors.general}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="job-form">
          <div className="form-section">
            <h2>Job Details</h2>
            
            <div className="form-group">
              <label htmlFor="title">Job Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Design a modern logo for my startup"
                className={errors.title ? 'error' : ''}
              />
              {errors.title && <span className="error-message">{errors.title}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="description">Job Description *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your project in detail. Include requirements, expectations, and any specific instructions..."
                rows="6"
                className={errors.description ? 'error' : ''}
              />
              {errors.description && <span className="error-message">{errors.description}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className={errors.category ? 'error' : ''}
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {errors.category && <span className="error-message">{errors.category}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="skills">Required Skills</label>
              <input
                type="text"
                id="skills"
                name="skills"
                value={formData.skills}
                onChange={handleInputChange}
                placeholder="e.g., React, Node.js, MongoDB (comma separated)"
              />
            </div>
          </div>
          
          <div className="form-section">
            <h2>Budget & Timeline</h2>
            
            <div className="budget-type">
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="budgetType"
                    value="fixed"
                    checked={formData.budgetType === 'fixed'}
                    onChange={handleInputChange}
                  />
                  Fixed Price Project
                </label>
                <label>
                  <input
                    type="radio"
                    name="budgetType"
                    value="hourly"
                    checked={formData.budgetType === 'hourly'}
                    onChange={handleInputChange}
                  />
                  Hourly Rate
                </label>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="budget">
                Budget * ({formData.budgetType === 'fixed' ? 'Total Project Cost' : 'Per Hour Rate'})
              </label>
              <input
                type="number"
                id="budget"
                name="budget"
                value={formData.budget}
                onChange={handleInputChange}
                placeholder={formData.budgetType === 'fixed' ? '500' : '25'}
                min="1"
                className={errors.budget ? 'error' : ''}
              />
              {errors.budget && <span className="error-message">{errors.budget}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="deadline">Project Deadline *</label>
              <input
                type="date"
                id="deadline"
                name="deadline"
                value={formData.deadline}
                onChange={handleInputChange}
                min={new Date().toISOString().split('T')[0]}
                className={errors.deadline ? 'error' : ''}
              />
              {errors.deadline && <span className="error-message">{errors.deadline}</span>}
            </div>
          </div>
          
          <div className="form-section">
            <h2>Attachments</h2>
            <div className="form-group">
              <label htmlFor="attachments">Project Files (Optional)</label>
              <input
                type="file"
                id="attachments"
                name="attachments"
                onChange={handleFileChange}
                multiple
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
              />
              <small>Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG, GIF (Max 10MB each)</small>
            </div>
          </div>
          
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" disabled={isLoading}>Save as Draft</button>
            <button type="submit" className="btn" disabled={isLoading}>
              {isLoading ? 'Posting Job...' : 'Post Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PostJob;
