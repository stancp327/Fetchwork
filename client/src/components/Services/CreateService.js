import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../../utils/api';
import '../UserComponents.css';

const CreateService = () => {
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
    requirements: '',
    basicTitle: '',
    basicDescription: '',
    basicPrice: '',
    basicDeliveryTime: '',
    basicRevisions: 1
  });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Service title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title cannot exceed 100 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Service description is required';
    } else if (formData.description.length > 3000) {
      newErrors.description = 'Description cannot exceed 3000 characters';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.basicTitle.trim()) {
      newErrors.basicTitle = 'Basic package title is required';
    }

    if (!formData.basicDescription.trim()) {
      newErrors.basicDescription = 'Basic package description is required';
    }

    if (!formData.basicPrice || parseFloat(formData.basicPrice) < 5) {
      newErrors.basicPrice = 'Price must be at least $5';
    }

    if (!formData.basicDeliveryTime || parseInt(formData.basicDeliveryTime) < 1) {
      newErrors.basicDeliveryTime = 'Delivery time must be at least 1 day';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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

      const serviceData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        subcategory: formData.subcategory.trim() || undefined,
        skills: skillsArray,
        requirements: formData.requirements.trim(),
        pricing: {
          basic: {
            title: formData.basicTitle.trim(),
            description: formData.basicDescription.trim(),
            price: parseFloat(formData.basicPrice),
            deliveryTime: parseInt(formData.basicDeliveryTime),
            revisions: parseInt(formData.basicRevisions)
          }
        }
      };

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to create a service.');
        navigate('/login');
        return;
      }
      await axios.post(`${getApiBaseUrl()}/api/services`, serviceData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/browse-services');
      }, 2000);

    } catch (error) {
      console.error('Failed to create service:', error);
      const serverMsg = error.response?.data?.error || error.message;
      if (error.response?.status === 401) {
        setError('Your session expired. Please log in again.');
        navigate('/login');
      } else {
        setError(serverMsg || 'Failed to create service');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="user-container">
        <div className="success">
          <h3>Service Created Successfully!</h3>
          <p>Your service is now live and available for clients. Redirecting to browse services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-container">
      <div className="user-header">
        <h1>Create a Service</h1>
        <p>Offer your skills to clients with a professional service listing</p>
      </div>

      <div className="main-content">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Service Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g. I will create a professional website for your business"
              maxLength={100}
            required
            />
            {errors.title && <div className="error-text">{errors.title}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="description">Service Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe your service in detail..."
              rows={6}
              maxLength={3000}
            required
            />
            <div style={{ fontSize: '0.8rem', color: '#6c757d', textAlign: 'right' }}>
              {formData.description.length}/3000 characters
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
            required
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
            <label htmlFor="skills">Skills and Tags</label>
            <input
              type="text"
              id="skills"
              name="skills"
              value={formData.skills}
              onChange={handleInputChange}
              placeholder="e.g. React, Node.js, MongoDB (comma separated)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="requirements">Requirements from Buyer</label>
            <textarea
              id="requirements"
              name="requirements"
              value={formData.requirements}
              onChange={handleInputChange}
              placeholder="What do you need from the buyer to get started?"
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="section-title" style={{ marginTop: '30px', marginBottom: '20px' }}>
            Basic Package *
          </div>

          <div className="form-group">
            <label htmlFor="basicTitle">Package Title *</label>
            <input
              type="text"
              id="basicTitle"
              name="basicTitle"
              value={formData.basicTitle}
              onChange={handleInputChange}
              placeholder="e.g. Basic Website"
            required
            />
            {errors.basicTitle && <div className="error-text">{errors.basicTitle}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="basicDescription">Package Description *</label>
            <textarea
              id="basicDescription"
              name="basicDescription"
              value={formData.basicDescription}
              onChange={handleInputChange}
              placeholder="What's included in this package?"
              rows={3}
            required
            />
            {errors.basicDescription && <div className="error-text">{errors.basicDescription}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label htmlFor="basicPrice">Price ($) *</label>
              <input
                type="number"
                id="basicPrice"
                name="basicPrice"
                value={formData.basicPrice}
                onChange={handleInputChange}
                placeholder="25"
                min="5"
                step="0.01"
              required
              />
              {errors.basicPrice && <div className="error-text">{errors.basicPrice}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="basicDeliveryTime">Delivery Time (days) *</label>
              <input
                type="number"
                id="basicDeliveryTime"
                name="basicDeliveryTime"
                value={formData.basicDeliveryTime}
                onChange={handleInputChange}
                placeholder="3"
                min="1"
              required
              />
              {errors.basicDeliveryTime && <div className="error-text">{errors.basicDeliveryTime}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="basicRevisions">Revisions</label>
              <input
                type="number"
                id="basicRevisions"
                name="basicRevisions"
                value={formData.basicRevisions}
                onChange={handleInputChange}
                min="0"
                max="10"
              />
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating Service...' : 'Create Service'}
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

export default CreateService;
