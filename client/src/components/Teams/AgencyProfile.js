import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './TeamsPage.css';

const AgencyProfile = () => {
  const { slug } = useParams();
  const [agency, setAgency] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest(`/api/teams/agency/${slug}`)
      .then(data => setAgency(data.agency))
      .catch(() => setAgency(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="teams-page"><div className="teams-loading">Loading agency…</div></div>;
  if (!agency) return <div className="teams-page"><div className="teams-empty"><h3>Agency not found</h3></div></div>;

  const activeMembers = agency.members?.filter(m => m.status === 'active') || [];

  return (
    <div className="teams-page" style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        {agency.logo ? (
          <img src={agency.logo} alt="" style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover' }} />
        ) : (
          <div className="team-logo-placeholder" style={{ width: 80, height: 80, fontSize: '2.5rem' }}>{agency.name[0]}</div>
        )}
        <div>
          <h1 style={{ margin: 0 }}>{agency.name}</h1>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <span className="team-type-badge">🏢 Agency</span>
            <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>{activeMembers.length} members</span>
            {agency.stats?.avgRating && (
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>⭐ {agency.stats.avgRating} ({agency.stats.reviewCount} reviews)</span>
            )}
            {agency.stats?.completedJobs > 0 && (
              <span style={{ color: '#22c55e', fontSize: '0.9rem' }}>✅ {agency.stats.completedJobs} jobs completed</span>
            )}
          </div>
        </div>
      </div>

      {agency.description && <p style={{ fontSize: '1rem', lineHeight: 1.6, color: '#374151', marginBottom: '1.5rem' }}>{agency.description}</p>}

      {/* Specialties */}
      {agency.specialties?.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>Specialties</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {agency.specialties.map((s, i) => (
              <span key={i} style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem' }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Team Members */}
      <div style={{ marginBottom: '2rem' }}>
        <h3>Our Team</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {activeMembers.map(m => {
            const u = m.user || {};
            return (
              <div key={m._id} style={{ background: '#f8fafc', borderRadius: 12, padding: '1rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                {u.profileImage ? (
                  <img src={u.profileImage} alt="" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 0.5rem' }} />
                ) : (
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, margin: '0 auto 0.5rem' }}>
                    {u.firstName?.[0]}
                  </div>
                )}
                <div style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</div>
                {m.title && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{m.title}</div>}
                {u.averageRating > 0 && <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>⭐ {u.averageRating?.toFixed(1)}</div>}
                <Link to={`/profile/${u._id}`} style={{ fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none' }}>View Profile →</Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Portfolio */}
      {agency.portfolio?.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>Portfolio</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {agency.portfolio.map((p, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                {p.image && <img src={p.image} alt="" style={{ width: '100%', height: 160, objectFit: 'cover' }} />}
                <div style={{ padding: '0.75rem' }}>
                  <h4 style={{ margin: '0 0 0.25rem' }}>{p.title}</h4>
                  {p.description && <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>{p.description}</p>}
                  {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#3b82f6' }}>View Project →</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Reviews */}
      {agency.recentReviews?.length > 0 && (
        <div>
          <h3>Recent Reviews</h3>
          {agency.recentReviews.map((r, i) => (
            <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: '1rem', marginBottom: '0.75rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>{r.reviewer?.firstName} {r.reviewer?.lastName}</span>
                <span style={{ color: '#f59e0b' }}>{'⭐'.repeat(r.rating || 0)}</span>
              </div>
              {r.comment && <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151' }}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Contact */}
      <div style={{ textAlign: 'center', marginTop: '2rem', padding: '2rem', background: '#f0f9ff', borderRadius: 12 }}>
        <h3>Interested in working with {agency.name}?</h3>
        <Link to="/post-job" className="btn btn-primary">Post a Job</Link>
      </div>
    </div>
  );
};

export default AgencyProfile;
