import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { getLocationDisplay } from '../../utils/location';
import { getCategoryLabel, getCategoryIcon } from '../../utils/categories';
import CustomOfferModal from '../Offers/CustomOfferModal';
import SaveButton from '../common/SaveButton';
import BookingCalendar from '../Bookings/BookingCalendar';
import AvailabilityBadge from '../common/AvailabilityBadge';
import { TrustBadges, ReputationStats } from '../common/TrustBadges';
import SEO from '../common/SEO';
import { createPersonSchema } from '../../utils/structuredData';
import { useAuth } from '../../context/AuthContext';
import OnlineStatus, { formatResponseTime } from '../common/OnlineStatus';
import { SkillBadge } from '../Skills/SkillAssessmentHub';
import ShareQR from '../common/ShareQR';
import './PublicProfile.css';

const StarRating = ({ rating }) => {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="pp-stars">
      {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
      <span className="pp-rating-num">{rating.toFixed(1)}</span>
    </span>
  );
};

const PublicProfile = () => {
  const { id, username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showBooking,    setShowBooking]    = useState(false);
  const [reviewSummary, setReviewSummary]   = useState(null);
  const [reviewSummaryLoading, setReviewSummaryLoading] = useState(false);
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [skillBadges, setSkillBadges] = useState([]);

  const handleMessage = async () => {
    if (!currentUser) { navigate('/login'); return; }
    const freelancer = data?.freelancer;
    if (!freelancer?._id) { navigate('/messages'); return; }
    setMessagingLoading(true);
    try {
      // Find or create conversation — no auto-message, user types their own
      const res = await apiRequest('/api/messages/conversations/find-or-create', {
        method: 'POST',
        body: JSON.stringify({ recipientId: freelancer._id })
      });
      navigate(`/messages?conversation=${res.conversationId}`);
    } catch {
      navigate('/messages');
    } finally {
      setMessagingLoading(false);
    }
  };
  const [activeSection, setActiveSection] = useState('about');
  const [similar, setSimilar] = useState([]);

  const freelancerId = id || username;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const result = await apiRequest(`/api/freelancers/${freelancerId}`);
        setData(result);
      } catch (err) {
        setError('Freelancer not found');
      } finally {
        setLoading(false);
      }
    };
    if (freelancerId) {
      fetchProfile();
      apiRequest(`/api/freelancers/${freelancerId}/similar`)
        .then(data => setSimilar(data.similar || []))
        .catch(() => {});
      apiRequest(`/api/skills/user/${freelancerId}`)
        .then(d => setSkillBadges(d.assessments || []))
        .catch(() => {});
    }
  }, [freelancerId]);

  if (loading) return (
    <div className="pp-container">
      <div className="pp-loading">
        <div className="pp-loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="pp-container">
      <div className="pp-error">
        <h2>😕 {error || 'Profile not found'}</h2>
        <button onClick={() => navigate('/freelancers')} className="pp-btn-secondary">Browse Freelancers</button>
      </div>
    </div>
  );

  const f = data.freelancer;
  const stats = data.stats;
  const services = data.services || [];
  const reviews = data.reviews || [];
  const portfolio = f.portfolio || [];
  const languages = f.languages || [];
  const certifications = f.certifications || [];
  const experience = f.experience || [];
  const education = f.education || [];
  const isOwnProfile = currentUser?._id === f._id;

  const initials = `${f.firstName?.[0] || ''}${f.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="pp-container">
      <SEO
        title={`${f.firstName} ${f.lastName} — Freelancer`}
        description={f.bio?.substring(0, 160) || `${f.firstName} ${f.lastName} — freelancer on Fetchwork`}
        path={`/freelancers/${f._id}`}
        type="profile"
        structuredData={createPersonSchema(f)}
      />
      {/* ── Hero Section ────────────────────────────────────── */}
      <div className="pp-hero">
        <div className="pp-hero-bg"></div>
        <div className="pp-hero-content">
          <div className="pp-avatar-wrapper">
            {f.profilePicture ? (
              <img src={f.profilePicture} alt={f.firstName} className="pp-avatar" />
            ) : (
              <div className="pp-avatar pp-avatar-initials">{initials}</div>
            )}
            {f.isVerified && <span className="pp-verified-badge" title="Verified">✓</span>}
          </div>
          <div className="pp-hero-info">
            <h1 className="pp-name">{f.firstName} {f.lastName}</h1>
            <TrustBadges user={f} size="sm" />
            {f.headline && <p className="pp-headline">{f.headline}</p>}
            <div className="pp-hero-meta">
              {stats.rating > 0 && <StarRating rating={stats.rating} />}
              {stats.totalReviews > 0 && <span className="pp-meta-item">({stats.totalReviews} reviews)</span>}
              <span className="pp-meta-item">📍 {getLocationDisplay(f.location)}</span>
              {stats.memberSince && <span className="pp-meta-item">📅 {new Date(stats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
            </div>
          </div>
          <div className="pp-hero-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <AvailabilityBadge status={f.availabilityStatus} />
              <OnlineStatus isOnline={f.isOnline} lastSeen={f.lastSeen} size="sm" />
              {!isOwnProfile && <SaveButton itemId={f._id} itemType="freelancer" size="lg" />}
            </div>
            <ShareQR url={`/freelancers/${f._id}`} title={`${f.firstName} ${f.lastName} on Fetchwork`} />
            {f.hourlyRate > 0 && <div className="pp-rate">${f.hourlyRate}<span>/hr</span></div>}
            {!isOwnProfile && (
              <>
                <button className="pp-btn-primary" onClick={handleMessage} disabled={messagingLoading}>
                  {messagingLoading ? '...' : '💬 Message'}
                </button>
                <button className="pp-btn-secondary" onClick={() => setShowOfferModal(true)}>📋 Make Offer</button>
                <button className="pp-btn-secondary" onClick={() => setShowBooking(b => !b)}>📅 Book Session</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Bar ───────────────────────────────────────── */}
      <div className="pp-stats-bar">
        <div className="pp-stat">
          <div className="pp-stat-value">{stats.completedJobs || 0}</div>
          <div className="pp-stat-label">Jobs Completed</div>
        </div>
        <div className="pp-stat">
          <div className="pp-stat-value">{stats.rating?.toFixed(1) || '0.0'}</div>
          <div className="pp-stat-label">Rating</div>
        </div>
        <div className="pp-stat">
          <div className="pp-stat-value">{stats.totalReviews || 0}</div>
          <div className="pp-stat-label">Reviews</div>
        </div>
        <div className="pp-stat">
          <div className="pp-stat-value">{services.length}</div>
          <div className="pp-stat-label">Services</div>
        </div>
        {f.completionRate > 0 && (
          <div className="pp-stat">
            <div className="pp-stat-value" style={{ color: f.completionRate >= 90 ? '#059669' : f.completionRate >= 70 ? '#d97706' : '#dc2626' }}>
              {f.completionRate}%
            </div>
            <div className="pp-stat-label">Completion</div>
          </div>
        )}
        {f.avgResponseTime && (
          <div className="pp-stat">
            <div className="pp-stat-value">{formatResponseTime(f.avgResponseTime)}</div>
            <div className="pp-stat-label">Avg Response</div>
          </div>
        )}
        {f.onTimeDelivery > 0 && f.completedJobs > 2 && (
          <div className="pp-stat">
            <div className="pp-stat-value" style={{ color: '#059669' }}>{f.onTimeDelivery}%</div>
            <div className="pp-stat-label">On Time</div>
          </div>
        )}
        {f.responseTime && !f.avgResponseTime && (
          <div className="pp-stat">
            <div className="pp-stat-value">{f.responseTime}</div>
            <div className="pp-stat-label">Avg Response</div>
          </div>
        )}
      </div>

      {/* ── Navigation Tabs ─────────────────────────────────── */}
      <div className="pp-nav">
        {['about', 'portfolio', 'services', 'reviews'].map(tab => (
          <button
            key={tab}
            className={`pp-nav-tab ${activeSection === tab ? 'active' : ''}`}
            onClick={() => setActiveSection(tab)}
          >
            {tab === 'about' ? '👤 About' : tab === 'portfolio' ? '🖼️ Portfolio' : tab === 'services' ? '🛒 Services' : '⭐ Reviews'}
            {tab === 'reviews' && reviews.length > 0 && ` (${reviews.length})`}
            {tab === 'services' && services.length > 0 && ` (${services.length})`}
            {tab === 'portfolio' && portfolio.length > 0 && ` (${portfolio.length})`}
          </button>
        ))}
      </div>

      {/* ── Content Area ────────────────────────────────────── */}
      <div className="pp-content">
        {/* About Tab */}
        {activeSection === 'about' && (
          <div className="pp-section-grid">
            <div className="pp-main-col">
              {f.bio && (
                <div className="pp-card">
                  <h2>About Me</h2>
                  <p className="pp-bio">{f.bio}</p>
                </div>
              )}

              {/* Skills — clickable to browse freelancers with same skill */}
              {f.skills?.length > 0 && (
                <div className="pp-card">
                  <h2>Skills</h2>
                  <div className="pp-skills">
                    {f.skills.map((s, i) => (
                      <button
                        key={i}
                        className="pp-skill-tag pp-skill-tag-clickable"
                        title={`Find freelancers skilled in ${s}`}
                        onClick={() => navigate(`/freelancers?search=${encodeURIComponent(s)}`)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Verified Skill Badges */}
              {skillBadges.length > 0 && (
                <div className="pp-card">
                  <h2>✅ Verified Skills</h2>
                  <p className="pp-verified-sub">Earned by passing Fetchwork skill assessments</p>
                  <div className="pp-skill-badges">
                    {skillBadges.map(a => (
                      <SkillBadge key={a.category} assessment={a} size="md" />
                    ))}
                  </div>
                </div>
              )}

              {experience.length > 0 && (
                <div className="pp-card">
                  <h2>Experience</h2>
                  {experience.map((e, i) => (
                    <div key={i} className="pp-timeline-item">
                      <strong>{e.role || e.title}</strong>
                      {e.company && <span> at {e.company}</span>}
                      {(e.startDate || e.endDate) && (
                        <div className="pp-muted">{e.startDate} — {e.endDate || 'Present'}</div>
                      )}
                      {e.description && <p>{e.description}</p>}
                    </div>
                  ))}
                </div>
              )}

              {education.length > 0 && (
                <div className="pp-card">
                  <h2>Education</h2>
                  {education.map((e, i) => (
                    <div key={i} className="pp-timeline-item">
                      <strong>{e.degree}</strong>
                      {e.school && <span> — {e.school}</span>}
                      {(e.startDate || e.endDate) && (
                        <div className="pp-muted">{e.startDate} — {e.endDate || 'Present'}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pp-side-col">
              {languages.length > 0 && (
                <div className="pp-card">
                  <h2>🌍 Languages</h2>
                  <ul className="pp-lang-list">
                    {languages.map((l, i) => (
                      <li key={i}>
                        <span className="pp-lang-name">{l.name}</span>
                        <span className="pp-lang-level">{l.level}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {certifications.length > 0 && (
                <div className="pp-card">
                  <h2>📜 Certifications</h2>
                  {certifications.map((c, i) => (
                    <div key={i} className="pp-cert">
                      <strong>{c.name}</strong>
                      {c.issuer && <div className="pp-muted">{c.issuer}</div>}
                      {c.credentialUrl && (
                        <a href={c.credentialUrl} target="_blank" rel="noreferrer" className="pp-link">View credential →</a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="pp-card">
                <h2>📊 Quick Facts</h2>
                <div className="pp-facts">
                  {f.hourlyRate > 0 && <div className="pp-fact"><span>Rate</span><strong>${f.hourlyRate}/hr</strong></div>}
                  <div className="pp-fact"><span>Jobs Done</span><strong>{stats.completedJobs || 0}</strong></div>
                  {f.accountType && <div className="pp-fact"><span>Account</span><strong>{f.accountType}</strong></div>}
                  <div className="pp-fact"><span>Location</span><strong>{getLocationDisplay(f.location)}</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Portfolio Tab */}
        {activeSection === 'portfolio' && (
          <div>
            {portfolio.length > 0 ? (
              <div className="pp-portfolio-grid">
                {portfolio.map((p, i) => (
                  <div key={i} className="pp-portfolio-item">
                    {p.url && (
                      <div className="pp-portfolio-media">
                        {p.mediaType === 'video' ? (
                          <video src={p.url} controls className="pp-portfolio-video" />
                        ) : (
                          <img src={p.url} alt={p.title || 'Portfolio piece'} className="pp-portfolio-img" />
                        )}
                      </div>
                    )}
                    <div className="pp-portfolio-info">
                      {p.title && <h3>{p.title}</h3>}
                      {p.description && <p>{p.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pp-empty">
                <div className="pp-empty-icon">🖼️</div>
                <p>No portfolio items yet</p>
              </div>
            )}
          </div>
        )}

        {/* Services Tab */}
        {activeSection === 'services' && (
          <div>
            {services.length > 0 ? (
              <div className="pp-services-grid">
                {services.map((s, i) => (
                  <Link to={`/services/${s._id}`} key={i} className="pp-service-card">
                    <div className="pp-service-header">
                      <span className="pp-service-cat">{getCategoryIcon(s.category)} {getCategoryLabel(s.category)}</span>
                      {s.rating > 0 && <span className="pp-service-rating">⭐ {s.rating.toFixed(1)}</span>}
                    </div>
                    <h3>{s.title}</h3>
                    <div className="pp-service-footer">
                      <span className="pp-service-price">From ${s.pricing?.basic?.price || '—'}</span>
                      {s.pricing?.basic?.deliveryTime && (
                        <span className="pp-service-delivery">⏱️ {s.pricing.basic.deliveryTime}d</span>
                      )}
                      {s.totalOrders > 0 && <span className="pp-service-orders">{s.totalOrders} orders</span>}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="pp-empty">
                <div className="pp-empty-icon">🛒</div>
                <p>No services listed yet</p>
              </div>
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeSection === 'reviews' && (
          <div>
            {/* AI Review Summary */}
            {reviews.length >= 3 && (
              <div className="pp-ai-summary-wrap">
                {reviewSummary ? (
                  <div className="pp-ai-summary-card">
                    <span className="pp-ai-summary-label">✨ AI Summary</span>
                    <p className="pp-ai-summary-text">{reviewSummary}</p>
                  </div>
                ) : (
                  <button
                    className="pp-ai-summary-btn"
                    disabled={reviewSummaryLoading}
                    onClick={async () => {
                      setReviewSummaryLoading(true);
                      try {
                        const userId = data?.user?._id || data?.user?.id;
                        const res = await apiRequest(`/api/ai/summarize-reviews/${userId}`);
                        if (res.summary) setReviewSummary(res.summary);
                      } catch { /* silent */ }
                      finally { setReviewSummaryLoading(false); }
                    }}
                  >
                    {reviewSummaryLoading ? '✨ Summarizing…' : `✨ Summarize ${reviews.length} reviews`}
                  </button>
                )}
              </div>
            )}
            {reviews.length > 0 ? (
              <div className="pp-reviews">
                {reviews.map((r, i) => (
                  <div key={i} className="pp-review-card">
                    <div className="pp-review-header">
                      <div className="pp-review-author">
                        {r.reviewer?.profilePicture ? (
                          <img src={r.reviewer.profilePicture} alt="" className="pp-review-avatar" />
                        ) : (
                          <div className="pp-review-avatar pp-avatar-initials-sm">
                            {r.reviewer?.firstName?.[0]}{r.reviewer?.lastName?.[0]}
                          </div>
                        )}
                        <div>
                          <strong>{r.reviewer?.firstName} {r.reviewer?.lastName}</strong>
                          <div className="pp-muted">{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
                        </div>
                      </div>
                      <StarRating rating={r.rating} />
                    </div>
                    {r.comment && <p className="pp-review-text">{r.comment}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="pp-empty">
                <div className="pp-empty-icon">⭐</div>
                <p>No reviews yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Similar Freelancers ──────────────────────────────── */}
      {similar.length > 0 && (
        <div style={{ padding: '0 2rem 2rem' }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem', color: '#111827' }}>Similar Freelancers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {similar.map(s => (
              <Link to={`/freelancers/${s._id}`} key={s._id} style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem',
                textDecoration: 'none', color: 'inherit', transition: 'border-color 0.15s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: '#eff6ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.9rem', fontWeight: 700, color: '#2563eb', overflow: 'hidden'
                  }}>
                    {s.profilePicture
                      ? <img src={s.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : `${s.firstName?.[0]}${s.lastName?.[0]}`}
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>{s.firstName} {s.lastName}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.headline || 'Freelancer'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                  {s.rating > 0 && <span>⭐ {s.rating.toFixed(1)}</span>}
                  {s.hourlyRate > 0 && <span>${s.hourlyRate}/hr</span>}
                  {s.availabilityStatus && <AvailabilityBadge status={s.availabilityStatus} />}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Book a Session ─────────────────────────────────── */}
      {showBooking && !isOwnProfile && (
        <div className="pp-booking-section">
          <h3>📅 Book a Session</h3>
          <BookingCalendar
            freelancerId={f._id}
            freelancerName={`${f.firstName} ${f.lastName}`}
            onBooked={() => setShowBooking(false)}
          />
        </div>
      )}

      {/* ── Custom Offer Modal ──────────────────────────────── */}
      {showOfferModal && (
        <CustomOfferModal
          isOpen={true}
          onClose={() => setShowOfferModal(false)}
          recipientId={f._id}
          recipientName={`${f.firstName} ${f.lastName}`}
          offerType="direct_offer"
          onSuccess={() => alert('Offer sent!')}
        />
      )}
    </div>
  );
};

export default PublicProfile;
