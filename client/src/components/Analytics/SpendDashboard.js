import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFeatures } from '../../hooks/useFeatures';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import { MonthlyLineChart, CategoryBar } from './charts';
import './SpendDashboard.css';

const fmtUSD = (n) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
}).format(n || 0);

const pct = (n) => `${n ?? 0}%`;

const RANGES = [
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '6mo', label: '6mo' },
  { value: '1yr', label: '1 yr' },
];

const StatCard = ({ label, value, sub }) => (
  <div className="sd-stat-card">
    <div className="sd-stat-label">{label}</div>
    <div className="sd-stat-value">{value}</div>
    {sub && <div className="sd-stat-sub">{sub}</div>}
  </div>
);

const Section = ({ title, subtitle, children }) => (
  <section className="sd-section">
    <div className="sd-section-head">
      <div>
        <h2 className="sd-section-title">{title}</h2>
        {subtitle && <p className="sd-section-sub">{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
);

const Card = ({ title, subtitle, children }) => (
  <div className="sd-card">
    <div className="sd-card-head">
      <div className="sd-card-title">{title}</div>
      {subtitle && <div className="sd-card-sub">{subtitle}</div>}
    </div>
    {children}
  </div>
);

const SpendDashboard = () => {
  const { user } = useAuth();
  const { hasFeature, loading: featLoading } = useFeatures();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('6mo');

  const load = useCallback(async (r) => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/analytics/me?range=${r}`);
      setData(res.client);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load(range);
  }, [user, range, load]);

  if (!featLoading && !hasFeature('spend_dashboard')) {
    return (
      <div className="sd-gate">
        <SEO title="Spend Dashboard | Fetchwork" />
        <div className="sd-gate-card">
          <div className="sd-gate-icon">Spend Dashboard</div>
          <h2>Upgrade to unlock spend reporting</h2>
          <p>Track spending by freelancer, category, and time period — and compare hiring performance over time.</p>
          <p className="sd-gate-tier">Available on the <strong>Business</strong> plan.</p>
          <a href="/pricing" className="btn btn-primary sd-gate-cta">View Plans</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sd-page">
        <SEO title="Spend Dashboard | Fetchwork" noIndex={true} />
        <div className="sd-skel-header">
          <div className="sd-skel sd-skel-title" />
          <div className="sd-skel sd-skel-sub" />
        </div>
        <div className="sd-stats-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="sd-skel sd-skel-card" />
          ))}
        </div>
        <div className="sd-skel sd-skel-block" />
        <div className="sd-skel sd-skel-block" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="sd-page">
        <SEO title="Spend Dashboard | Fetchwork" noIndex={true} />
        <div className="sd-empty">
          <h2>No spend data yet</h2>
          <p>Once you’ve paid for at least one job or service, your spend insights will show up here.</p>
        </div>
      </div>
    );
  }

  const hasMonthlySpend = data.monthlySpend?.some((m) => (m?.amount || 0) > 0);
  const hasBva = (data.budgetVsActual?.length || 0) > 0;
  const hasFreelancers = (data.spendByFreelancer?.length || 0) > 0;

  return (
    <div className="sd-page">
      <SEO title="Spend Dashboard | Fetchwork" noIndex={true} />

      <header className="sd-header">
        <div>
          <h1 className="sd-title">Spend Dashboard</h1>
          <p className="sd-subtitle">Track and optimize your spending on Fetchwork.</p>
        </div>

        <div className="sd-range-picker" aria-label="Spend range">
          {RANGES.map((r) => (
            <button
              key={r.value}
              className={`sd-range-btn ${range === r.value ? 'active' : ''}`}
              onClick={() => setRange(r.value)}
              type="button"
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <Section title="Overview" subtitle="High-level spend metrics for the selected range.">
        <div className="sd-stats-grid">
          <StatCard label="Total spent" value={fmtUSD(data.totalSpent)} />
          <StatCard label="YTD spend" value={fmtUSD(data.ytdSpent)} />
          <StatCard label="Avg cost / job" value={fmtUSD(data.avgCostPerJob)} />
          <StatCard label="Fill rate" value={pct(data.fillRate)} sub={data.jobsPosted ? `${data.jobsFilled || 0} of ${data.jobsPosted} filled` : undefined} />
        </div>
      </Section>

      <Section title="Spend trend" subtitle="Monthly spend over time.">
        <Card title="Monthly spend" subtitle={`Range: ${RANGES.find((r) => r.value === range)?.label || range}`}>
          {hasMonthlySpend
            ? <MonthlyLineChart data={data.monthlySpend} color="#7c3aed" height={260} />
            : <div className="sd-muted">No spend in this period.</div>}
        </Card>
      </Section>

      {hasFreelancers && (
        <Section title="Spend by freelancer" subtitle="Who you work with most, and what it costs.">
          <Card title="Top freelancers" subtitle="Sorted by total spend">
            <div className="sd-fl-list">
              {data.spendByFreelancer.slice(0, 12).map((f, i) => (
                <div key={f.id || `${f.name}-${i}`} className="sd-fl-row">
                  <div className="sd-fl-rank">#{i + 1}</div>
                  <div className="sd-fl-main">
                    <div className="sd-fl-name" title={f.name}>{f.name}</div>
                    <div className="sd-fl-meta">
                      <span>{f.payments} payment{f.payments === 1 ? '' : 's'}</span>
                      {f.rating && <span>• {f.rating} rating</span>}
                      {f.avgResponseTime && <span>• {Math.round(f.avgResponseTime)}m response</span>}
                    </div>
                  </div>
                  <div className="sd-fl-amount">{fmtUSD(f.totalSpent)}</div>
                </div>
              ))}
            </div>
          </Card>
        </Section>
      )}

      {hasBva && (
        <Section title="Budget vs actual" subtitle="Compare what you planned to spend vs what you actually spent — by category.">
          <Card title="Budget vs actual by category" subtitle="Budget = what you posted, Actual = what you paid">
            <CategoryBar
              items={data.budgetVsActual}
              valueKeys={['budgeted', 'actual']}
              colors={['#3b82f6', '#16a34a']}
              height={280}
            />
          </Card>
        </Section>
      )}

      {(data.repeatHireRate != null || data.avgTimeToHire != null || data.avgRatingGiven != null) && (
        <Section title="Performance" subtitle="Quality signals from your hiring history.">
          <div className="sd-performance">
            <div className="sd-perf-chip">
              <div className="sd-perf-k">Repeat hire rate</div>
              <div className="sd-perf-v">{pct(data.repeatHireRate)}</div>
            </div>
            <div className="sd-perf-chip">
              <div className="sd-perf-k">Avg time to hire</div>
              <div className="sd-perf-v">{data.avgTimeToHire ? `${data.avgTimeToHire}h` : '—'}</div>
            </div>
            <div className="sd-perf-chip">
              <div className="sd-perf-k">Avg rating given</div>
              <div className="sd-perf-v">{data.avgRatingGiven ? `${data.avgRatingGiven} / 5` : '—'}</div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
};

export default SpendDashboard;
