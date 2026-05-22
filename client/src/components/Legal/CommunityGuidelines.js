import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../common/SEO';
import './Legal.css';

const CommunityGuidelines = () => (
  <div className="lg-container">
    <SEO title="Community Guidelines — FetchWork" description="FetchWork community standards and expected behavior." />
    <h1 className="lg-title">Community Guidelines</h1>
    <p className="lg-updated">Last updated: May 21, 2026</p>

    <div className="lg-section">
      <h2>Our Mission</h2>
      <p>FetchWork is built on trust. These guidelines exist to keep the Platform safe, fair, and productive for everyone — freelancers and clients alike.</p>
    </div>

    <div className="lg-section">
      <h2>Be Professional</h2>
      <ul>
        <li>Communicate clearly and respectfully in all interactions</li>
        <li>Deliver work on time and as described</li>
        <li>Respond to messages in a timely manner</li>
        <li>Provide accurate information in your profile and listings</li>
        <li>Honor your commitments — if you accept a job or booking, follow through</li>
      </ul>
    </div>

    <div className="lg-section">
      <h2>Be Honest</h2>
      <ul>
        <li>Do not misrepresent your skills, experience, or qualifications</li>
        <li>Do not create fake reviews or manipulate ratings</li>
        <li>Do not use fake identities or impersonate others</li>
        <li>Accurately describe the services you offer and the work you need done</li>
        <li>Disclose any conflicts of interest</li>
      </ul>
    </div>

    <div className="lg-section">
      <h2>Be Respectful</h2>
      <ul>
        <li>No harassment, bullying, threats, or intimidation</li>
        <li>No discrimination based on race, gender, religion, sexual orientation, disability, or any other protected characteristic</li>
        <li>No hate speech or content that promotes violence</li>
        <li>Keep feedback constructive — reviews should be honest and helpful</li>
      </ul>
    </div>

    <div className="lg-section">
      <h2>Play Fair</h2>
      <ul>
        <li>Do not attempt to circumvent FetchWork fees by taking transactions off-platform</li>
        <li>Do not spam users with unsolicited messages or proposals</li>
        <li>Do not use bots or automated tools to gain unfair advantages</li>
        <li>Do not post duplicate listings to game search results</li>
        <li>Respect intellectual property — only share work you have the right to use</li>
      </ul>
    </div>

    <div className="lg-section">
      <h2>Keep It Safe</h2>
      <ul>
        <li>Do not share personal information (phone numbers, addresses) in public listings</li>
        <li>Do not request or offer services that are illegal in your jurisdiction</li>
        <li>Report suspicious activity or users who violate these guidelines</li>
        <li>Do not share login credentials with others</li>
      </ul>
    </div>

    <div className="lg-section">
      <h2>Prohibited Content</h2>
      <ul>
        <li>Adult or sexually explicit material</li>
        <li>Weapons, drugs, or regulated substances</li>
        <li>Gambling or financial schemes</li>
        <li>Services that violate others' privacy or terms of service</li>
        <li>Academic dishonesty (e.g., writing someone's thesis)</li>
      </ul>
    </div>

    <div className="lg-section">
      <h2>Enforcement</h2>
      <p>Violations may result in:</p>
      <ul>
        <li><strong>Warning:</strong> for first-time or minor violations</li>
        <li><strong>Content removal:</strong> listings or reviews that violate guidelines</li>
        <li><strong>Account suspension:</strong> temporary restriction of Platform access</li>
        <li><strong>Account termination:</strong> permanent removal for serious or repeated violations</li>
        <li><strong>Payment hold or reversal:</strong> in cases of fraud or misconduct</li>
      </ul>
      <p>We review reports on a case-by-case basis. If your account is suspended, you may appeal by contacting support.</p>
    </div>

    <div className="lg-section">
      <h2>Reporting Violations</h2>
      <p>If you encounter behavior that violates these guidelines, please report it through the Platform's dispute system or contact us directly. All reports are reviewed confidentially.</p>
    </div>

    <div className="lg-contact">
      <h2>Questions?</h2>
      <p>Contact us at <a href="mailto:support@fetchwork.net">support@fetchwork.net</a></p>
    </div>

    <nav className="lg-nav">
      <Link to="/terms-of-service">Terms of Service</Link>
      <Link to="/privacy-policy">Privacy Policy</Link>
    </nav>
  </div>
);

export default CommunityGuidelines;
