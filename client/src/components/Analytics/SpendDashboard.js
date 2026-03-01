import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFeatures } from '../../hooks/useFeatures';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './SpendDashboard.css';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
const RANGES = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '6mo', label: '6 months' },
  { value: '1yr', label: '1 year' },
];

const SpendDashboard = () => {
  const { user } = useAuth();
  const { hasFeature, loading: featLoading } = useFeatures();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange]     = useState('6mo');

  const load = useCallback(async (r) => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/analytics/me?range=${r}`);
      setData(res.client);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) load(range); }, [user, range, load]);

  if (!featLoading && !hasFeature('spend_dashboard')) {
    return (
      <div className="sd-gate">
        <SEO title="Spend Dashboard | Fetchwork" />
        <div className="sd-gate-card">
          <span style={{ fontSize: '3rem' }}>💰</span>
          <h2>Spend Dashboard</h2>
          <p>Track spending by freelancer, category, and time period. Compare freelancer performance side-by-side.</p>
          <p className="sd-gate-tier">Available on the <strong>Business</strong> plan.</p>
          <a href="/pricing" className="btn btn-primary" style={{ marginTop: '1rem' }}>View Plans</a>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return <div className="sd-loading">{loading ? 'Loading spend data...' : 'No spend data available.'}</div>;
  }

  return (
    <div className="sd-page">
      <SEO title="Spend Dashboard | Fetchwork" noIndex={true} />

      <div className="sd-header">
        <div>
          <h1 className="sd-title">💰 Spend Dashboard</h1>
          <p className="sd-subtitle">Track and optimize your spending on Fetchwork</p>
        </div>
        <div className="sd-range">
          {RANGES.map(r => (
            <button key={r.value} className={`sd-range-btn ${range === r.value ? 'active' : ''}`} onClick={() => setRange(r.value)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="sd-summary">
        <div className="sd-card">
          <span className="sd-card-icon">💵</span>
          <div className="sd-card-value">{fmt(data.totalSpent)}</div>
          <div className="sd-card-label">Total Spent</div>
        </div>
        <div className="sd-card">
          <span className="sd-card-icon">📅</span>
          <div className="sd-card-value">{fmt(data.ytdSpent)}</div>
          <div className="sd-card-label">YTD Spend</div>
        </div>
        <div className="sd-card">
          <span className="sd-card-icon">📊</span>
          <div className="sd-card-value">{fmt(data.avgCostPerJob)}</div>
          <div className="sd-card-label">Avg Cost / Job</div>
        </div>
        <div className="sd-card">
          <span className="sd-card-icon">✅</span>
          <div className="sd-card-value">{data.fillRate}%</div>
          <div className="sd-card-label">Fill Rate</div>
        </div>
      </div>

      {/* Monthly spend chart (simple bar) */}
      {data.monthlySpend?.length > 0 && (
        <div className="sd-section">
          <h3>Monthly Spend</h3>
          <div className="sd-bar-chart">
            {data.monthlySpend.map((m, i) => {
              const maxVal = Math.max(...data.monthlySpend.map(x => x.amount), 1);
              const pct = (m.amount / maxVal) * 100;
              return (
                <div key={i} className="sd-bar-col">
                  <div className="sd-bar-value">{m.amount > 0 ? fmt(m.amount) : ''}</div>
                  <div className="sd-bar" style={{ height: `${Math.max(pct, 2)}%` }} />
                  <div className="sd-bar-label">{m.month.slice(5)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spend by freelancer */}
      {data.spendByFreelancer?.length > 0 && (
        <div className="sd-section">
          <h3>Spend by Freelancer</h3>
          <div className="sd-freelancer-list">
            {data.spendByFreelancer.map((f, i) => (
              <div key={i} className="sd-fl-row">
                <div className="sd-fl-rank">{i + 1}</div>
                <div className="sd-fl-info">
                  <strong>{f.name}</strong>
                  <span className="sd-fl-meta">
                    {f.payments} payments
                    {f.rating && <> · {f.rating} ⭐</>}
                    {f.avgResponseTime && <> · {Math.round(f.avgResponseTime)}m response</>}
                  </span>
                </div>
                <div className="sd-fl-amount">{fmt(f.totalSpent)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget vs Actual */}
      {data.budgetVsActual?.length > 0 && (
        <div className="sd-section">
          <h3>Budget vs Actual by Category</h3>
          <div className="sd-bva-list">
            {data.budgetVsActual.map((c, i) => (
              <div key={i} className="sd-bva-row">
                <div className="sd-bva-cat">{c.category}</div>
                <div className="sd-bva-bars">
                  <div className="sd-bva-bar budgeted" style={{ width: `${Math.min((c.budgeted / Math.max(c.budgeted, c.actual)) * 100, 100)}%` }}>
                    {fmt(c.budgeted)}
                  </div>
                  <div className="sd-bva-bar actual" style={{ width: `${Math.min((c.actual / Math.max(c.budgeted, c.actual)) * 100, 100)}%` }}>
                    {fmt(c.actual)}
                  </div>
                </div>
                <div className="sd-bva-jobs">{c.jobs} jobs</div>
              </div>
            ))}
            <div className="sd-bva-legend">
              <span className="sd-bva-legend-item"><span className="sd-bva-dot budgeted" /> Budgeted</span>
              <span className="sd-bva-legend-item"><span className="sd-bva-dot actual" /> Actual</span>
            </div>
          </div>
        </div>
      )}

      {/* Top freelancers */}
      {data.topFreelancers?.length > 0 && (
        <div className="sd-section">
          <h3>Top Freelancers</h3>
          <div className="sd-stats-row">
            <div className="sd-stat"><strong>{data.repeatHireRate}%</strong> repeat hire rate</div>
            <div className="sd-stat"><strong>{data.avgTimeToHire ? `${data.avgTimeToHire}h` : '—'}</strong> avg time to hire</div>
            <div className="sd-stat"><strong>{data.avgRatingGiven ? `${data.avgRatingGiven} ⭐` : '—'}</strong> avg rating given</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpendDashboard;
