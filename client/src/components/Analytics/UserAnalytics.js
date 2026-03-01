import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import {
  MonthlyLineChart, StatusDonut, ProposalFunnelBar, CategoryBar, RatingLine,
} from './charts';
import './UserAnalytics.css';

// ── Formatters ────────────────────────────────────────────────────
const fmt  = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
const pct  = (n) => `${n ?? 0}%`;
const fmtH = (h) => { if (h == null) return '—'; if (h < 24) return `${h}h`; return `${Math.round(h / 24)}d`; };
const fmtR = (m) => { if (m == null) return '—'; if (m < 60) return `${Math.round(m)}m`; if (m < 1440) return `${Math.round(m / 60)}h`; return `${Math.round(m / 1440)}d`; };

// ── Stat Card ─────────────────────────────────────────────────────
const Stat = ({ icon, label, value, sub, accent }) => (
  <div className="ua-stat-card" style={accent ? { borderTop: `3px solid ${accent}` } : {}}>
    <span className="ua-stat-icon">{icon}</span>
    <div className="ua-stat-body">
      <div className="ua-stat-value">{value}</div>
      <div className="ua-stat-label">{label}</div>
      {sub && <div className="ua-stat-sub">{sub}</div>}
    </div>
  </div>
);

// ── Section wrapper ───────────────────────────────────────────────
const Section = ({ title, children, className = '' }) => (
  <div className={`ua-section ${className}`}>
    {title && <h2 className="ua-section-title">{title}</h2>}
    {children}
  </div>
);

// ── Chart card ───────────────────────────────────────────────────
const ChartCard = ({ title, children, sub }) => (
  <div className="ua-chart-card">
    <div className="ua-chart-header">
      <span className="ua-chart-title">{title}</span>
      {sub && <span className="ua-chart-sub">{sub}</span>}
    </div>
    {children}
  </div>
);

// ── Insight banner ────────────────────────────────────────────────
const Insight = ({ type = 'info', children }) => (
  <div className={`ua-insight ua-insight-${type}`}>{children}</div>
);

// ── Empty state ───────────────────────────────────────────────────
const Empty = ({ role }) => (
  <div className="ua-empty">
    <span className="ua-empty-icon">📊</span>
    <h3>No data yet</h3>
    <p>{role === 'freelancer'
      ? 'Complete your first job to see your performance metrics.'
      : 'Post your first job to start tracking spend and hiring stats.'}</p>
  </div>
);

// ── Skeleton ──────────────────────────────────────────────────────
const Skeleton = () => (
  <div className="ua-loading">
    <div className="ua-sk-grid">
      {[...Array(8)].map((_, i) => <div key={i} className="ua-skeleton ua-sk-card" />)}
    </div>
    <div className="ua-skeleton ua-sk-chart" />
    <div className="ua-sk-grid2">
      {[...Array(2)].map((_, i) => <div key={i} className="ua-skeleton ua-sk-chart-sm" />)}
    </div>
  </div>
);

// ── RANGE OPTIONS ─────────────────────────────────────────────────
const RANGES = [
  { value: '30d',  label: '30d' },
  { value: '90d',  label: '90d' },
  { value: '6mo',  label: '6mo' },
  { value: '1yr',  label: '1 yr' },
];

