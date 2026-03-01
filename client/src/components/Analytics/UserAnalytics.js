import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './UserAnalytics.css';

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

const pct = (n) => `${n ?? 0}%`;

const fmtHours = (h) => {
  if (h == null) return '—';
  if (h < 24)   return `${h}h`;
  return `${Math.round(h / 24)}d`;
};

const fmtResponse = (mins) => {
  if (mins == null) return '—';
  if (mins < 60)    return `${Math.round(mins)}m`;
  if (mins < 1440)  return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
};

const StatCard = ({ icon, label, value, sub, accent }) => (
  <div className="ua-stat-card" style={accent ? { borderTop: `3px solid ${accent}` } : {}}>
    <span className="ua-stat-icon">{icon}</span>
    <div className="ua-stat-body">
      <div className="ua-stat-value">{value}</div>
      <div className="ua-stat-label">{label}</div>
      {sub && <div className="ua-stat-sub">{sub}</div>}
    </div>
  </div>
);

const EmptyState = ({ role }) => (
  <div className="ua-empty">
    <span className="ua-empty-icon">📊</span>
    <h3>No data yet</h3>
    <p>
      {role === 'freelancer'
        ? 'Complete your first job to start seeing your earnings and performance stats.'
        : 'Post your first job to start tracking spending and hiring metrics.'}
    </p>
  </div>
);

// ── Freelancer Panel ────────────────────────────────────────────
const FreelancerStats = ({ data }) => {
  const isEmpty = !data || (data.completedJobs === 0 && data.proposalsSent === 0);
  if (isEmpty) return <EmptyState role="freelancer" />;

  return (
    <div className="ua-panel">
      <h2 className="ua-section-title">Freelancer Performance</h2>

      <div className="ua-stats-grid">
        <StatCard icon="💰" label="YTD Earnings"      value={fmt(data.ytdEarnings)}      accent="#2563eb" />
        <StatCard icon="📈" label="Total Earned"       value={fmt(data.totalEarnings)} />
        <StatCard icon="🏦" label="Platform Fees Paid" value={fmt(data.platformFeesPaid)}
          sub="Deducted from payouts" />
        <StatCard icon="🎯" label="Win Rate"
          value={pct(data.winRate)}
          sub={`${data.proposalsSent} proposals sent`}
          accent={data.winRate >= 30 ? '#16a34a' : '#d97706'} />
        <StatCard icon="⚡" label="Active Jobs"    value={data.activeJobs} />
        <StatCard icon="✅" label="Jobs Completed"  value={data.completedJobs} />
        <StatCard icon="🔁" label="Repeat Client Rate"
          value={pct(data.repeatClientRate)}
          sub="Clients who hired you 2+ times"
          accent={data.repeatClientRate >= 25 ? '#16a34a' : undefined} />
        <StatCard icon="⏱️" label="Avg Response Time"
          value={fmtResponse(data.avgResponseTime)}
          sub="Faster = higher visibility" />
      </div>

      {data.winRate < 15 && data.proposalsSent >= 5 && (
        <div className="ua-insight ua-insight-warn">
          💡 Your win rate is below 15%. Try personalizing your proposals and highlighting relevant experience.
        </div>
      )}
      {data.winRate >= 30 && (
        <div className="ua-insight ua-insight-success">
          🌟 Great win rate! You're converting well. Consider upgrading your plan to apply to more jobs.
        </div>
      )}
    </div>
  );
};

// ── Client Panel ────────────────────────────────────────────────
const ClientStats = ({ data }) => {
  const isEmpty = !data || (data.jobsPosted === 0);
  if (isEmpty) return <EmptyState role="client" />;

  return (
    <div className="ua-panel">
      <h2 className="ua-section-title">Client Dashboard</h2>

      <div className="ua-stats-grid">
        <StatCard icon="💸" label="YTD Spend"        value={fmt(data.ytdSpent)}       accent="#2563eb" />
        <StatCard icon="📊" label="Total Spent"       value={fmt(data.totalSpent)} />
        <StatCard icon="📋" label="Jobs Posted"       value={data.jobsPosted} />
        <StatCard icon="✅" label="Fill Rate"
          value={pct(data.fillRate)}
          sub={`${data.jobsFilled} of ${data.jobsPosted} filled`}
          accent={data.fillRate >= 50 ? '#16a34a' : '#d97706'} />
        <StatCard icon="⏳" label="Avg Time to Hire"
          value={fmtHours(data.avgTimeToHire)}
          sub="From posting to accepted" />
        <StatCard icon="💵" label="Avg Cost / Job"   value={fmt(data.avgCostPerJob)} />
        <StatCard icon="🔁" label="Repeat Hire Rate"
          value={pct(data.repeatHireRate)}
          sub="Freelancers hired 2+ times"
          accent={data.repeatHireRate >= 25 ? '#16a34a' : undefined} />
        <StatCard icon="📂" label="Open Jobs"         value={data.jobsOpen} />
      </div>

      {data.topCategories?.length > 0 && (
        <div className="ua-categories">
          <h3 className="ua-sub-title">Spend by Category</h3>
          <div className="ua-cat-list">
            {data.topCategories.map((c) => (
              <div key={c.category} className="ua-cat-row">
                <span className="ua-cat-name">{c.category || 'Uncategorized'}</span>
                <span className="ua-cat-jobs">{c.jobs} job{c.jobs !== 1 ? 's' : ''}</span>
                <span className="ua-cat-amount">{fmt(c.spent)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.fillRate < 40 && data.jobsPosted >= 3 && (
        <div className="ua-insight ua-insight-warn">
          💡 Your fill rate is below 40%. Try posting more detailed job descriptions or adjusting your budget.
        </div>
      )}
    </div>
  );
};

// ── Page ────────────────────────────────────────────────────────
const UserAnalytics = () => {
  const { user } = useAuth();
  const { isFreelancerMode, isClientMode } = useRole();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(null); // set after load

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await apiRequest('/api/analytics/me');
        setData(res);
        // Default to the user's current role tab
        if (res.freelancer && isFreelancerMode) setActiveTab('freelancer');
        else if (res.client && isClientMode)    setActiveTab('client');
        else if (res.freelancer)                setActiveTab('freelancer');
        else                                    setActiveTab('client');
      } catch (err) {
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [user, isFreelancerMode, isClientMode]);

  const hasBoth = data?.freelancer !== null && data?.client !== null;

  return (
    <div className="ua-page">
      <SEO title="My Analytics" path="/analytics" noIndex={true} />

      <div className="ua-header">
        <h1 className="ua-title">My Analytics</h1>
        <p className="ua-subtitle">Your performance metrics across Fetchwork</p>
      </div>

      {loading && (
        <div className="ua-loading">
          <div className="ua-skeleton ua-sk-title" />
          <div className="ua-sk-grid">
            {[...Array(8)].map((_, i) => <div key={i} className="ua-skeleton ua-sk-card" />)}
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="ua-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {hasBoth && (
            <div className="ua-tabs">
              <button
                className={`ua-tab ${activeTab === 'freelancer' ? 'active' : ''}`}
                onClick={() => setActiveTab('freelancer')}
              >
                Freelancer
              </button>
              <button
                className={`ua-tab ${activeTab === 'client' ? 'active' : ''}`}
                onClick={() => setActiveTab('client')}
              >
                Client
              </button>
            </div>
          )}

          {activeTab === 'freelancer' && <FreelancerStats data={data.freelancer} />}
          {activeTab === 'client'     && <ClientStats     data={data.client} />}
        </>
      )}
    </div>
  );
};

export default UserAnalytics;
