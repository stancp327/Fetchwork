import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SEO from '../common/SEO';
import { createOrganizationSchema, createWebsiteSchema } from '../../utils/structuredData';
import './Home.css';

const Home = () => {
  const { isAuthenticated } = useAuth();
  
  const structuredData = [
    createOrganizationSchema(),
    createWebsiteSchema()
  ];

  return (
    <>
      <SEO 
        title="Professional Freelance Marketplace"
        description="Connect with top freelancers and find quality projects. Post jobs, browse services, and build your freelance career on FetchWork."
        keywords="freelance, jobs, marketplace, remote work, freelancers, projects"
        structuredData={structuredData}
      />
      <div className="home">
      <section className="hero">
        <div className="hero-content">
          <div className="hero-logo">
            <img src="/fetchwork-logo.png" alt="FetchWork" className="logo-image" />
            <h1 className="hero-title">FetchWork</h1>
          </div>
          <p className="hero-subtitle">
            The all-in-one freelance platform connecting talented professionals with clients worldwide
          </p>
          <div className="hero-actions">
            {!isAuthenticated ? (
              <>
                <Link to="/register" className="btn btn-primary btn-large">
                  Get Started Free
                </Link>
                <Link to="/login" className="btn btn-secondary btn-large">
                  Sign In
                </Link>
              </>
            ) : (
              <Link to="/dashboard" className="btn btn-primary btn-large">
                Go to Dashboard
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2 className="section-title">Why Choose FetchWork?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">💼</div>
              <h3>Find Quality Jobs</h3>
              <p>Browse thousands of projects from verified clients across all industries and skill levels.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🛠️</div>
              <h3>Offer Your Services</h3>
              <p>Create service listings and let clients come to you. Set your own rates and showcase your expertise.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>Seamless Communication</h3>
              <p>Built-in messaging system keeps all project communication organized and professional.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⭐</div>
              <h3>Build Your Reputation</h3>
              <p>Earn reviews and ratings that help you stand out and attract more high-quality clients.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Start Your Freelance Journey?</h2>
            <p>Join thousands of freelancers and clients who trust FetchWork for their projects</p>
            {!isAuthenticated ? (
              <div className="cta-actions">
                <Link to="/register" className="btn btn-primary btn-large">
                  Join as Freelancer
                </Link>
                <Link to="/register" className="btn btn-outline btn-large">
                  Hire Talent
                </Link>
              </div>
            ) : (
              <div className="cta-actions">
                <Link to="/browse-jobs" className="btn btn-primary btn-large">
                  Browse Jobs
                </Link>
                <Link to="/browse-services" className="btn btn-outline btn-large">
                  Browse Services
                </Link>
              </div>
            )}
          </div>
          <div className="chatbot-highlight">
            <p>💬 Need help getting started? Our AI assistant is here to guide you!</p>
          </div>
        </div>
      </section>
    </div>
    </>
  );
};

export default Home;
