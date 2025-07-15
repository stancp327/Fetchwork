import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="home-page">
      <section className="hero-section">
        <h1>FetchWork</h1>
        <p>All-in-one freelance platform for remote and local services</p>
        <div className="hero-buttons">
          <Link to="/browse" className="btn">Browse Services</Link>
          <Link to="/post-job" className="btn btn-secondary">Post a Job</Link>
        </div>
      </section>

      <section className="page-container">
        <div className="features-section">
          <h2>Why Choose FetchWork?</h2>
          <div className="grid grid-3">
            <div className="card">
              <h3>🔒 Secure Payments</h3>
              <p>Escrow system protects both clients and freelancers. Money is held safely until work is completed.</p>
            </div>
            <div className="card">
              <h3>💬 Direct Communication</h3>
              <p>Built-in messaging system with file sharing and real-time notifications.</p>
            </div>
            <div className="card">
              <h3>⭐ Quality Guarantee</h3>
              <p>Rating and review system ensures high-quality work and reliable service providers.</p>
            </div>
            <div className="card">
              <h3>🌍 Global Reach</h3>
              <p>Connect with talented freelancers and clients from around the world.</p>
            </div>
            <div className="card">
              <h3>🛡️ Content Protection</h3>
              <p>Digital watermarks and anti-theft measures protect your intellectual property.</p>
            </div>
            <div className="card">
              <h3>🤖 AI Support</h3>
              <p>Smart chatbot handles common questions and routes complex issues to human support.</p>
            </div>
          </div>
        </div>

        <div className="cta-section">
          <h2>Ready to Get Started?</h2>
          <p>Join thousands of freelancers and clients who trust FetchWork for their projects.</p>
          <div className="cta-buttons">
            <Link to="/signup" className="btn">Sign Up as Freelancer</Link>
            <Link to="/signup" className="btn btn-secondary">Sign Up as Client</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
