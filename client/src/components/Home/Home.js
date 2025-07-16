import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  return (
    <div className="home">
      <div className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="brand-icon">⚡</span>
            Welcome to FetchWork
          </h1>
          <p className="hero-subtitle">
            All-in-one freelance platform for remote and local services
          </p>
          <p className="hero-description">
            Connect with talented freelancers or find your next opportunity. 
            Secure payments, real-time messaging, and AI-powered matching.
          </p>
          
          <div className="hero-actions">
            <Link to="/browse-jobs" className="cta-button primary">
              Browse Jobs
            </Link>
            <Link to="/post-job" className="cta-button secondary">
              Post a Job
            </Link>
          </div>
        </div>
      </div>

      <div className="features-section">
        <div className="container">
          <h2>Why Choose FetchWork?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Smart Matching</h3>
              <p>AI-powered system connects you with the perfect freelancers or jobs based on skills and requirements.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Secure Payments</h3>
              <p>Escrow system ensures safe transactions. Money is held until work is completed to satisfaction.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>Real-time Chat</h3>
              <p>Built-in messaging system with file sharing and notifications keeps projects moving smoothly.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">⭐</div>
              <h3>Rating System</h3>
              <p>Transparent reviews and ratings help build trust and showcase quality work.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🛡️</div>
              <h3>Verified Profiles</h3>
              <p>Email and SMS verification plus identity checks ensure authentic, reliable users.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Project Management</h3>
              <p>Built-in tools for tracking progress, deadlines, and deliverables in one place.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-number">10K+</div>
              <div className="stat-label">Active Freelancers</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">5K+</div>
              <div className="stat-label">Projects Completed</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">98%</div>
              <div className="stat-label">Client Satisfaction</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">24/7</div>
              <div className="stat-label">Support Available</div>
            </div>
          </div>
        </div>
      </div>

      <div className="cta-section">
        <div className="container">
          <h2>Ready to Get Started?</h2>
          <p>Join thousands of freelancers and clients who trust FetchWork for their projects.</p>
          <div className="cta-buttons">
            <Link to="/register" className="cta-button primary large">
              Sign Up Now
            </Link>
            <Link to="/dashboard" className="cta-button secondary large">
              Explore Platform
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