// ═══════════════════════════════════════════════════════════════════
// FREELANCER DASHBOARD
// ═══════════════════════════════════════════════════════════════════
const FreelancerDashboard = ({ data, range }) => {
  const empty = !data || (data.completedJobs === 0 && data.proposalFunnel?.sent === 0);
  if (empty) return <Empty role="freelancer" />;
  const hasEarningsData = data.monthlyEarnings?.some(m => m.amount > 0);
  const hasRatingData   = data.ratingTrend?.some(m => m.avg != null);

  return (
    <>
      {/* ── Summary stats ── */}
      <Section title="Earnings Overview">
        <div className="ua-stats-grid">
          <Stat icon="💰" label="YTD Earnings"      value={fmt(data.ytdEarnings)}      accent="#2563eb" />
          <Stat icon="📈" label="Total Earned"       value={fmt(data.totalEarnings)} />
          <Stat icon="🏦" label="Platform Fees"      value={fmt(data.platformFeesPaid)}  sub="Deducted from payouts" />
          <Stat icon="💼" label="Avg Job Size"        value={fmt(data.avgJobSize)} />
          <Stat icon="🎯" label="Win Rate"
            value={pct(data.winRate)}
            sub={`${data.proposalFunnel?.sent || 0} proposals sent`}
            accent={data.winRate >= 30 ? '#16a34a' : '#d97706'} />
          <Stat icon="⚡" label="Active Jobs"         value={data.activeJobs} />
          <Stat icon="✅" label="Completed"           value={data.completedJobs} />
          <Stat icon="📦" label="Delivery Rate"
            value={data.deliveryRate != null ? pct(data.deliveryRate) : '—'}
            accent={data.deliveryRate >= 90 ? '#16a34a' : data.deliveryRate < 70 ? '#dc2626' : undefined} />
          <Stat icon="🔁" label="Repeat Clients"
            value={pct(data.repeatClientRate)}
            sub="Hired 2+ times"
            accent={data.repeatClientRate >= 25 ? '#16a34a' : undefined} />
          <Stat icon="⭐" label="Rating"
            value={data.ratingAvg ? `${data.ratingAvg}/5` : '—'}
            sub={data.ratingCount ? `${data.ratingCount} reviews` : 'No reviews yet'} />
          <Stat icon="⏱️" label="Avg Response"        value={fmtR(data.avgResponseTime)} sub="Faster = higher search rank" />
        </div>
      </Section>

      {/* ── Insights ── */}
      {data.winRate < 15 && data.proposalFunnel?.sent >= 5 && (
        <Insight type="warn">💡 Win rate below 15%. Try personalizing proposals and highlighting matching experience.</Insight>
      )}
      {data.winRate >= 30 && (
        <Insight type="success">🌟 Great win rate! Consider upgrading your plan to apply to more jobs.</Insight>
      )}
      {data.deliveryRate != null && data.deliveryRate < 70 && (
        <Insight type="warn">⚠️ Delivery rate below 70%. Clients may hesitate to hire you. Review cancelled jobs.</Insight>
      )}

      {/* ── Earnings trend ── */}
      <Section title="Earnings Trend">
        <ChartCard title={`Monthly Earnings (${range})`} sub="Net payout after platform fees">
          {hasEarningsData
            ? <MonthlyLineChart data={data.monthlyEarnings} color="#2563eb" />
            : <div className="ua-chart-empty">No earnings in this period</div>}
        </ChartCard>
      </Section>

      {/* ── Two-column: job status + proposal funnel ── */}
      <Section title="Activity Breakdown">
        <div className="ua-charts-2col">
          <ChartCard title="Job Status">
            <StatusDonut statusMap={data.jobsByStatus} />
          </ChartCard>
          <ChartCard title="Proposal Funnel">
            <ProposalFunnelBar funnel={data.proposalFunnel} />
          </ChartCard>
        </div>
      </Section>

      {/* ── Top categories + rating trend ── */}
      <Section title="Performance Details">
        <div className="ua-charts-2col">
          {data.topCategories?.length > 0 && (
            <ChartCard title="Top Earning Categories">
              <CategoryBar items={data.topCategories} valueKeys={['earned']} />
            </ChartCard>
          )}
          {hasRatingData && (
            <ChartCard title="Rating Trend" sub="Your avg review score over time">
              <RatingLine trend={data.ratingTrend} />
            </ChartCard>
          )}
        </div>
      </Section>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════
// CLIENT DASHBOARD
// ═══════════════════════════════════════════════════════════════════
const ClientDashboard = ({ data, range }) => {
  const empty = !data || data.jobsPosted === 0;
  if (empty) return <Empty role="client" />;
  const hasSpendData = data.monthlySpend?.some(m => m.amount > 0);

  return (
    <>
      {/* ── Summary stats ── */}
      <Section title="Spend Overview">
        <div className="ua-stats-grid">
          <Stat icon="💸" label="YTD Spend"         value={fmt(data.ytdSpent)}       accent="#2563eb" />
          <Stat icon="📊" label="Total Spent"        value={fmt(data.totalSpent)} />
          <Stat icon="💵" label="Avg Cost / Job"     value={fmt(data.avgCostPerJob)} />
          <Stat icon="📋" label="Jobs Posted"        value={data.jobsPosted} />
          <Stat icon="✅" label="Fill Rate"
            value={pct(data.fillRate)}
            sub={`${data.jobsFilled} of ${data.jobsPosted} filled`}
            accent={data.fillRate >= 50 ? '#16a34a' : '#d97706'} />
          <Stat icon="📂" label="Open Jobs"          value={data.jobsOpen} />
          <Stat icon="⏳" label="Avg Time to Hire"   value={fmtH(data.avgTimeToHire)} sub="From post to accepted" />
          <Stat icon="🔁" label="Repeat Hire Rate"
            value={pct(data.repeatHireRate)}
            sub="Freelancers hired 2+"
            accent={data.repeatHireRate >= 25 ? '#16a34a' : undefined} />
          <Stat icon="⭐" label="Avg Rating Given"   value={data.avgRatingGiven ? `${data.avgRatingGiven}/5` : '—'} />
        </div>
      </Section>

      {/* ── Insights ── */}
      {data.fillRate < 40 && data.jobsPosted >= 3 && (
        <Insight type="warn">💡 Fill rate below 40%. Try more detailed job descriptions or adjusting your budget.</Insight>
      )}
      {data.repeatHireRate >= 40 && (
        <Insight type="success">🌟 High repeat hire rate — you build strong freelancer relationships!</Insight>
      )}

      {/* ── Spend trend ── */}
      <Section title="Spend Trend">
        <ChartCard title={`Monthly Spend (${range})`} sub="Total paid to freelancers">
          {hasSpendData
            ? <MonthlyLineChart data={data.monthlySpend} color="#7c3aed" />
            : <div className="ua-chart-empty">No spend in this period</div>}
        </ChartCard>
      </Section>

      {/* ── Job status + budget vs actual ── */}
      <Section title="Activity Breakdown">
        <div className="ua-charts-2col">
          <ChartCard title="Job Status">
            <StatusDonut statusMap={data.jobsByStatus} />
          </ChartCard>
          {data.budgetVsActual?.length > 0 && (
            <ChartCard title="Budget vs Actual by Category">
              <CategoryBar
                items={data.budgetVsActual}
                valueKeys={['budgeted', 'actual']}
                colors={['#3b82f6', '#16a34a']}
              />
            </ChartCard>
          )}
        </div>
      </Section>

      {/* ── Top freelancers table ── */}
      {data.topFreelancers?.length > 0 && (
        <Section title="Top Freelancers">
          <div className="ua-freelancers">
            {data.topFreelancers.map((f, i) => (
              <div key={f.id || i} className="ua-fl-row">
                <span className="ua-fl-rank">#{i + 1}</span>
                <span className="ua-fl-name">{f.name}</span>
                <span className="ua-fl-jobs">{f.jobs} job{f.jobs !== 1 ? 's' : ''}</span>
                <span className="ua-fl-paid">{fmt(f.totalPaid)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Time to hire by category ── */}
      {data.timeToHireByCategory?.length > 0 && (
        <Section title="Time to Hire by Category" className="ua-tth-section">
          <div className="ua-tth-list">
            {data.timeToHireByCategory.map(c => (
              <div key={c.category} className="ua-tth-row">
                <span className="ua-tth-cat">{(c.category || 'Other').replace(/_/g, ' ')}</span>
                <div className="ua-tth-bar-wrap">
                  <div
                    className="ua-tth-bar"
                    style={{ width: `${Math.min(100, (c.avgHours / (data.timeToHireByCategory[0]?.avgHours || 1)) * 100)}%` }}
                  />
                </div>
                <span className="ua-tth-val">{fmtH(c.avgHours)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════
const UserAnalytics = () => {
  const { user }                       = useAuth();
  const { isFreelancerMode, isClientMode } = useRole();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [range,   setRange]   = useState('1yr');
  const [activeTab, setActiveTab] = useState(null);

  const load = useCallback(async (r) => {
    setLoading(true); setError(null);
    try {
      const res = await apiRequest(`/api/analytics/me?range=${r}`);
      setData(res);
      // Set initial tab once (functional update avoids stale closure)
      setActiveTab(prev => {
        if (prev) return prev;
        if (res.freelancer && isFreelancerMode) return 'freelancer';
        if (res.client && isClientMode)         return 'client';
        if (res.freelancer)                     return 'freelancer';
        return 'client';
      });
    } catch (err) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [isFreelancerMode, isClientMode]);

  useEffect(() => { if (user) load(range); }, [user, range, load]);

  const hasBoth = data?.freelancer !== null && data?.client !== null;
  const rangeLabel = RANGES.find(r => r.value === range)?.label || range;

  return (
    <div className="ua-page">
      <SEO title="My Analytics" path="/analytics" noIndex={true} />

      <div className="ua-header">
        <div>
          <h1 className="ua-title">My Analytics</h1>
          <p className="ua-subtitle">Your performance metrics across Fetchwork</p>
        </div>
        {/* Range picker */}
        <div className="ua-range-picker">
          {RANGES.map(r => (
            <button
              key={r.value}
              className={`ua-range-btn ${range === r.value ? 'active' : ''}`}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Role tabs (both-account users) */}
      {!loading && hasBoth && (
        <div className="ua-tabs">
          <button className={`ua-tab ${activeTab === 'freelancer' ? 'active' : ''}`} onClick={() => setActiveTab('freelancer')}>
            Freelancer
          </button>
          <button className={`ua-tab ${activeTab === 'client' ? 'active' : ''}`} onClick={() => setActiveTab('client')}>
            Client
          </button>
        </div>
      )}

      {loading && <Skeleton />}

      {!loading && error && (
        <div className="ua-error">⚠️ {error}</div>
      )}

      {!loading && !error && data && (
        <>
          {activeTab === 'freelancer' && <FreelancerDashboard data={data.freelancer} range={rangeLabel} />}
          {activeTab === 'client'     && <ClientDashboard     data={data.client}     range={rangeLabel} />}
        </>
      )}
    </div>
  );
};

export default UserAnalytics;
