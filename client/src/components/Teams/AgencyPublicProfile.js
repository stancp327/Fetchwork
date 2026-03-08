import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './AgencyPublicProfile.css';

const AgencyPublicProfile = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [agency, setAgency] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest(`/api/teams/agency/${slug}`)
      .then(data => setAgency(data.agency))
      .catch(() => setAgency(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="agp-page"><div className="agp-loading">Loading agency...</div></div>;
  if (!agency) {
    return (
      <div className="agp-page">
        <div className="agp-not-found">
          <h2>Agency not found</h2>
          <p>This agency profile doesn't exist or isn't public.</p>
          <Link to="/agencies" className="btn btn-secondary">Browse Agencies</Link>
        </div>
      </div>
    );
  }

  const activeMembers = (agency.members || []).filter(m => m.status === 'active');
  const founded = agency.createdAt ? new Date(agency.createdAt).getFullYear() : null;

  return (
    <div className="agp-page">
      {/* Hero Section */}
      <div className="agp-hero">
        <div className="agp-hero-inner">
          {agency.logo ? (
            <img src={agency.logo} alt={agency.name} className="agp-logo" />
          ) : (
            <div className="agp-logo-placeholder">{agency.name?.[0]}</div>
          )}
          <div className="agp-hero-text">
            <h1 className="agp-name">{agency.name}</h1>
            {agency.description && <p className="agp-tagline">{agency.description}</p>}
            {agency.website && (
              <a href={agency.website} target="_blank" rel="noopener noreferrer" className="agp-website">
                {agency.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {agency.specialties?.length > 0 && (
              <div className="agp-specialties">
                {agency.specialties.map((s, i) => (
                  <span key={i} className="agp-chip">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="agp-stats">
        <div className="agp-stat">
          <span className="agp-stat-value">{activeMembers.length}</span>
          <span className="agp-stat-label">Members</span>
        </div>
        {founded && (
          <div className="agp-stat">
            <span className="agp-stat-value">{founded}</span>
            <span className="agp-stat-label">Founded</span>
          </div>
        )}
        {agency.stats?.avgRating && (
          <div className="agp-stat">
            <span className="agp-stat-value">{agency.stats.avgRating}</span>
            <span className="agp-stat-label">Avg Rating</span>
          </div>
        )}
        {agency.stats?.completedJobs > 0 && (
          <div className="agp-stat">
            <span className="agp-stat-value">{agency.stats.completedJobs}</span>
            <span className="agp-stat-label">Jobs Completed</span>
          </div>
        )}
        {agency.stats?.reviewCount > 0 && (
          <div className="agp-stat">
            <span className="agp-stat-value">{agency.stats.reviewCount}</span>
            <span className="agp-stat-label">Reviews</span>
          </div>
        )}
      </div>

      <div className="agp-content">
        {/* Team Members */}
        {activeMembers.length > 0 && (
          <div className="agp-section">
            <h2 className="agp-section-title">Our Team</h2>
            <div className="agp-members-grid">
              {activeMembers.map(m => {
                const u = m.user || {};
                return (
                  <div key={m._id} className="agp-member-card">
                    {u.profileImage ? (
                      <img src={u.profileImage} alt="" className="agp-member-avatar" />
                    ) : (
                      <div className="agp-member-avatar-placeholder">{u.firstName?.[0]}</div>
                    )}
                    <div className="agp-member-info">
                      <span className="agp-member-name">{u.firstName} {u.lastName}</span>
                      {m.title && <span className="agp-member-title">{m.title}</span>}
                      {u.averageRating > 0 && (
                        <span className="agp-member-rating">
                          {'★'.repeat(Math.round(u.averageRating))} {u.averageRating?.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Portfolio */}
        {agency.portfolio?.length > 0 && (
          <div className="agp-section">
            <h2 className="agp-section-title">Portfolio</h2>
            <div className="agp-portfolio-grid">
              {agency.portfolio.map((p, i) => (
                <div key={i} className="agp-portfolio-card">
                  {p.image && <img src={p.image} alt={p.title} className="agp-portfolio-img" />}
                  <div className="agp-portfolio-body">
                    <h3 className="agp-portfolio-title">{p.title}</h3>
                    {p.description && <p className="agp-portfolio-desc">{p.description}</p>}
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="agp-portfolio-link">
                        View Project →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Services / Specialties */}
        {agency.specialties?.length > 0 && (
          <div className="agp-section">
            <h2 className="agp-section-title">Services</h2>
            <div className="agp-services-list">
              {agency.specialties.map((s, i) => (
                <div key={i} className="agp-service-item">
                  <span className="agp-service-dot" />
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Reviews */}
        {agency.recentReviews?.length > 0 && (
          <div className="agp-section">
            <h2 className="agp-section-title">Client Reviews</h2>
            <div className="agp-reviews">
              {agency.recentReviews.map((r, i) => (
                <div key={i} className="agp-review-card">
                  <div className="agp-review-header">
                    <span className="agp-review-author">{r.reviewer?.firstName} {r.reviewer?.lastName}</span>
                    <span className="agp-review-stars">{'★'.repeat(r.rating || 0)}</span>
                  </div>
                  {r.comment && <p className="agp-review-text">{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA Section */}
        <div className="agp-cta">
          <h2 className="agp-cta-title">Ready to work with {agency.name}?</h2>
          <p className="agp-cta-sub">Get started by reaching out or posting a job for this team.</p>
          <div className="agp-cta-buttons">
            <Link to="/post-job" className="btn btn-primary">Invite to Job</Link>
            <button className="btn btn-secondary" onClick={() => navigate('/agencies')}>
              View on Fetchwork
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgencyPublicProfile;
