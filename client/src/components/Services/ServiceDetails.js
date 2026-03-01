import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLocationDisplay } from '../../utils/location';
import { useAuth } from '../../context/AuthContext';
import { formatCategory } from '../../utils/formatters';
import { apiRequest } from '../../utils/api';
import CustomOfferModal from '../Offers/CustomOfferModal';
import EscrowModal from '../Payments/EscrowModal';
import SEO from '../common/SEO';
import './ServiceDetails.css';

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
  const [showOfferModal,  setShowOfferModal]  = useState(false);
  const [orderConfirmed,  setOrderConfirmed]  = useState(null); // holds confirmed package details
  const [orderPayment,    setOrderPayment]    = useState(null); // { clientSecret, orderId, amount, packageName, deliveryDays }

  const fetchService = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/services/${id}`);
      setService(data.service);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch service:', error);
      setError(error.data?.error || error.message || 'Failed to load service');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchService();
  }, [fetchService]);


  const handleOrder = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setOrderLoading(true);
    try {
      const data = await apiRequest(`/api/services/${id}/order`, {
        method: 'POST',
        body: JSON.stringify({ package: selectedPackage, requirements: requirements.trim() })
      });
      // Show payment modal with pre-fetched clientSecret
      setOrderPayment({
        clientSecret: data.clientSecret,
        orderId:      data.orderId,
        amount:       data.amount,
        packageName:  data.packageName,
        deliveryDays: data.deliveryDays,
        serviceName:  data.serviceName,
      });
    } catch (error) {
      alert(error.message || 'Failed to create order. Please try again.');
    } finally {
      setOrderLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntent) => {
    if (!orderPayment) return;
    try {
      await apiRequest(`/api/services/${id}/orders/${orderPayment.orderId}/confirm`, {
        method: 'POST'
      });
      setOrderPayment(null);
      setOrderConfirmed({
        serviceName:    orderPayment.serviceName || service?.title,
        freelancerName: service?.user ? `${service.user.firstName} ${service.user.lastName}` : 'Freelancer',
        packageName:    orderPayment.packageName,
        price:          orderPayment.amount,
        delivery:       orderPayment.deliveryDays,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert('Payment received but order confirmation failed. Please contact support.');
    }
  };


  if (orderConfirmed) {
    return (
      <div className="sd-state-page">
        <div className="sd-confirmation">
          <div className="sd-confirm-icon">✅</div>
          <h2>Order Confirmed!</h2>
          <p className="sd-confirm-sub">Your order has been placed and the freelancer has been notified.</p>

          <div className="sd-confirm-summary">
            <div className="sd-confirm-row">
              <span>Service</span>
              <span>{orderConfirmed.serviceName}</span>
            </div>
            <div className="sd-confirm-row">
              <span>Freelancer</span>
              <span>{orderConfirmed.freelancerName}</span>
            </div>
            <div className="sd-confirm-row">
              <span>Package</span>
              <span>{orderConfirmed.packageName}</span>
            </div>
            {orderConfirmed.price && (
              <div className="sd-confirm-row">
                <span>Price</span>
                <span>${orderConfirmed.price}</span>
              </div>
            )}
            {orderConfirmed.delivery && (
              <div className="sd-confirm-row">
                <span>Delivery</span>
                <span>{orderConfirmed.delivery} day{orderConfirmed.delivery !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          <p className="sd-confirm-next">
            💬 Head to your messages to discuss the details and get started.
          </p>

          <div className="sd-confirm-actions">
            <button className="btn btn-primary" onClick={() => navigate('/messages')}>
              View in Messages →
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sd-state-page">
        <p>Loading service...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sd-state-page">
        <p style={{ color: '#dc2626' }}>{error}</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="sd-state-page">
        <p>Service not found</p>
      </div>
    );
  }

  const currentPackage = service.pricing[selectedPackage];
  const isOwnService = user && service.freelancer._id === user._id;

  const freelancerName = service.user
    ? `${service.user.firstName} ${service.user.lastName}`
    : (service.freelancer?.firstName ? `${service.freelancer.firstName} ${service.freelancer.lastName}` : 'Freelancer');
  const lowestPrice = Math.min(
    ...['basic', 'standard', 'premium']
      .map(p => service.pricing?.[p]?.price)
      .filter(Boolean)
  );
  const seoDesc = service.description
    ? service.description.slice(0, 155) + (service.description.length > 155 ? '...' : '')
    : `${service.title} by ${freelancerName} on Fetchwork.`;

  return (
    <div className="service-details-page">
      <SEO
        title={service.title}
        description={seoDesc}
        keywords={`${service.category}, ${service.title}, freelance services, hire ${service.category} freelancer`}
        path={`/services/${id}`}
        type="product"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: service.title,
          description: service.description,
          provider: { '@type': 'Person', name: freelancerName },
          offers: lowestPrice ? {
            '@type': 'Offer',
            price: lowestPrice,
            priceCurrency: 'USD',
          } : undefined,
          url: `https://fetchwork.net/services/${id}`,
        }}
      />
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
                  {service.freelancer.bio && (
                    <p className="freelancer-bio">{service.freelancer.bio.substring(0, 100)}...</p>
                  )}
                  <div className="freelancer-stats">
                    <span>⭐ {service.freelancer.rating || 0} rating</span>
                    <span>📦 {service.freelancer.totalJobs || 0} orders</span>
                    {service.freelancer.location && (
                      <span>📍 {getLocationDisplay(service.freelancer.location)}</span>
                    )}
                  </div>
                  {service.freelancer.socialLinks?.portfolio && (
                    <div className="freelancer-links">
                      <a 
                        href={service.freelancer.socialLinks.portfolio} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="portfolio-link"
                      >
                        🔗 View Portfolio
                      </a>
                    </div>
                  )}
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
                      <span>💰 Price: <strong>
                        ${currentPackage.price}
                        {service.serviceType === 'recurring' && service.recurring?.billingCycle
                          ? ` / ${service.recurring.billingCycle === 'per_session' ? 'session' : service.recurring.billingCycle === 'weekly' ? 'week' : 'month'}`
                          : ''}
                      </strong></span>
                    </div>
                    {service.serviceType === 'recurring' ? (
                      <>
                        {service.recurring?.sessionDuration && (
                          <div className="feature">
                            <span>⏱ Session: <strong>
                              {service.recurring.sessionDuration < 60
                                ? `${service.recurring.sessionDuration} min`
                                : `${service.recurring.sessionDuration / 60} hr`}
                            </strong></span>
                          </div>
                        )}
                        {service.recurring?.locationType && (
                          <div className="feature">
                            <span>📍 Format: <strong>
                              {service.recurring.locationType === 'online' ? 'Online' : service.recurring.locationType === 'in_person' ? 'In-Person' : 'Online & In-Person'}
                            </strong></span>
                          </div>
                        )}
                        {currentPackage.sessionsIncluded && (
                          <div className="feature">
                            <span>📅 Sessions included: <strong>{currentPackage.sessionsIncluded}</strong></span>
                          </div>
                        )}
                        {service.recurring?.trialEnabled && service.recurring?.trialPrice && (
                          <div className="feature" style={{ color: '#16a34a' }}>
                            <span>🎯 Trial session available: <strong>${service.recurring.trialPrice}</strong></span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="feature">
                          <span>⏱️ Delivery: <strong>{currentPackage.deliveryTime} days</strong></span>
                        </div>
                        <div className="feature">
                          <span>🔄 Revisions: <strong>{currentPackage.revisions}</strong></span>
                        </div>
                      </>
                    )}
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

                      <button
                        onClick={() => setShowOfferModal(true)}
                        className="btn btn-secondary"
                        style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.9rem' }}
                      >
                        📋 Request Custom Offer
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
      {showOfferModal && service && (
        <CustomOfferModal
          isOpen={true}
          onClose={() => setShowOfferModal(false)}
          recipientId={service.freelancer?._id}
          recipientName={`${service.freelancer?.firstName} ${service.freelancer?.lastName}`}
          serviceId={service._id}
          offerType="custom_order"
          prefillTerms={{
            amount: service.pricing?.basic?.price || '',
            deliveryTime: service.pricing?.basic?.deliveryTime || '',
            description: `Custom request for: ${service.title}`
          }}
          onSuccess={() => alert('Offer sent! Check your offers page.')}
        />
      )}

      {orderPayment && (
        <EscrowModal
          job={{ _id: orderPayment.orderId, title: orderPayment.serviceName || service?.title }}
          amount={orderPayment.amount}
          preloadedSecret={orderPayment.clientSecret}
          title="Complete Your Order"
          onClose={() => setOrderPayment(null)}
          onPaid={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default ServiceDetails;
