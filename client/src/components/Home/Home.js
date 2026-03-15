import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import { createOrganizationSchema, createWebsiteSchema } from '../../utils/structuredData';
import { CATEGORIES, localCategories, remoteCategories } from '../../utils/categories';
import './Home.css';

const TESTIMONIALS = [
  {
    name: 'Maria T.',
    role: 'Home Owner',
    text: 'Found a great house cleaner in my neighborhood within 2 hours. Verified profile, fair price, and she did an amazing job.',
    avatar: '👩',
    rating: 5,
  },
  {
    name: 'James K.',
    role: 'Startup Founder',
    text: 'Hired a web developer remotely. Had a working prototype in a week. The Secure Payment feature gave me total peace of mind.',
    avatar: '👨‍💼',
    rating: 5,
  },
  {
    name: 'Ana R.',
    role: 'Freelance Designer',
    text: "I've landed 12 clients on FetchWork. The platform handles proposals and payments so I can focus on the actual work.",
    avatar: '👩‍🎨',
    rating: 5,
  },
];

const HOW_CLIENT = [
  { icon: '📋', title: 'Post Your Job', desc: 'Describe what you need. Set your budget, timeline, and whether it\'s local or remote.' },
  { icon: '💬', title: 'Review Proposals', desc: 'Qualified freelancers apply with custom bids. Compare profiles, portfolios, and reviews.' },
  { icon: '✅', title: 'Pay When Done', desc: 'Funds are held securely and released only when you approve the work. Zero risk.' },
];

const HOW_FREELANCER = [
  { icon: '🎯', title: 'Build Your Profile', desc: 'Showcase your skills, portfolio, and services. Get verified to stand out from the crowd.' },
  { icon: '🚀', title: 'Win Jobs & Orders', desc: 'Apply to posted jobs or list your own services. Get hired by clients in your area or anywhere online.' },
  { icon: '💸', title: 'Get Paid Safely', desc: 'Funds are secured before you start. Release happens instantly when the client approves.' },
];

const TRUST = [
  { icon: '🔒', title: 'Secure Payment', desc: 'Funds are held until you approve the work. Full refund if there\'s a dispute before release.' },
  { icon: '⭐', title: 'Verified Reviews', desc: 'Every review is from a real completed job. No fake ratings, ever.' },
  { icon: '📍', title: 'Local & Remote', desc: 'Find in-person help nearby or hire remote talent from anywhere in the world.' },
  { icon: '🛡️', title: 'ID Verified Profiles', desc: 'Freelancers can verify their identity for extra client trust and visibility.' },
];

