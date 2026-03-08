import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="ft-footer">
      <div className="ft-footer-container">
        <div className="ft-footer-content">
          <div className="ft-footer-section">
            <h3 className="ft-footer-title">FetchWork</h3>
            <p className="ft-footer-description">
              Connecting talented freelancers with clients worldwide. 
              Build your career or find the perfect talent for your project.
            </p>
          </div>
          
          <div className="ft-footer-section">
            <h4 className="ft-footer-heading">For Freelancers</h4>
            <ul className="ft-footer-links">
              <li><a href="/browse-jobs">Browse Jobs</a></li>
              <li><a href="/dashboard">Dashboard</a></li>
              <li><a href="/profile">Profile</a></li>
            </ul>
          </div>
          
          <div className="ft-footer-section">
            <h4 className="ft-footer-heading">For Clients</h4>
            <ul className="ft-footer-links">
              <li><a href="/post-job">Post a Job</a></li>
              <li><a href="/browse-services">Browse Services</a></li>
              <li><a href="/dashboard">Dashboard</a></li>
            </ul>
          </div>
          
          <div className="ft-footer-section">
            <h4 className="ft-footer-heading">Support</h4>
            <ul className="ft-footer-links">
              <li><a href="/support">Help Center</a></li>
              <li><a href="/contact">Contact Us</a></li>
              <li><a href="/pricing">Pricing</a></li>
              <li><a href="/register">Get Started</a></li>
            </ul>
          </div>
        </div>
        
        <div className="ft-footer-bottom">
          <p>&copy; 2025 FetchWork. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
