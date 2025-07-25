import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-section">
            <h3 className="footer-title">FetchWork</h3>
            <p className="footer-description">
              Connecting talented freelancers with clients worldwide. 
              Build your career or find the perfect talent for your project.
            </p>
          </div>
          
          <div className="footer-section">
            <h4 className="footer-heading">For Freelancers</h4>
            <ul className="footer-links">
              <li><a href="/browse-jobs">Browse Jobs</a></li>
              <li><a href="/dashboard">Dashboard</a></li>
              <li><a href="/profile">Profile</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4 className="footer-heading">For Clients</h4>
            <ul className="footer-links">
              <li><a href="/post-job">Post a Job</a></li>
              <li><a href="/browse-services">Browse Services</a></li>
              <li><a href="/dashboard">Dashboard</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4 className="footer-heading">Support</h4>
            <ul className="footer-links">
              <li><a href="/help">Help Center</a></li>
              <li><a href="/contact">Contact Us</a></li>
              <li><a href="/terms">Terms of Service</a></li>
              <li><a href="/privacy">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; 2025 FetchWork. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
