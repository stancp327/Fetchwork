import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './CategoryLanding.css';

const formatBudget = (budget) => {
  if (!budget) return null;
  if (budget.min && budget.max) return `$${budget.min}–$${budget.max}`;
  if (budget.min) return `From $${budget.min}`;
  if (budget.max) return `Up to $${budget.max}`;
  return null;
};

const CategoryLanding = () => {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    apiRequest(`/api/categories/${categoryId}/overview`)
      .then(d => setData(d))
      .catch(err => setError(err.message || 'Failed to load category'))
      .finally(() => setLoading(false));
  }, [categoryId]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/browse-jobs?search=${encodeURIComponent(searchQuery)}&category=${categoryId}`);
  };

  if (loading) return <div className="cat-state"><div className="cat-spinner" /><p>Loading...</p></div>;
  if (error)   return <div className="cat-state"><p className="cat-err">{error}</p><Link to="/">← Back to Home</Link></div>;
  if (!data)   return null;

  const { category, stats, jobs, services, freelancers } = data;
  const label = category.label || categoryId.replace(/_/g, ' ');
  const icon  = category.icon || '📋';

  return (
    <>
      <SEO
        title={`${label} Freelancers & Services — FetchWork`}
        description={`Find top ${label.toLowerCase()} freelancers. Browse ${stats.serviceCount} services and ${stats.jobCount} open jobs. Hire locally or remotely on FetchWork.`}
        keywords={`${label.toLowerCase()}, freelance ${label.toLowerCase()}, hire ${label.toLowerCase()}, ${label.toLowerCase()} services`}
      />

      <div className="cat-page">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="cat-hero">
          <div className="cat-hero-inner">
            <Link to="/" className="cat-back">← All Categories</Link>
            <div className="cat-hero-icon">{icon}</div>
            <h1>{label}</h1>
            <p className="cat-hero-sub">
              {stats.jobCount} open jobs · {stats.serviceCount} services available
            </p>
            <form className="cat-search" onSubmit={handleSearch}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()} jobs or services...`}
                className="cat-search-input"
              />
              <button type="submit" className="cat-search-btn">Search</button>
            </form>
            <div className="cat-quick-actions">
              <Link to={`/browse-jobs?category=${categoryId}`} className="btn btn-primary-sm">Browse Jobs</Link>
              <Link to={`/browse-services?category=${categoryId}`} className="btn btn-outline-sm">Browse Services</Link>
              <Link to="/post-job" className="btn btn-outline-sm">Post a Job</Link>
            </div>
          </div>
        </section>

        <div className="cat-body container">

          {/* ── Top Services ─────────────────────────────────── */}
          {services.length > 0 && (
            <section className="cat-section">
              <div className="cat-section-header">
                <h2>Top {label} Services</h2>
                <Link to={`/browse-services?category=${categoryId}`} className="cat-see-all">See all →</Link>
              </div>
              <div className="cat-services-grid">
                {services.map(svc => (
                  <Link key={svc._id} to={`/services/${svc._id}`} className="cat-svc-card">
                    {svc.gallery?.[0]?.url ? (
                      <img src={svc.gallery[0].url} alt={svc.title} className="cat-svc-img" loading="lazy" />
                    ) : (
                      <div className="cat-svc-img-placeholder">{icon}</div>
                    )}
                    <div className="cat-svc-body">
                      <p className="cat-svc-provider">
                        {svc.freelancer?.firstName} {svc.freelancer?.lastName}
                      </p>
                      <h4 className="cat-svc-title">{svc.title}</h4>
                      <div className="cat-svc-meta">
                        {svc.rating > 0 && (
                          <span className="cat-svc-rating">⭐ {svc.rating.toFixed(1)} ({svc.totalReviews})</span>
                        )}
                        <span className="cat-svc-price">
                          From <strong>${svc.pricing?.basic?.price || '—'}</strong>
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Open Jobs ────────────────────────────────────── */}
          {jobs.length > 0 && (
            <section className="cat-section">
              <div className="cat-section-header">
                <h2>Recent {label} Jobs</h2>
                <Link to={`/browse-jobs?category=${categoryId}`} className="cat-see-all">See all →</Link>
              </div>
              <div className="cat-jobs-list">
                {jobs.map(job => (
                  <Link key={job._id} to={`/jobs/${job._id}`} className="cat-job-card">
                    <div className="cat-job-main">
                      <h4>{job.title}</h4>
                      <div className="cat-job-meta">
                        {formatBudget(job.budget) && (
                          <span className="cat-job-budget">{formatBudget(job.budget)}</span>
                        )}
                        {job.location?.city && (
                          <span className="cat-job-loc">📍 {job.location.city}</span>
                        )}
                        <span className="cat-job-proposals">{job.proposalCount || 0} proposals</span>
                      </div>
                    </div>
                    <span className="cat-job-status">Open</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Top Freelancers ──────────────────────────────── */}
          {freelancers.length > 0 && (
            <section className="cat-section">
              <div className="cat-section-header">
                <h2>Top {label} Freelancers</h2>
                <Link to={`/freelancers?category=${categoryId}`} className="cat-see-all">See all →</Link>
              </div>
              <div className="cat-freelancers-grid">
                {freelancers.map(f => (
                  <Link key={f._id} to={`/profile/${f._id}`} className="cat-fl-card">
                    <img
                      src={f.profilePicture || '/default-avatar.png'}
                      alt={`${f.firstName} ${f.lastName}`}
                      className="cat-fl-avatar"
                      loading="lazy"
                    />
                    <div className="cat-fl-info">
                      <strong>{f.firstName} {f.lastName}</strong>
                      {f.rating > 0 && (
                        <span className="cat-fl-rating">⭐ {Number(f.rating).toFixed(1)}</span>
                      )}
                      {f.location?.city && (
                        <span className="cat-fl-loc">📍 {f.location.city}</span>
                      )}
                      {f.totalJobs > 0 && (
                        <span className="cat-fl-jobs">{f.totalJobs} jobs done</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Empty state ──────────────────────────────────── */}
          {jobs.length === 0 && services.length === 0 && (
            <div className="cat-empty">
              <div className="cat-empty-icon">{icon}</div>
              <h3>Be the first in {label}</h3>
              <p>No jobs or services yet — post a job or list your services to get started.</p>
              <div className="cat-empty-actions">
                <Link to="/post-job" className="btn btn-primary-sm">Post a Job</Link>
                <Link to="/services/create" className="btn btn-outline-sm">List a Service</Link>
              </div>
            </div>
          )}

          {/* ── SEO copy ─────────────────────────────────────── */}
          <section className="cat-seo-block">
            <h2>Hire {label} Freelancers on FetchWork</h2>
            <p>
              FetchWork connects you with verified {label.toLowerCase()} professionals — whether you need local in-person help
              or remote talent from anywhere. Browse real reviews, compare rates, and pay securely. Every payment is
              protected: funds are held until you approve the work, with full refund protection if there's a dispute.
            </p>
            <p>
              Freelancers: ready to offer your {label.toLowerCase()} skills? Create a free profile, list your services,
              and start getting hired today.
            </p>
          </section>

        </div>
      </div>
    </>
  );
};

export default CategoryLanding;
