import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getLocationDisplay } from '../../utils/location';
import { useAuth } from '../../context/AuthContext';
import { formatCategory } from '../../utils/formatters';
import { apiRequest } from '../../utils/api';
import CustomOfferModal from '../Offers/CustomOfferModal';
import EscrowModal from '../Payments/EscrowModal';
import BookingCalendar from '../Bookings/BookingCalendar';
import UpcomingSessions from '../Sessions/UpcomingSessions';
import IntakeFormFill from './IntakeFormFill';
import SEO from '../common/SEO';
import Avatar from '../common/Avatar';
import ShareQR from '../common/ShareQR';
import ServiceAreaMap from '../common/ServiceAreaMap';
import './ServiceDetails.css';

const ServiceDetails = () => {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderLoading,     setOrderLoading]     = useState(false);
  const [selectedPackage,  setSelectedPackage]  = useState('basic');
  const [selectedBundle,   setSelectedBundle]   = useState(null);   // bundleId string
  const [bundleLoading,    setBundleLoading]    = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [requirements,     setRequirements]     = useState('');
  const [intakeValues,     setIntakeValues]     = useState({});
  const [showOfferModal,   setShowOfferModal]   = useState(false);
  const [orderConfirmed,   setOrderConfirmed]   = useState(null);
  const [orderPayment,     setOrderPayment]     = useState(null);

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
        body: JSON.stringify({ package: selectedPackage, requirements: requirements.trim(), intakeResponses: intakeValues })
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


  const handleBundlePurchase = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!selectedBundle) { alert('Please select a bundle first.'); return; }
    setBundleLoading(true);
    try {
      const data = await apiRequest(`/api/services/${id}/bundle/purchase`, {
        method: 'POST',
        body: JSON.stringify({ bundleId: selectedBundle }),
      });
      setOrderPayment({
        clientSecret: data.clientSecret,
        orderId:      data.purchaseId,
        amount:       data.amountCharged,
        packageName:  `${data.bundleName} (${data.sessions} sessions)`,
        deliveryDays: null,
        serviceName:  service?.title,
        type:         'bundle',
      });
    } catch (err) {
      alert(err.message || 'Failed to initiate bundle purchase.');
    } finally {
      setBundleLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setSubscribeLoading(true);
    try {
      const data = await apiRequest(`/api/services/${id}/subscribe`, {
        method: 'POST',
        body: JSON.stringify({ tier: selectedPackage }),
      });
      setOrderPayment({
        clientSecret: data.clientSecret,
        orderId:      data.subscriptionId,
        amount:       data.amountPerCycle,
        packageName:  `${selectedPackage} — ${data.billingCycle}`,
        deliveryDays: null,
        serviceName:  service?.title,
        type:         'subscription',
        billingCycle: data.billingCycle,
      });
    } catch (err) {
      alert(err.message || 'Failed to start subscription.');
    } finally {
      setSubscribeLoading(false);
    }
  };

  if (orderConfirmed) {
    return (
      <div className="sd-page sd-state-page">
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
      <div className="sd-page sd-state-page">
        <p>Loading service...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sd-page sd-state-page">
        <p style={{ color: '#dc2626' }}>{error}</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="sd-page sd-state-page">
        <p>Service not found</p>
      </div>
    );
  }

  const currentPackage = service.pricing[selectedPackage];
  const isOwnService = user && String(service.freelancer?._id) === String(user._id || user.id || user.userId);

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

  // ── helpers ─────────────────────────────────────────────────
  const billingLabel = service.recurring?.billingCycle === 'weekly' ? 'wk'
    : service.recurring?.billingCycle === 'per_session' ? 'session' : 'mo';

  const sessionDurationLabel = service.recurring?.sessionDuration
    ? service.recurring.sessionDuration < 60
      ? `${service.recurring.sessionDuration} min`
      : `${service.recurring.sessionDuration / 60} hr`
    : null;

  const locationFormatLabel = service.recurring?.locationType === 'online' ? 'Online'
    : service.recurring?.locationType === 'in_person' ? 'In-Person' : 'Online & In-Person';

  return (
    <div className="sd-page service-details-page">
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
          offers: lowestPrice ? { '@type': 'Offer', price: lowestPrice, priceCurrency: 'USD' } : undefined,
          url: `https://fetchwork.net/services/${id}`,
        }}
      />

      <div className="sd-layout">

        {/* ════════════════ LEFT COLUMN ════════════════ */}
        <div className="sd-main">

          {/* Title card */}
          <div className="sd-title-card">
            <div className="sd-badge-row">
              <span className="sd-cat-badge">{formatCategory(service.category)}</span>
              {service.isAvailable && (
                <span className="sd-avail-badge">
                  <span className="sd-avail-dot" />Available
                </span>
              )}
            </div>
            <h1 className="sd-title">{service.title}</h1>
            <div className="sd-meta-row">
              <span className="sd-rating">
                ⭐ {service.rating.toFixed(1)}
                <span className="sd-rating-count">({service.totalReviews} review{service.totalReviews !== 1 ? 's' : ''})</span>
              </span>
              <span className="sd-dot" />
              <span>👁 {service.views} views</span>
            </div>
            <div className="sd-share-row">
              <ShareQR url={`/services/${service._id}`} title={`${service.title} on Fetchwork`} />
            </div>
          </div>

          {/* Gallery */}
          <div className="sd-gallery-card">
            {service.gallery && service.gallery.length > 0 ? (
              <img src={service.gallery[0].url} alt={service.title} />
            ) : (
              <div className="sd-gallery-empty">
                <span className="sd-gallery-empty-icon">🖼️</span>
                <p>{isOwnService ? 'Add photos to attract more clients' : 'No photos yet'}</p>
              </div>
            )}
          </div>

          {/* About */}
          <div className="sd-card">
            <h2 className="sd-section-title">About This Service</h2>
            <p className="sd-about-text">{service.description}</p>
          </div>

          {/* Skills */}
          {service.skills && service.skills.length > 0 && (
            <div className="sd-card">
              <h2 className="sd-section-title">Skills &amp; Expertise</h2>
              <div className="sd-skills-list">
                {service.skills.map((skill, i) => (
                  <span key={i} className="sd-skill-tag">{skill}</span>
                ))}
              </div>
            </div>
          )}

          {/* FAQs */}
          {service.faqs && service.faqs.length > 0 && (
            <div className="sd-card">
              <h2 className="sd-section-title">Frequently Asked Questions</h2>
              {service.faqs.map((faq, i) => (
                <div key={i} className="sd-faq-item">
                  <p className="sd-faq-q">{faq.question}</p>
                  <p className="sd-faq-a">{faq.answer}</p>
                </div>
              ))}
            </div>
          )}

          {/* Bundles */}
          {service.bundles?.length > 0 && !isOwnService && (
            <div className="sd-card">
              <h2 className="sd-section-title">📦 Session Bundles</h2>
              <p className="sd-bundles-subtitle">Buy multiple sessions at a discount. Payments are held securely and released per completed session.</p>
              <div className="sd-bundles-grid">
                {service.bundles.filter(b => b.active).map(b => (
                  <div
                    key={b._id}
                    className={`sd-bundle-card ${selectedBundle === b._id ? 'selected' : ''}`}
                    onClick={() => setSelectedBundle(b._id)}
                  >
                    {b.savings > 0 && <span className="sd-bundle-savings">Save ${b.savings}</span>}
                    <div className="sd-bundle-name">{b.name}</div>
                    <div className="sd-bundle-sessions">{b.sessions} sessions</div>
                    <div className="sd-bundle-price">
                      ${b.price}
                      {service.feesIncluded && <span className="sd-fees-badge">fees incl.</span>}
                    </div>
                    <div className="sd-bundle-per">${(b.price / b.sessions).toFixed(2)} / session</div>
                    {b.expiresInDays && <div className="sd-bundle-expiry">⏱ Expires in {b.expiresInDays} days</div>}
                  </div>
                ))}
              </div>
              {selectedBundle && (
                <button
                  onClick={handleBundlePurchase}
                  disabled={bundleLoading}
                  className="sd-btn-order"
                  style={{ marginTop: '1rem' }}
                >
                  {bundleLoading ? 'Processing...' : `Buy Bundle — $${service.bundles.find(b => b._id === selectedBundle)?.price}`}
                </button>
              )}
            </div>
          )}

          {/* Service location + map */}
          {service.serviceLocation?.mode && service.serviceLocation.mode !== 'remote' && (() => {
            const loc = service.serviceLocation;
            const geoCoords = service.location?.coordinates?.coordinates;
            const lat = geoCoords?.[1];
            const lon = geoCoords?.[0];
            return (
              <div className="sd-card">
                <h2 className="sd-section-title">Service Location</h2>
                {lat && lon ? (
                  <ServiceAreaMap lat={lat} lon={lon} radius={loc.travelRadius || 25} mode={loc.mode} address={loc.address || ''} />
                ) : (
                  <div className="sd-location-info">
                    {loc.mode === 'at_freelancer' && <p style={{ margin: 0 }}>📍 <strong>At freelancer's location</strong>{loc.address ? ` — ${loc.address}` : ''}</p>}
                    {loc.mode === 'at_client'    && <p style={{ margin: 0 }}>🚗 <strong>Freelancer travels to you</strong>{loc.travelRadius > 0 ? ` (within ${loc.travelRadius} miles)` : ''}</p>}
                    {loc.mode === 'flexible'     && <p style={{ margin: 0 }}>🔄 <strong>Flexible</strong>{loc.address ? ` — ${loc.address}` : ''}{loc.travelRadius > 0 ? ` (up to ${loc.travelRadius} mi)` : ''}</p>}
                  </div>
                )}
                {loc.notes && <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>💬 {loc.notes}</p>}
              </div>
            );
          })()}
          {service.serviceLocation?.mode === 'remote' && (
            <div className="sd-card">
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>💻 This service is delivered remotely</p>
            </div>
          )}

          {/* Scheduling UI — varies by scheduleType */}
          {(() => {
            const st = service.scheduleType;
            // FIXED_RECURRING or FIXED_ONE_TIME: show upcoming sessions
            if (st === 'FIXED_RECURRING' || st === 'FIXED_ONE_TIME') {
              return (
                <div className="sd-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <UpcomingSessions serviceId={service._id} limit={10} allowBooking={!isOwnService} />
                </div>
              );
            }
            // REQUEST_BASED: no calendar, show message-first prompt
            if (st === 'REQUEST_BASED') {
              return !isOwnService ? (
                <div className="sd-card">
                  <h2 className="sd-section-title">Availability</h2>
                  <p className="sd-request-info">
                    💬 Message the freelancer to discuss details and availability.
                  </p>
                </div>
              ) : null;
            }
            // DYNAMIC_PRIVATE or undefined/legacy: existing booking calendar
            if (service.availability?.enabled && !isOwnService) {
              return (
                <div className="sd-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <BookingCalendar serviceId={service._id} availability={service.availability} />
                </div>
              );
            }
            return null;
          })()}

          {/* Reviews empty state */}
          <div className="sd-card">
            <h2 className="sd-section-title">Reviews</h2>
            {service.totalReviews === 0 ? (
              <div className="sd-reviews-empty">
                <div className="sd-reviews-stars">★★★★★</div>
                <h4>No reviews yet</h4>
                <p>Be the first to work with this freelancer and leave a review!</p>
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                {service.totalReviews} review{service.totalReviews !== 1 ? 's' : ''} · {service.rating.toFixed(1)} average
              </p>
            )}
          </div>

        </div>{/* end sd-main */}

        {/* ════════════════ RIGHT SIDEBAR ════════════════ */}
        <div className="sd-sidebar">
          <div className="sd-sidebar-sticky">

            {/* Seller card */}
            <div className="sd-card" style={{ marginBottom: '14px' }}>
              <div className="sd-seller-row">
                <Avatar user={service.freelancer} size={52} userId={service.freelancer?._id} />
                <div style={{ minWidth: 0 }}>
                  <Link to={`/freelancers/${service.freelancer?._id}`} className="sd-seller-name">
                    {service.freelancer.firstName} {service.freelancer.lastName}
                  </Link>
                  {service.freelancer.bio && (
                    <p className="sd-seller-bio">{service.freelancer.bio.substring(0, 90)}…</p>
                  )}
                  <div className="sd-seller-stats">
                    <span>⭐ {service.freelancer.rating || 0}</span>
                    <span>📦 {service.freelancer.totalJobs || 0} orders</span>
                    {service.freelancer.location && (
                      <span>📍 {getLocationDisplay(service.freelancer.location)}</span>
                    )}
                  </div>
                  {service.freelancer.socialLinks?.portfolio && (
                    <a href={service.freelancer.socialLinks.portfolio} target="_blank" rel="noopener noreferrer" className="sd-portfolio-link">
                      🔗 View Portfolio
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Order card */}
            <div className="sd-card sd-order-card">

              {/* Package tabs */}
              <div className="sd-tabs">
                <button className={`sd-tab ${selectedPackage === 'basic' ? 'active' : ''}`} onClick={() => setSelectedPackage('basic')}>Basic</button>
                {service.pricing.standard && (
                  <button className={`sd-tab ${selectedPackage === 'standard' ? 'active' : ''}`} onClick={() => setSelectedPackage('standard')}>Standard</button>
                )}
                {service.pricing.premium && (
                  <button className={`sd-tab ${selectedPackage === 'premium' ? 'active' : ''}`} onClick={() => setSelectedPackage('premium')}>Premium</button>
                )}
              </div>

              {currentPackage && (
                <>
                  <p className="sd-pkg-name">{currentPackage.title || selectedPackage.charAt(0).toUpperCase() + selectedPackage.slice(1)}</p>
                  {currentPackage.description && <p className="sd-pkg-desc">{currentPackage.description}</p>}

                  <div className="sd-pkg-features">
                    <div className="sd-pkg-feat">
                      <span>💰</span>
                      <span>Price: <strong>
                        ${currentPackage.price}
                        {service.serviceType === 'recurring' && service.recurring?.billingCycle ? ` / ${billingLabel}` : ''}
                      </strong>
                      {service.feesIncluded && <span className="sd-fees-badge">fees incl.</span>}
                      </span>
                    </div>

                    {service.serviceType === 'recurring' ? (
                      <>
                        {sessionDurationLabel && (
                          <div className="sd-pkg-feat"><span>⏱</span><span>Session: <strong>{sessionDurationLabel}</strong></span></div>
                        )}
                        {service.recurring?.locationType && (
                          <div className="sd-pkg-feat"><span>📍</span><span>Format: <strong>{locationFormatLabel}</strong></span></div>
                        )}
                        {currentPackage.sessionsIncluded && (
                          <div className="sd-pkg-feat"><span>📅</span><span>Included: <strong>{currentPackage.sessionsIncluded} sessions</strong></span></div>
                        )}
                        {service.recurring?.trialEnabled && service.recurring?.trialPrice && (
                          <div className="sd-pkg-feat-trial"><span>🎯</span><span>Trial available: <strong>${service.recurring.trialPrice}</strong></span></div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="sd-pkg-feat"><span>⏱️</span><span>Delivery: <strong>{currentPackage.deliveryTime} days</strong></span></div>
                        <div className="sd-pkg-feat"><span>🔄</span><span>Revisions: <strong>{currentPackage.revisions}</strong></span></div>
                      </>
                    )}
                  </div>

                  {service.requirements && (
                    <div className="sd-service-req">
                      <h4>Requirements</h4>
                      <p>{service.requirements}</p>
                    </div>
                  )}

                  {!isOwnService && (
                    <>
                      {service.serviceType !== 'recurring' && (
                        <>
                          <label className="sd-req-label" htmlFor="requirements">Additional Requirements <span style={{ fontWeight: 400, color: '#9ca3af' }}>(Optional)</span></label>
                          <textarea
                            id="requirements"
                            className="sd-req-textarea"
                            value={requirements}
                            onChange={(e) => setRequirements(e.target.value)}
                            placeholder="Any specific requirements or details…"
                            rows={3}
                          />
                        </>
                      )}

                      {service.intakeForm?.enabled && service.intakeForm?.fields?.length > 0 && (
                        <IntakeFormFill
                          fields={service.intakeForm.fields}
                          values={intakeValues}
                          onChange={(key, val) => setIntakeValues(prev => ({ ...prev, [key]: val }))}
                        />
                      )}

                      {service.serviceType === 'recurring' ? (
                        <button onClick={handleSubscribe} disabled={subscribeLoading} className="sd-btn-order">
                          {subscribeLoading ? 'Starting…' : `Subscribe — $${currentPackage.price}/${billingLabel}`}
                        </button>
                      ) : (
                        <button onClick={handleOrder} disabled={orderLoading} className="sd-btn-order">
                          {orderLoading ? 'Ordering…' : `Order Now — $${currentPackage.price}`}
                        </button>
                      )}

                      <button onClick={() => setShowOfferModal(true)} className="sd-btn-custom">
                        📋 Request Custom Offer
                      </button>

                      {/* Trust box */}
                      <div className="sd-trust-box">
                        <span className="sd-trust-icon">🛡️</span>
                        <div className="sd-trust-text">
                          <strong>Protected Payment</strong>
                          <span>Your payment is held securely in escrow and only released when you approve the delivery.</span>
                        </div>
                      </div>
                    </>
                  )}

                  {isOwnService && (
                    <div className="sd-own-notice">
                      <p>This is your service listing</p>
                      <div className="sd-own-links">
                        <Link to={`/service-packages/${service._id}`}>📦 Manage Packages</Link>
                        <Link to={`/services/${service._id}/availability`}>🕐 Availability</Link>
                        <Link to="/intake-forms/builder">📋 Intake Forms</Link>
                        {(service.scheduleType === 'FIXED_RECURRING' || service.scheduleType === 'FIXED_ONE_TIME') && (
                          <Link to={`/my-sessions?serviceId=${service._id}`}>📅 Manage Sessions</Link>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>{/* end sd-order-card */}

          </div>{/* end sd-sidebar-sticky */}
        </div>{/* end sd-sidebar */}

      </div>{/* end sd-layout */}

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