const Home = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('client'); // 'client' | 'freelancer'
  const [catTab, setCatTab] = useState('all'); // 'all' | 'local' | 'remote'
  // Start with realistic placeholders to avoid above-the-fold layout shift when stats hydrate
  const [stats, setStats] = useState({ jobs: 24, freelancers: 50, services: 35, reviews: 120 });
  const [featuredServices, setFeaturedServices] = useState([]);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  // Static content — no reason to delay, render immediately to prevent layout shift
  const [heroExtrasReady] = useState(true);

  useEffect(() => {
    const loadHomeData = () => {
      apiRequest('/api/stats/public')
        .then(d => setStats({ jobs: d.jobs || 24, freelancers: d.freelancers || 50, services: d.services || 35, reviews: d.reviews || 120 }))
        .catch(() => setStats({ jobs: 24, freelancers: 50, services: 35, reviews: 120 }));

      apiRequest('/api/services?limit=6&status=active')
        .then(d => setFeaturedServices((d.services || d || []).slice(0, 6)))
        .catch(() => {});
    };

    // Defer only the API calls — static content (hero extras) renders immediately now
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(() => {
        loadHomeData();
      }, { timeout: 3000 });
      return () => window.cancelIdleCallback?.(idleId);
    }

    const t = setTimeout(loadHomeData, 1500);
    return () => clearTimeout(t);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (activeTab === 'freelancer') {
      navigate(`/browse-jobs?search=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate(`/browse-services?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const visibleCats = catTab === 'local'
    ? localCategories.slice(0, 8)
    : catTab === 'remote'
      ? remoteCategories.slice(0, 8)
      : CATEGORIES.slice(0, 8);

  const structuredData = [createOrganizationSchema(), createWebsiteSchema()];

  return (
    <>
      <SEO
        title="Hire Local & Remote Freelancers — FetchWork"
        description="Find trusted freelancers for any job — home repair, web design, cleaning, coding, and more. Post a job or list your services. Secure payments, verified reviews."
        keywords="freelance marketplace, hire freelancers, local services, remote work, gig economy, home repair, web design, cleaning"
        structuredData={structuredData}
      />
      <div className="home">

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="hero">
          <div className="hero-bg-decor" aria-hidden="true" />
          <div className="hero-content">
            <div className="hero-badge">🚀 Trusted by freelancers &amp; clients across the US</div>
            <h1 className="hero-title">
              Get anything done,<br />
              <span className="hero-highlight">fast &amp; safely.</span>
            </h1>
            <p className="hero-subtitle">
              From home repair to logo design — find local help or remote talent, with payments secured every step of the way.
            </p>

            {/* Tab switcher */}
            <div className="hero-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === 'client'}
                className={`hero-tab ${activeTab === 'client' ? 'active' : ''}`}
                onClick={() => setActiveTab('client')}
              >
                I need help
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'freelancer'}
                className={`hero-tab ${activeTab === 'freelancer' ? 'active' : ''}`}
                onClick={() => setActiveTab('freelancer')}
              >
                I'm a freelancer
              </button>
            </div>

            <form className="hero-search" onSubmit={handleSearch}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'client' ? 'What do you need done?' : 'What skills do you offer?'}
                className="hero-search-input"
                aria-label="Search"
              />
              <button type="submit" className="hero-search-btn">
                {activeTab === 'client' ? 'Find Help' : 'Find Jobs'}
              </button>
            </form>

            <div className="hero-extras" aria-hidden={!heroExtrasReady}>
              {heroExtrasReady && (
                <>
                  <div className="hero-quick-links">
                    <span className="hero-popular">Popular:</span>
                    {(activeTab === 'client'
                      ? ['Home Cleaning', 'Web Design', 'Moving Help', 'Pet Care', 'Lawn Care']
                      : ['Remote Design', 'Web Dev', 'Tutoring', 'Copywriting', 'Video Editing']
                    ).map(term => (
                      <Link
                        key={term}
                        to={activeTab === 'client'
                          ? `/browse-services?search=${encodeURIComponent(term)}`
                          : `/browse-jobs?search=${encodeURIComponent(term)}`}
                        className="hero-quick-tag"
                      >
                        {term}
                      </Link>
                    ))}
                  </div>

                  {!isAuthenticated && (
                    <div className="hero-actions">
                      {activeTab === 'client' ? (
                        <>
                          <Link to="/register" className="btn btn-primary btn-large">Post a Job Free</Link>
                          <Link to="/browse-services" className="btn btn-ghost btn-large">Browse Services</Link>
                        </>
                      ) : (
                        <>
                          <Link to="/register" className="btn btn-primary btn-large">Join as Freelancer</Link>
                          <Link to="/browse-jobs" className="btn btn-ghost btn-large">Browse Jobs</Link>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Stats Bar ─────────────────────────────────────────── */}
        <section className="stats-bar" aria-label="Platform stats">
          <div className="stat-item">
            <span className="stat-number">{stats.jobs}+</span>
            <span className="stat-label">Jobs Posted</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.freelancers}+</span>
            <span className="stat-label">Freelancers</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.services}+</span>
            <span className="stat-label">Services Listed</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.reviews}+</span>
            <span className="stat-label">5-Star Reviews</span>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────────── */}
        <section className="how-it-works">
          <div className="container">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">Simple for everyone — whether you're hiring or offering services</p>

            <div className="hiw-tabs">
              <button
                className={`hiw-tab ${activeTab === 'client' ? 'active' : ''}`}
                onClick={() => setActiveTab('client')}
              >
                👤 For Clients
              </button>
              <button
                className={`hiw-tab ${activeTab === 'freelancer' ? 'active' : ''}`}
                onClick={() => setActiveTab('freelancer')}
              >
                🛠️ For Freelancers
              </button>
            </div>

            <div className="steps-grid">
              {(activeTab === 'client' ? HOW_CLIENT : HOW_FREELANCER).map((step, i) => (
                <div key={i} className="step-card">
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-num">{i + 1}</div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              ))}
            </div>

            <div className="hiw-cta">
              {activeTab === 'client' ? (
                <Link to={isAuthenticated ? '/post-job' : '/register'} className="btn btn-primary">
                  Post Your First Job →
                </Link>
              ) : (
                <Link to={isAuthenticated ? '/profile' : '/register'} className="btn btn-primary">
                  Create Your Profile →
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ── Categories ────────────────────────────────────────── */}
        <section className="home-categories">
          <div className="container">
            <h2 className="section-title">Browse by Category</h2>
            <p className="section-subtitle">Hundreds of services, local and remote</p>

            <div className="cat-filter">
              {['all', 'local', 'remote'].map(t => (
                <button
                  key={t}
                  className={`cat-filter-btn ${catTab === t ? 'active' : ''}`}
                  onClick={() => setCatTab(t)}
                >
                  {t === 'all' ? '🌐 All' : t === 'local' ? '📍 Local' : '💻 Remote'}
                </button>
              ))}
            </div>

            <div className="category-grid">
              {visibleCats.map(cat => (
                <Link
                  key={cat.id}
                  to={`/categories/${cat.id}`}
                  className="category-card"
                >
                  <span className="category-icon">{cat.icon}</span>
                  <span className="category-name">{cat.label}</span>
                  {cat.type !== 'both' && (
                    <span className={`cat-type-badge cat-type-${cat.type}`}>
                      {cat.type === 'local' ? '📍 Local' : '💻 Remote'}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            <div className="section-more">
              <Link to="/browse-services" className="link-more">Explore all services →</Link>
              <Link to="/browse-jobs" className="link-more" style={{ marginLeft: '1.5rem' }}>Browse all jobs →</Link>
            </div>
          </div>
        </section>

        {/* ── Why FetchWork ─────────────────────────────────────── */}
        <section className="features">
          <div className="container">
            <h2 className="section-title">Why FetchWork?</h2>
            <p className="section-subtitle">Built for trust — for both sides of every job</p>
            <div className="features-grid">
              {TRUST.map((f, i) => (
                <div key={i} className="feature-card">
                  <div className="feature-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Featured Services ──────────────────────────────────── */}
        <section className="featured-services">
          <div className="container">
            <h2 className="section-title">Featured Services</h2>
            <p className="section-subtitle">Top-rated freelancers ready to work</p>
            <div className="fs-grid">
              {/* Always render 6 slots — real cards or skeletons — so grid height never changes */}
              {Array.from({ length: 6 }).map((_, idx) => {
                const svc = featuredServices[idx];
                if (svc) {
                  return (
                    <Link key={svc._id} to={`/services/${svc._id}`} className="fs-card">
                      {svc.gallery?.[0]?.url ? (
                        <img src={svc.gallery[0].url} alt={svc.title} className="fs-img" loading="lazy" width="320" height="160" decoding="async" />
                      ) : (
                        <div className="fs-img-placeholder">
                          {CATEGORIES.find(c => c.id === svc.category)?.icon || '🛠️'}
                        </div>
                      )}
                      <div className="fs-body">
                        <p className="fs-freelancer">{svc.freelancer?.firstName} {svc.freelancer?.lastName}</p>
                        <h3 className="fs-title">{svc.title}</h3>
                        <div className="fs-meta">
                          {svc.rating > 0 && (
                            <span className="fs-rating">⭐ {svc.rating?.toFixed(1)}</span>
                          )}
                          <span className="fs-price">
                            Starting at <strong>${svc.pricing?.basic?.price || '—'}</strong>
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                }
                return (
                  <div key={`skel-${idx}`} className="fs-card skeleton" aria-hidden="true">
                    <div className="fs-img-placeholder skeleton-img"></div>
                    <div className="fs-body">
                      <p className="fs-freelancer skeleton-text"></p>
                      <h3 className="fs-title skeleton-text"></h3>
                      <div className="fs-meta">
                        <span className="fs-rating skeleton-text"></span>
                        <span className="fs-price skeleton-text"></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="section-more">
              <Link to="/browse-services" className="link-more">View all services →</Link>
            </div>
          </div>
        </section>

        {/* ── Testimonials ──────────────────────────────────────── */}
        <section className="testimonials">
          <div className="container">
            <h2 className="section-title">What People Are Saying</h2>
            <div className="testimonial-carousel">
              <div className="testimonial-card">
                <div className="testimonial-stars">{'⭐'.repeat(TESTIMONIALS[testimonialIdx].rating)}</div>
                <p className="testimonial-text">"{TESTIMONIALS[testimonialIdx].text}"</p>
                <div className="testimonial-author">
                  <span className="testimonial-avatar">{TESTIMONIALS[testimonialIdx].avatar}</span>
                  <div>
                    <strong>{TESTIMONIALS[testimonialIdx].name}</strong>
                    <span className="testimonial-role">{TESTIMONIALS[testimonialIdx].role}</span>
                  </div>
                </div>
              </div>
              <div className="testimonial-dots">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    className={`t-dot ${i === testimonialIdx ? 'active' : ''}`}
                    onClick={() => setTestimonialIdx(i)}
                    aria-label={`Testimonial ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────── */}
        <section className="cta-section">
          <div className="container">
            <div className="cta-split">
              <div className="cta-card cta-client">
                <div className="cta-card-icon">🏠</div>
                <h3>Need something done?</h3>
                <p>Post a job for free and get proposals from qualified freelancers within hours.</p>
                <Link to={isAuthenticated ? '/post-job' : '/register'} className="btn btn-white">
                  Post a Job Free →
                </Link>
              </div>
              <div className="cta-card cta-freelancer">
                <div className="cta-card-icon">💼</div>
                <h3>Ready to earn?</h3>
                <p>Create your profile, list your services, and start getting paid for what you're good at.</p>
                <Link to={isAuthenticated ? '/profile' : '/register'} className="btn btn-white">
                  Start Earning →
                </Link>
              </div>
            </div>
          </div>
        </section>

      </div>
    </>
  );
};

export default Home;
