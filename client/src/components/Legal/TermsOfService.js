import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../common/SEO';
import './Legal.css';

const TermsOfService = () => (
  <div className="lg-container">
    <SEO title="Terms of Service — FetchWork" description="FetchWork terms of service and user agreement." />
    <h1 className="lg-title">Terms of Service</h1>
    <p className="lg-updated">Last updated: May 21, 2026</p>

    <div className="lg-section">
      <h2>1. Acceptance of Terms</h2>
      <p>By accessing or using FetchWork ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Platform.</p>
    </div>

    <div className="lg-section">
      <h2>2. Eligibility</h2>
      <p>You must be at least 18 years old and capable of forming a binding contract. By registering, you represent that all information you provide is accurate and complete.</p>
    </div>

    <div className="lg-section">
      <h2>3. Account Responsibilities</h2>
      <ul>
        <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
        <li>You are responsible for all activity under your account.</li>
        <li>You must notify us immediately of any unauthorized use.</li>
        <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
      </ul>
    </div>

    <div className="lg-section">
      <h2>4. Platform Services</h2>
      <p>FetchWork connects freelancers with clients. We are a marketplace — not a party to the contracts formed between users. We do not guarantee the quality, safety, or legality of services offered.</p>
      <h3>4.1 Freelancers</h3>
      <p>Freelancers are independent contractors, not employees of FetchWork. You are solely responsible for the services you provide, applicable taxes, and compliance with local laws.</p>
      <h3>4.2 Clients</h3>
      <p>Clients are responsible for clearly defining project requirements and compensating freelancers as agreed. Disputes should first be resolved directly between parties before escalating to FetchWork.</p>
    </div>

    <div className="lg-section">
      <h2>5. Payments &amp; Fees</h2>
      <ul>
        <li>FetchWork charges platform fees on transactions as disclosed at the time of payment.</li>
        <li>Payments are processed through Stripe. By using payment features, you also agree to <a href="https://stripe.com/legal" target="_blank" rel="noopener noreferrer">Stripe's Terms of Service</a>.</li>
        <li>Freelancers receive payouts according to their plan's payout schedule.</li>
        <li>Refunds and disputes are handled per our dispute resolution process.</li>
        <li>FetchWork reserves the right to hold, freeze, or reverse payments in cases of fraud or Terms violations.</li>
      </ul>
    </div>

    <div className="lg-section">
      <h2>6. Subscriptions &amp; Plans</h2>
      <p>Paid plans (Plus, Pro, Business) are billed on a recurring basis. You may cancel at any time; cancellation takes effect at the end of the current billing period. No pro-rated refunds are provided for partial periods.</p>
    </div>

    <div className="lg-section">
      <h2>7. Content &amp; Conduct</h2>
      <ul>
        <li>You retain ownership of content you submit but grant FetchWork a non-exclusive license to display and distribute it on the Platform.</li>
        <li>You must not post content that is illegal, fraudulent, defamatory, or violates third-party rights.</li>
        <li>You agree to follow our <Link to="/community-guidelines">Community Guidelines</Link>.</li>
      </ul>
    </div>

    <div className="lg-section">
      <h2>8. Intellectual Property</h2>
      <p>FetchWork's name, logo, and Platform design are our property. You may not use our branding without written permission. Work product ownership between freelancers and clients should be defined in their service agreements.</p>
    </div>

    <div className="lg-section">
      <h2>9. Limitation of Liability</h2>
      <p>To the maximum extent permitted by law, FetchWork shall not be liable for indirect, incidental, special, consequential, or punitive damages. Our total liability shall not exceed the fees you paid to FetchWork in the 12 months preceding the claim.</p>
    </div>

    <div className="lg-section">
      <h2>10. Indemnification</h2>
      <p>You agree to indemnify FetchWork against claims, damages, and expenses arising from your use of the Platform, violation of these Terms, or infringement of any third-party rights.</p>
    </div>

    <div className="lg-section">
      <h2>11. Dispute Resolution</h2>
      <p>Any disputes arising from these Terms shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association. You waive the right to participate in class action lawsuits.</p>
    </div>

    <div className="lg-section">
      <h2>12. Termination</h2>
      <p>We may suspend or terminate your account at any time for violations of these Terms. Upon termination, your right to use the Platform ceases. Provisions that by their nature should survive termination will survive.</p>
    </div>

    <div className="lg-section">
      <h2>13. Changes to Terms</h2>
      <p>We may update these Terms at any time. Continued use after changes constitutes acceptance. We will notify registered users of material changes via email.</p>
    </div>

    <div className="lg-contact">
      <h2>Questions?</h2>
      <p>Contact us at <a href="mailto:support@fetchwork.net">support@fetchwork.net</a></p>
    </div>

    <nav className="lg-nav">
      <Link to="/privacy-policy">Privacy Policy</Link>
      <Link to="/community-guidelines">Community Guidelines</Link>
    </nav>
  </div>
);

export default TermsOfService;
