import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './ReferralPage.css';

const STATUS_LABELS = {
  pending:   { label: 'Pending',   color: '#d97706', bg: '#fef3c7' },
  qualified: { label: 'Qualified', color: '#2563eb', bg: '#dbeafe' },
  rewarded:  { label: 'Rewarded',  color: '#16a34a', bg: '#dcfce7' },
};

const ReferralPage = () => {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    apiRequest('/api/referrals/me')
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => { setError('Failed to load referral data'); setLoading(false); });
  }, []);

  const copyLink = () => {
    navigator.clipboard.writeText(stats.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <div className="ref-page"><div className="ref-skeleton" /></div>;
  if (error)   return <div className="ref-page"><p className="ref-error">{error}</p></div>;

  return (
    <div className="ref-page">
      <SEO title="Referrals" path="/referrals" noIndex={true} />

      <div className="ref-header">
        <h1 className="ref-title">Refer &amp; Earn</h1>
        <p className="ref-sub">
          Share your link. When someone signs up and completes their first job,
          you earn <strong>${stats.rewardAmount} in credits</strong> — automatically.
        </p>
      </div>

      {/* Credits banner */}
      {stats.credits > 0 && (
        <div className="ref-credits-banner">
          🎁 You have <strong>${stats.credits}</strong> in referral credits available
        </div>
      )}

      {/* Stats row */}
      <div className="ref-stats">
        <div className="ref-stat">
          <div className="ref-stat-val">{stats.total}</div>
          <div className="ref-stat-label">Total Referrals</div>
        </div>
        <div className="ref-stat">
          <div className="ref-stat-val">{stats.pending}</div>
          <div className="ref-stat-label">Pending</div>
        </div>
        <div className="ref-stat">
          <div className="ref-stat-val">{stats.rewarded}</div>
          <div className="ref-stat-label">Rewarded</div>
        </div>
        <div className="ref-stat ref-stat-earn">
          <div className="ref-stat-val">${stats.rewarded * stats.rewardAmount}</div>
          <div className="ref-stat-label">Earned Total</div>
        </div>
      </div>

      {/* Referral link */}
      <div className="ref-link-section">
        <p className="ref-link-label">Your referral link</p>
        <div className="ref-link-row">
          <input
            type="text"
            readOnly
            value={stats.link}
            className="ref-link-input"
            onClick={e => e.target.select()}
          />
          <button className={`ref-copy-btn ${copied ? 'copied' : ''}`} onClick={copyLink}>
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
        <div className="ref-share">
          <a
            href={`https://twitter.com/intent/tweet?text=I%20use%20Fetchwork%20to%20hire%20great%20freelancers.%20Join%20me%3A%20${encodeURIComponent(stats.link)}`}
            target="_blank" rel="noopener noreferrer" className="ref-share-btn ref-twitter"
          >
            Share on X
          </a>
          <a
            href={`mailto:?subject=Join Fetchwork&body=Hey! I've been using Fetchwork to get work done — check it out: ${stats.link}`}
            className="ref-share-btn ref-email"
          >
            Share via Email
          </a>
        </div>
      </div>

      {/* How it works */}
      <div className="ref-how">
        <h2>How it works</h2>
        <div className="ref-steps">
          <div className="ref-step">
            <span className="ref-step-num">1</span>
            <div>
              <strong>Share your link</strong>
              <p>Send it to friends, post it online — anywhere.</p>
            </div>
          </div>
          <div className="ref-step">
            <span className="ref-step-num">2</span>
            <div>
              <strong>They sign up</strong>
              <p>They create a free account via your referral link.</p>
            </div>
          </div>
          <div className="ref-step">
            <span className="ref-step-num">3</span>
            <div>
              <strong>They complete a job</strong>
              <p>Once they finish their first job, you both benefit.</p>
            </div>
          </div>
          <div className="ref-step">
            <span className="ref-step-num">4</span>
            <div>
              <strong>You earn ${stats.rewardAmount}</strong>
              <p>Credits added to your account automatically.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Referral list */}
      {stats.referrals.length > 0 && (
        <div className="ref-list-section">
          <h2>Your Referrals</h2>
          <div className="ref-list">
            {stats.referrals.map(r => {
              const sm = STATUS_LABELS[r.status] || STATUS_LABELS.pending;
              return (
                <div key={r.id} className="ref-row">
                  <div className="ref-row-name">{r.name}</div>
                  <div className="ref-row-date">
                    {r.joinedAt ? new Date(r.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </div>
                  <span className="ref-row-status" style={{ color: sm.color, background: sm.bg }}>
                    {sm.label}
                  </span>
                  {r.status === 'rewarded' && r.rewardedAt && (
                    <span className="ref-row-rewarded">
                      +${stats.rewardAmount} on {new Date(r.rewardedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralPage;
