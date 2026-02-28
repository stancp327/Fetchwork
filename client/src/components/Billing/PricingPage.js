import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import './PricingPage.css';

// ── Feature check rows per plan ─────────────────────────────────
const FREELANCER_FEATURES = [
  { label: 'Local commission',             free: '$0',          plus: '$0',          pro: '$0' },
  { label: 'Remote freelancer fee',        free: '10%',         plus: '7%',          pro: '5%' },
  { label: 'Active job posts',             free: '3',           plus: '20',          pro: 'Unlimited' },
  { label: 'Service listings',             free: '1',           plus: '5',           pro: 'Unlimited' },
  { label: 'Booking calendar',             free: false,         plus: true,          pro: true },
  { label: 'Recurring billing',            free: false,         plus: true,          pro: true },
  { label: 'Prepaid session bundles',      free: false,         plus: true,          pro: true },
  { label: 'Intake forms',                 free: false,         plus: true,          pro: true },
  { label: 'One-click rebooking',          free: false,         plus: true,          pro: true },
  { label: 'Analytics',                    free: 'Basic totals', plus: 'Standard',   pro: 'Full suite' },
  { label: 'CSV / tax export',             free: false,         plus: true,          pro: true },
  { label: 'Deposits & travel fees',       free: false,         plus: false,         pro: true },
  { label: 'Package expiration rules',     free: false,         plus: false,         pro: true },
  { label: 'Featured placement eligible',  free: false,         plus: false,         pro: true },
  { label: 'Faster payout',               free: false,         plus: true,          pro: '⚡ Priority' },
  { label: 'Support',                      free: 'Standard',    plus: 'Priority',    pro: 'Priority' },
];

const CLIENT_FEATURES = [
  { label: 'Remote client fee',            free: '5%',          plus: '3%',          pro: '2%' },
  { label: 'Local booking fee (under $50)', free: '$4',         plus: '$3',          pro: '$2' },
  { label: 'Local booking fee ($50–$150)', free: '$6',          plus: '$4',          pro: '$3' },
  { label: 'Local booking fee ($150–$400)', free: '$10',        plus: '$7',          pro: '$5' },
  { label: 'Local booking fee ($400+)',    free: '$15',          plus: '$10',         pro: '$8' },
  { label: 'Active job posts',             free: '3',           plus: '20',          pro: 'Unlimited' },
  { label: 'Saved providers',              free: false,         plus: true,          pro: true },
  { label: 'Job templates',               free: false,         plus: true,          pro: true },
  { label: 'Proposal comparison',          free: false,         plus: true,          pro: true },
  { label: 'Team accounts',               free: false,         plus: false,         pro: true },
  { label: 'Shared dashboards',           free: false,         plus: false,         pro: true },
  { label: 'Spend reporting',             free: 'Basic',       plus: 'Standard',    pro: 'Full suite' },
  { label: 'CSV export',                  free: false,         plus: true,          pro: true },
  { label: 'Concierge matching',          free: false,         plus: false,         pro: 'Coming soon' },
  { label: 'Support',                     free: 'Standard',    plus: 'Priority',    pro: 'Highest priority' },
];

const CHECK = '✓';
const CROSS = '—';

const CellValue = ({ val }) => {
  if (val === true)  return <span className="pp-check">{CHECK}</span>;
  if (val === false) return <span className="pp-cross">{CROSS}</span>;
  return <span className="pp-text">{val}</span>;
};

const PricingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [audience, setAudience]   = useState('freelancer');
  const [plans, setPlans]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [upgrading, setUpgrading] = useState(null);
  const [error, setError]         = useState('');
  const [billingStatus, setBillingStatus] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') === 'cancelled') {
      setError('Upgrade cancelled — you haven\'t been charged.');
      setTimeout(() => setError(''), 5000);
    }
    // Set default audience based on logged-in user
    if (user?.accountType === 'client') setAudience('client');
  }, [user]);

  useEffect(() => {
    apiRequest(`/api/billing/plans?audience=${audience}`)
      .then(d => setPlans(d.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [audience]);

  useEffect(() => {
    if (!user) return;
    apiRequest('/api/billing/status')
      .then(d => setBillingStatus(d))
      .catch(() => {});
  }, [user]);

  const handleUpgrade = async (planSlug) => {
    if (!user) { navigate('/login?redirect=/pricing'); return; }
    setUpgrading(planSlug);
    setError('');
    try {
      const data = await apiRequest('/api/billing/subscribe', {
        method: 'POST', body: JSON.stringify({ planSlug }),
      });
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err.message || 'Could not start checkout. Please try again.');
      setUpgrading(null);
    }
  };

  const currentPlanSlug = billingStatus?.plan?.slug;
  const features = audience === 'freelancer' ? FREELANCER_FEATURES : CLIENT_FEATURES;

  const plansByTier = {
    free: plans.find(p => p.tier === 'free'),
    plus: plans.find(p => p.tier === 'plus'),
    pro:  plans.find(p => p.tier === 'pro'),
  };

  const tierLabels = {
    freelancer: { plus: 'Plus', pro: 'Pro' },
    client:     { plus: 'Plus', pro: 'Business' },
  };

  return (
    <div className="pricing-page">
      {/* ── Hero ── */}
      <div className="pricing-hero">
        <h1 className="pricing-title">Simple, transparent pricing</h1>
        <p className="pricing-subtitle">No hidden fees. Change or cancel anytime.</p>

        {/* Audience toggle */}
        <div className="pricing-toggle">
          <button
            className={`pricing-toggle-btn ${audience === 'freelancer' ? 'active' : ''}`}
            onClick={() => setAudience('freelancer')}
          >
            👤 I'm a Freelancer
          </button>
          <button
            className={`pricing-toggle-btn ${audience === 'client' ? 'active' : ''}`}
            onClick={() => setAudience('client')}
          >
            🏢 I'm Hiring
          </button>
        </div>
      </div>

      {error && <div className="pricing-error">{error}</div>}

      {/* ── Plan cards ── */}
      {loading ? (
        <div className="pricing-loading">Loading plans…</div>
      ) : (
        <div className="pricing-cards">

          {/* Free */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <div className="pricing-tier-label">Free</div>
              <div className="pricing-price">$0<span>/mo</span></div>
              <div className="pricing-price-note">No credit card needed</div>
            </div>
            <div className="pricing-card-body">
              {audience === 'freelancer'
                ? <ul className="pricing-highlights">
                    <li>$0 commission on local jobs</li>
                    <li>10% fee on remote</li>
                    <li>3 active job posts</li>
                    <li>1 service listing</li>
                    <li>Basic earnings summary</li>
                  </ul>
                : <ul className="pricing-highlights">
                    <li>Standard booking fees</li>
                    <li>5% remote client fee</li>
                    <li>3 active job posts</li>
                    <li>Basic spend summary</li>
                  </ul>
              }
            </div>
            <div className="pricing-card-cta">
              {currentPlanSlug?.includes('free') || !currentPlanSlug
                ? <button className="pricing-btn pricing-btn-current" disabled>Current Plan</button>
                : <button className="pricing-btn pricing-btn-outline" onClick={() => navigate('/billing')}>Manage Plan</button>
              }
            </div>
          </div>

          {/* Plus */}
          <div className="pricing-card pricing-card-featured">
            <div className="pricing-badge-popular">Most Popular</div>
            <div className="pricing-card-header">
              <div className="pricing-tier-label">{tierLabels[audience].plus}</div>
              <div className="pricing-price">
                ${plansByTier.plus?.price || (audience === 'freelancer' ? 24 : 19)}
                <span>/mo</span>
              </div>
              <div className="pricing-price-note">
                {audience === 'freelancer' ? 'Tools to grow your business' : 'Lower fees + better tools'}
              </div>
            </div>
            <div className="pricing-card-body">
              {audience === 'freelancer'
                ? <ul className="pricing-highlights">
                    <li>$0 commission on local jobs</li>
                    <li>7% fee on remote</li>
                    <li>20 active job posts</li>
                    <li>5 service listings</li>
                    <li>Booking calendar + scheduling</li>
                    <li>Recurring billing + bundles</li>
                    <li>Standard analytics + CSV</li>
                    <li>Priority support</li>
                  </ul>
                : <ul className="pricing-highlights">
                    <li>Reduced local booking fees</li>
                    <li>3% remote client fee</li>
                    <li>20 active job posts</li>
                    <li>Saved providers + job templates</li>
                    <li>Proposal comparison</li>
                    <li>Priority support</li>
                  </ul>
              }
            </div>
            <div className="pricing-card-cta">
              {currentPlanSlug?.includes('plus')
                ? <button className="pricing-btn pricing-btn-current" disabled>Current Plan</button>
                : <button
                    className="pricing-btn pricing-btn-primary"
                    onClick={() => handleUpgrade(audience === 'freelancer' ? 'freelancer_plus' : 'client_plus')}
                    disabled={upgrading === (audience === 'freelancer' ? 'freelancer_plus' : 'client_plus')}
                  >
                    {upgrading ? 'Redirecting…' : `Get ${tierLabels[audience].plus}`}
                  </button>
              }
            </div>
          </div>

          {/* Pro / Business */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <div className="pricing-tier-label">{tierLabels[audience].pro}</div>
              <div className="pricing-price">
                ${plansByTier.pro?.price || (audience === 'freelancer' ? 59 : 79)}
                <span>/mo</span>
              </div>
              <div className="pricing-price-note">
                {audience === 'freelancer' ? 'Full business stack' : 'Team tools + lowest fees'}
              </div>
            </div>
            <div className="pricing-card-body">
              {audience === 'freelancer'
                ? <ul className="pricing-highlights">
                    <li>$0 commission on local jobs</li>
                    <li>5% fee on remote</li>
                    <li>Unlimited job posts + services</li>
                    <li>Everything in Plus</li>
                    <li>Deposits + travel fees</li>
                    <li>Advanced analytics suite</li>
                    <li>Featured placement eligible</li>
                    <li>Priority payout</li>
                  </ul>
                : <ul className="pricing-highlights">
                    <li>Lowest local booking fees</li>
                    <li>2% remote client fee</li>
                    <li>Unlimited job posts</li>
                    <li>Everything in Plus</li>
                    <li>Team accounts + shared dashboards</li>
                    <li>Full spend reporting</li>
                    <li>Highest support priority</li>
                  </ul>
              }
            </div>
            <div className="pricing-card-cta">
              {(currentPlanSlug?.includes('pro') || currentPlanSlug?.includes('business'))
                ? <button className="pricing-btn pricing-btn-current" disabled>Current Plan</button>
                : <button
                    className="pricing-btn pricing-btn-primary"
                    onClick={() => handleUpgrade(audience === 'freelancer' ? 'freelancer_pro' : 'client_business')}
                    disabled={upgrading === (audience === 'freelancer' ? 'freelancer_pro' : 'client_business')}
                  >
                    {upgrading ? 'Redirecting…' : `Get ${tierLabels[audience].pro}`}
                  </button>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Full comparison table ── */}
      <div className="pricing-comparison">
        <h2 className="pricing-compare-title">Full feature comparison</h2>
        <div className="pricing-table-wrap">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Free</th>
                <th className="pricing-th-featured">{tierLabels[audience].plus}</th>
                <th>{tierLabels[audience].pro}</th>
              </tr>
            </thead>
            <tbody>
              {features.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'pricing-tr-alt' : ''}>
                  <td className="pricing-feature-label">{row.label}</td>
                  <td><CellValue val={row.free} /></td>
                  <td className="pricing-td-featured"><CellValue val={row.plus} /></td>
                  <td><CellValue val={row.pro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Local fee note ── */}
      <div className="pricing-note">
        <p>💡 <strong>Local freelancers are never charged commission</strong> — $0 on every job, on every plan. Subscriptions give you tools to run your business, not a cut of your earnings.</p>
      </div>

      {/* ── FAQ ── */}
      <div className="pricing-faq">
        <h2 className="pricing-faq-title">Common questions</h2>
        <div className="pricing-faq-grid">
          {[
            { q: 'Can I cancel anytime?', a: 'Yes. Cancel from your billing settings and you\'ll keep your benefits until the end of the billing period.' },
            { q: 'Do fees change when I upgrade?', a: 'Your new fee rates apply immediately to new jobs. Existing escrow payments use the rate they were funded with.' },
            { q: 'What happens if I downgrade?', a: 'You keep your plan until the end of the billing period, then drop to Free. Existing bookings and jobs are not affected.' },
            { q: 'Are there annual plans?', a: 'Monthly billing only at launch. Annual plans coming soon with a discount.' },
          ].map((item, i) => (
            <div key={i} className="pricing-faq-item">
              <strong>{item.q}</strong>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
