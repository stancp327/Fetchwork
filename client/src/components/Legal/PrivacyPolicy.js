import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../common/SEO';
import './Legal.css';

const PrivacyPolicy = () => (
  <div className="lg-container">
    <SEO title="Privacy Policy — FetchWork" description="How FetchWork collects, uses, and protects your personal information." />
    <h1 className="lg-title">Privacy Policy</h1>
    <p className="lg-updated">Last updated: May 21, 2026</p>

    <div className="lg-section">
      <h2>1. Information We Collect</h2>
      <h3>1.1 Information You Provide</h3>
      <ul>
        <li><strong>Account information:</strong> name, email, password, account type</li>
        <li><strong>Profile information:</strong> skills, bio, portfolio, profile photo, location</li>
        <li><strong>Payment information:</strong> processed and stored by Stripe — we do not store card numbers</li>
        <li><strong>Communications:</strong> messages sent through the Platform</li>
        <li><strong>Verification data:</strong> identity documents submitted for verification</li>
      </ul>
      <h3>1.2 Information Collected Automatically</h3>
      <ul>
        <li>Device and browser information</li>
        <li>IP address and approximate location</li>
        <li>Usage data (pages visited, features used, timestamps)</li>
        <li>Cookies and similar technologies</li>
      </ul>
    </div>

    <div className="lg-section">
      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>Providing, maintaining, and improving the Platform</li>
        <li>Processing transactions and sending payment notifications</li>
        <li>Matching freelancers with relevant jobs and clients</li>
        <li>Sending service-related communications (booking confirmations, account alerts)</li>
        <li>Preventing fraud and enforcing our Terms of Service</li>
        <li>Analytics to improve user experience</li>
        <li>Marketing communications (with your consent; you can opt out anytime)</li>
      </ul>
    </div>

    <div className="lg-section">
      <h2>3. Information Sharing</h2>
      <p>We do not sell your personal information. We share data only in these cases:</p>
      <ul>
        <li><strong>With other users:</strong> your public profile, reviews, and service listings are visible to other users</li>
        <li><strong>Service providers:</strong> Stripe (payments), MongoDB (database hosting), Render (hosting), Google (authentication)</li>
        <li><strong>Legal requirements:</strong> when required by law, subpoena, or to protect our rights</li>
        <li><strong>Business transfers:</strong> in connection with a merger, acquisition, or sale of assets</li>
      </ul>
    </div>

    <div className="lg-section">
      <h2>4. Data Security</h2>
      <p>We implement industry-standard security measures including encrypted connections (TLS/SSL), secure password hashing, and access controls. However, no method of transmission over the internet is 100% secure.</p>
    </div>

    <div className="lg-section">
      <h2>5. Data Retention</h2>
      <p>We retain your data for as long as your account is active or as needed to provide services. You can request deletion of your account and associated data at any time. Some data may be retained as required by law (e.g., financial records).</p>
    </div>

    <div className="lg-section">
      <h2>6. Your Rights</h2>
      <p>Depending on your location, you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you</li>
        <li>Correct inaccurate information</li>
        <li>Delete your account and personal data</li>
        <li>Export your data in a portable format</li>
        <li>Opt out of marketing communications</li>
        <li>Withdraw consent where processing is based on consent</li>
      </ul>
    </div>

    <div className="lg-section">
      <h2>7. Cookies</h2>
      <p>We use essential cookies for authentication and session management. We may use analytics cookies to understand Platform usage. You can control cookie preferences through your browser settings.</p>
    </div>

    <div className="lg-section">
      <h2>8. Children's Privacy</h2>
      <p>FetchWork is not intended for users under 18. We do not knowingly collect information from minors. If we learn that we have collected data from a user under 18, we will delete it promptly.</p>
    </div>

    <div className="lg-section">
      <h2>9. California Residents (CCPA)</h2>
      <p>California residents have additional rights under the CCPA, including the right to know what personal information is collected, request deletion, and opt out of the sale of personal information. We do not sell personal information.</p>
    </div>

    <div className="lg-section">
      <h2>10. Changes to This Policy</h2>
      <p>We may update this Privacy Policy periodically. We will notify you of material changes via email or a notice on the Platform.</p>
    </div>

    <div className="lg-contact">
      <h2>Contact Us</h2>
      <p>For privacy-related questions or to exercise your rights, contact us at <a href="mailto:privacy@fetchwork.net">privacy@fetchwork.net</a></p>
    </div>

    <nav className="lg-nav">
      <Link to="/terms-of-service">Terms of Service</Link>
      <Link to="/community-guidelines">Community Guidelines</Link>
    </nav>
  </div>
);

export default PrivacyPolicy;
