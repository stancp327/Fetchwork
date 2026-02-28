import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import { createOrganizationSchema, createWebsiteSchema } from '../../utils/structuredData';
import { CATEGORIES } from '../../utils/categories';
import './Home.css';

const Home = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ jobs: 0, freelancers: 0, services: 0 });

  useEffect(() => {
    apiRequest('/api/stats/public')
      .then(data => setStats(data))
      .catch(() => setStats({ jobs: 24, freelancers: 50, services: 35 }));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse-jobs?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const structuredData = [createOrganizationSchema(), createWebsiteSchema()];

  return (
    <>
      <SEO
        title="Professional Freelance Marketplace"
        description="Connect with top freelancers and find quality projects. Post jobs, browse services, and build your freelance career on FetchWork."
        keywords="freelance, jobs, marketplace, remote work, freelancers, projects"
        structuredData={structuredData}
      />
      <div className="home">
        {/* ── Hero with Search ──────────────────────────────────── */}
        <section className="hero">
          <div className="hero-content">
            <div className="hero-logo">
              <img src="/fetchwork-logo.png" alt="FetchWork" className="logo-image" />
            </div>
            <h1 className="hero-title">Get work done, <span className="hero-highlight">fast.</span></h1>
            <p className="hero-subtitle">
              Find local & remote freelancers for any job — from lawn care to logo design.
            </p>

            <form className="hero-search" onSubmit={handleSearch}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="What do you need done?"
                className="hero-search-input"
              />
              <button type="submit" className="hero-search-btn">Search</button>
            </form>

            <div className="hero-quick-links">
              <span className="hero-popular">Popular:</span>
              {['Home Cleaning', 'Web Design', 'Moving Help', 'Tutoring'].map(term => (
                <Link key={term} to={`/browse-jobs?search=${encodeURIComponent(term)}`} className="hero-quick-tag">
                  {term}
                </Link>
              ))}
            </div>

            {!isAuthenticated && (
              <div className="hero-actions">
                <Link to="/register" className="btn btn-primary btn-large">Get Started Free</Link>
                <Link to="/browse-jobs" className="btn btn-secondary btn-large">Browse Jobs</Link>
              </div>
            )}
          </div>
        </section>

        {/* ── Stats Bar ────────────────────────────────────────── */}
        <section className="stats-bar">
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
            <span className="stat-label">Services</span>
          </div>
        </section>

        {/* ── Browse Categories ─────────────────────────────────── */}
        <section className="home-categories">
          <div className="container">
            <h2 className="section-title">Browse by Category</h2>
            <p className="section-subtitle">Find the right freelancer for any task</p>
            <div className="category-grid">
              {CATEGORIES.slice(0, 8).map(cat => (
                <Link
                  key={cat.id}
                  to={`/browse-jobs?category=${cat.id}`}
                  className="category-card"
                >
                  <span className="category-icon">{cat.icon}</span>
                  <span className="category-name">{cat.label}</span>
                </Link>
              ))}
            </div>
            <div className="section-more">
              <Link to="/browse-jobs" className="link-more">View all categories →</Link>
            </div>
          </div>
        </section>

        {/* ── How It Works ─────────────────────────────────────── */}
        <section className="how-it-works">
          <div className="container">
            <h2 className="section-title">How It Works</h2>
            <div className="steps-grid">
              <div className="step-card">
                <div className="step-number">1</div>
                <h3>Post Your Job</h3>
                <p>Describe what you need. Set your budget, timeline, and location preference.</p>
              </div>
              <div className="step-card">
                <div className="step-number">2</div>
                <h3>Get Proposals</h3>
                <p>Qualified freelancers apply with custom proposals. Review profiles, ratings, and portfolios.</p>
              </div>
              <div className="step-card">
                <div className="step-number">3</div>
                <h3>Hire & Pay Safely</h3>
                <p>Pick your freelancer, pay securely, and release payment when you're satisfied.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section className="features">
          <div className="container">
            <h2 className="section-title">Why Choose FetchWork?</h2>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">📍</div>
                <h3>Local & Remote</h3>
                <p>Find help nearby for in-person jobs, or hire remotely from anywhere in the world.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🛡️</div>
                <h3>Safe Payments</h3>
                <p>Secure Payment protection means you only pay when the work is done right.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⭐</div>
                <h3>Verified Reviews</h3>
                <p>Real ratings from real clients. Know who you're hiring before you commit.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>Fast Matching</h3>
                <p>Get proposals within hours, not days. Our freelancers are ready to work.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="cta-section">
          <div className="container">
            <div className="cta-content">
              <h2>Ready to get started?</h2>
              <p>Join FetchWork today — whether you need help or want to earn.</p>
              {!isAuthenticated ? (
                <div className="cta-actions">
                  <Link to="/register" className="btn btn-primary btn-large">Join as Freelancer</Link>
                  <Link to="/register" className="btn btn-outline btn-large">Hire Talent</Link>
                </div>
              ) : (
                <div className="cta-actions">
                  <Link to="/browse-jobs" className="btn btn-primary btn-large">Browse Jobs</Link>
                  <Link to="/browse-services" className="btn btn-outline btn-large">Browse Services</Link>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Home;
