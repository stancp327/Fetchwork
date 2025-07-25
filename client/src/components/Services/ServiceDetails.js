import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { formatCategory } from '../../utils/formatters';
import '../UserComponents.css';

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://fetchwork-1.onrender.com';
};

const ServiceDetails = () => {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState('basic');
  const [requirements, setRequirements] = useState('');

  const apiBaseUrl = getApiBaseUrl();

  const fetchService = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${apiBaseUrl}/api/services/${id}`);
      setService(response.data.service);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch service:', error);
      setError(error.response?.data?.error || 'Failed to load service');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, id]);

  useEffect(() => {
    fetchService();
  }, [fetchService]);


  const handleOrder = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setOrderLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${apiBaseUrl}/api/services/${id}/order`,
        {
          package: selectedPackage,
          requirements: requirements.trim()
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      alert('Service ordered successfully! Check your messages for details.');
      navigate('/messages');
    } catch (error) {
      console.error('Failed to order service:', error);
      alert(error.response?.data?.error || 'Failed to order service');
    } finally {
      setOrderLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="user-container">
        <div className="loading">Loading service...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="user-container">
        <div className="error">Service not found</div>
      </div>
    );
  }

  const currentPackage = service.pricing[selectedPackage];
  const isOwnService = user && service.freelancer._id === user._id;

  return (
    <div className="user-container">
      <div className="service-details">
        <div className="service-header">
          <h1>{service.title}</h1>
          <div className="service-meta">
            <span className="tag primary">{formatCategory(service.category)}</span>
            <span>⭐ {service.rating.toFixed(1)} ({service.totalReviews} reviews)</span>
            <span>👁️ {service.views} views</span>
          </div>
        </div>

        <div className="service-content-grid">
          <div className="service-main">
            <div className="service-gallery">
              {service.gallery && service.gallery.length > 0 ? (
                <img src={service.gallery[0].url} alt={service.title} />
              ) : (
                <div className="placeholder-image">
                  <span>📋</span>
                </div>
              )}
            </div>

            <div className="service-description">
              <h3>About This Service</h3>
              <p>{service.description}</p>
            </div>

            {service.skills && service.skills.length > 0 && (
              <div className="service-skills">
                <h3>Skills and Expertise</h3>
                <div className="service-tags">
                  {service.skills.map((skill, index) => (
                    <span key={index} className="tag">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {service.faqs && service.faqs.length > 0 && (
              <div className="service-faqs">
                <h3>Frequently Asked Questions</h3>
                {service.faqs.map((faq, index) => (
                  <div key={index} className="faq-item">
                    <h4>{faq.question}</h4>
                    <p>{faq.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="service-sidebar">
            <div className="freelancer-card">
              <div className="freelancer-info">
                <img 
                  src={service.freelancer.profilePicture || '/default-avatar.png'} 
                  alt={`${service.freelancer.firstName} ${service.freelancer.lastName}`}
                  className="freelancer-avatar-large"
                />
                <div>
                  <h3>{service.freelancer.firstName} {service.freelancer.lastName}</h3>
                  <div className="freelancer-stats">
                    <span>⭐ {service.freelancer.rating || 0} rating</span>
                    <span>📦 {service.freelancer.totalJobs || 0} orders</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pricing-card">
              <div className="package-selector">
                <button
                  className={`package-btn ${selectedPackage === 'basic' ? 'active' : ''}`}
                  onClick={() => setSelectedPackage('basic')}
                >
                  Basic
                </button>
                {service.pricing.standard && (
                  <button
                    className={`package-btn ${selectedPackage === 'standard' ? 'active' : ''}`}
                    onClick={() => setSelectedPackage('standard')}
                  >
                    Standard
                  </button>
                )}
                {service.pricing.premium && (
                  <button
                    className={`package-btn ${selectedPackage === 'premium' ? 'active' : ''}`}
                    onClick={() => setSelectedPackage('premium')}
                  >
                    Premium
                  </button>
                )}
              </div>

              {currentPackage && (
                <div className="package-details">
                  <h3>{currentPackage.title}</h3>
                  <p>{currentPackage.description}</p>
                  
                  <div className="package-features">
                    <div className="feature">
                      <span>💰 Price: <strong>${currentPackage.price}</strong></span>
                    </div>
                    <div className="feature">
                      <span>⏱️ Delivery: <strong>{currentPackage.deliveryTime} days</strong></span>
                    </div>
                    <div className="feature">
                      <span>🔄 Revisions: <strong>{currentPackage.revisions}</strong></span>
                    </div>
                  </div>

                  {service.requirements && (
                    <div className="service-requirements">
                      <h4>Requirements</h4>
                      <p>{service.requirements}</p>
                    </div>
                  )}

                  {!isOwnService && (
                    <div className="order-section">
                      <div className="form-group">
                        <label htmlFor="requirements">Additional Requirements (Optional)</label>
                        <textarea
                          id="requirements"
                          value={requirements}
                          onChange={(e) => setRequirements(e.target.value)}
                          placeholder="Any specific requirements or details..."
                          rows={3}
                        />
                      </div>

                      <button
                        onClick={handleOrder}
                        disabled={orderLoading}
                        className="btn btn-primary btn-large"
                      >
                        {orderLoading ? 'Ordering...' : `Order Now - $${currentPackage.price}`}
                      </button>
                    </div>
                  )}

                  {isOwnService && (
                    <div className="own-service-notice">
                      <p>This is your service listing</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetails;
