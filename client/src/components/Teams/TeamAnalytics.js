import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './TeamAnalytics.css';

function formatCurrency(amount) {
  if (amount == null) return '$0.00';
  return `$${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMonth(key) {
  if (!key) return '';
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString(undefined, { month: 'short' });
}

function formatPercent(value) {
  return `${value ?? 0}%`;
}

function disputeColor(rate) {
  if (rate < 5) return 'var(--color-success, #22c55e)';
  if (rate <= 15) return 'var(--color-warning, #f59e0b)';
  return 'var(--color-error, #ef4444)';
}

export default function TeamAnalytics({ teamId, team }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest(`/api/teams/${teamId}/analytics`);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading) {
    return <div className="ta-root"><div className="ta-loading">Loading analytics...</div></div>;
  }

  if (error) {
    return <div className="ta-root"><div className="ta-error">{error}</div></div>;
  }

  if (!data) {
    return <div className="ta-root"><div className="ta-empty">No analytics data available.</div></div>;
  }

  const { hiring, spend, performance, team: teamData } = data;

  // Bar chart helpers
  const maxJobsByMonth = Math.max(...(hiring.jobsByMonth || []).map(m => m.count), 1);
  const maxSpendByMonth = Math.max(...(spend.byMonth || []).map(m => m.amount), 1);
  const maxMemberSpend = Math.max(...(spend.byMember || []).map(m => m.amount), 1);
  const spendTotal = (spend.byCategory || []).reduce((s, c) => s + c.amount, 0);

  // Conic gradient for donut
  let conicStops = '';
  if (spendTotal > 0) {
    const colors = [
      'var(--color-primary, #4285f4)',
      'var(--color-success, #22c55e)',
      'var(--color-warning, #f59e0b)',
      'var(--color-error, #ef4444)',
      'var(--color-info, #8b5cf6)',
      'var(--color-text-secondary, #94a3b8)',
    ];
    let cumPct = 0;
    const stops = (spend.byCategory || []).map((c, i) => {
      const pct = (c.amount / spendTotal) * 100;
      const start = cumPct;
      cumPct += pct;
      return `${colors[i % colors.length]} ${start}% ${cumPct}%`;
    });
    conicStops = stops.join(', ');
  }

  // Member growth max
  const maxGrowth = Math.max(...(teamData.memberGrowth || []).map(m => m.count), 1);

  return (
    <div className="ta-root">
      <h2 className="ta-title">Team Analytics</h2>

      {/* ── Hiring Analytics ── */}
      <section className="ta-section">
        <h3 className="ta-section-title">Hiring</h3>

        <div className="ta-stat-cards">
          <div className="ta-stat-card">
            <span className="ta-stat-value">{hiring.totalJobsPosted}</span>
            <span className="ta-stat-label">Jobs Posted</span>
          </div>
          <div className="ta-stat-card">
            <span className="ta-stat-value">{hiring.avgProposalsPerJob}</span>
            <span className="ta-stat-label">Avg Proposals/Job</span>
          </div>
          <div className="ta-stat-card">
            <span className="ta-stat-value">{formatPercent(hiring.repeatFreelancerRate)}</span>
            <span className="ta-stat-label">Repeat Hire Rate</span>
          </div>
          <div className="ta-stat-card">
            <span className="ta-stat-value">{hiring.avgTimeToHire}d</span>
            <span className="ta-stat-label">Avg Time to Hire</span>
          </div>
        </div>

        {/* Jobs by Month bar chart */}
        {hiring.jobsByMonth && hiring.jobsByMonth.length > 0 && (
          <div className="ta-chart-block">
            <h4 className="ta-chart-title">Jobs Posted by Month</h4>
            <div className="ta-bar-chart">
              {hiring.jobsByMonth.map(m => (
                <div className="ta-bar-col" key={m.month}>
                  <span className="ta-bar-value">{m.count}</span>
                  <div className="ta-bar" style={{ height: `${(m.count / maxJobsByMonth) * 100}%` }} />
                  <span className="ta-bar-label">{formatMonth(m.month)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top freelancers table */}
        {hiring.topFreelancers && hiring.topFreelancers.length > 0 && (
          <div className="ta-chart-block">
            <h4 className="ta-chart-title">Top Freelancers</h4>
            <div className="ta-table-wrap">
              <table className="ta-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Jobs Completed</th>
                    <th>Total Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {hiring.topFreelancers.map(f => (
                    <tr key={f.userId}>
                      <td>{f.name}</td>
                      <td>{f.jobsCompleted}</td>
                      <td>{formatCurrency(f.totalPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Spend Analytics ── */}
      <section className="ta-section">
        <h3 className="ta-section-title">Spend</h3>

        <div className="ta-stat-cards">
          <div className="ta-stat-card">
            <span className="ta-stat-value">{formatCurrency(spend.totalAllTime)}</span>
            <span className="ta-stat-label">All Time</span>
          </div>
          <div className="ta-stat-card">
            <span className="ta-stat-value">{formatCurrency(spend.last30Days)}</span>
            <span className="ta-stat-label">Last 30 Days</span>
          </div>
          <div className="ta-stat-card">
            <span className="ta-stat-value">{formatCurrency(spend.last90Days)}</span>
            <span className="ta-stat-label">Last 90 Days</span>
          </div>
        </div>

        {/* Spend by Month bar chart */}
        {spend.byMonth && spend.byMonth.length > 0 && (
          <div className="ta-chart-block">
            <h4 className="ta-chart-title">Spend by Month</h4>
            <div className="ta-bar-chart">
              {spend.byMonth.map(m => (
                <div className="ta-bar-col" key={m.month}>
                  <span className="ta-bar-value">{formatCurrency(m.amount)}</span>
                  <div className="ta-bar ta-bar--spend" style={{ height: `${(m.amount / maxSpendByMonth) * 100}%` }} />
                  <span className="ta-bar-label">{formatMonth(m.month)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spend by member — horizontal bars */}
        {spend.byMember && spend.byMember.length > 0 && (
          <div className="ta-chart-block">
            <h4 className="ta-chart-title">Spend by Member</h4>
            <div className="ta-hbar-chart">
              {spend.byMember.map(m => (
                <div className="ta-hbar-row" key={m.memberId}>
                  <span className="ta-hbar-name">{m.name}</span>
                  <div className="ta-hbar-track">
                    <div className="ta-hbar-fill" style={{ width: `${(m.amount / maxMemberSpend) * 100}%` }} />
                  </div>
                  <span className="ta-hbar-value">{formatCurrency(m.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spend by category — donut */}
        {spend.byCategory && spend.byCategory.length > 0 && spendTotal > 0 && (
          <div className="ta-chart-block">
            <h4 className="ta-chart-title">Spend by Category</h4>
            <div className="ta-donut-wrap">
              <div
                className="ta-donut"
                style={{ background: `conic-gradient(${conicStops})` }}
              >
                <div className="ta-donut-hole">
                  <span className="ta-donut-total">{formatCurrency(spendTotal)}</span>
                </div>
              </div>
              <div className="ta-donut-legend">
                {spend.byCategory.map((c, i) => {
                  const colors = [
                    'var(--color-primary, #4285f4)',
                    'var(--color-success, #22c55e)',
                    'var(--color-warning, #f59e0b)',
                    'var(--color-error, #ef4444)',
                    'var(--color-info, #8b5cf6)',
                    'var(--color-text-secondary, #94a3b8)',
                  ];
                  return (
                    <div className="ta-legend-item" key={c.category}>
                      <span className="ta-legend-dot" style={{ background: colors[i % colors.length] }} />
                      <span className="ta-legend-label">{c.category}</span>
                      <span className="ta-legend-value">{formatCurrency(c.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Performance ── */}
      <section className="ta-section">
        <h3 className="ta-section-title">Performance</h3>

        <div className="ta-perf-grid">
          {/* Completion rate — circular progress */}
          <div className="ta-perf-card">
            <div
              className="ta-circle-progress"
              style={{
                background: `conic-gradient(var(--color-success, #22c55e) ${performance.completionRate * 3.6}deg, var(--color-border, #e2e8f0) 0deg)`,
              }}
            >
              <div className="ta-circle-inner">
                <span className="ta-circle-value">{formatPercent(performance.completionRate)}</span>
              </div>
            </div>
            <span className="ta-perf-label">Completion Rate</span>
          </div>

          {/* Dispute rate */}
          <div className="ta-perf-card">
            <div
              className="ta-circle-progress"
              style={{
                background: `conic-gradient(${disputeColor(performance.disputeRate)} ${performance.disputeRate * 3.6}deg, var(--color-border, #e2e8f0) 0deg)`,
              }}
            >
              <div className="ta-circle-inner">
                <span className="ta-circle-value" style={{ color: disputeColor(performance.disputeRate) }}>
                  {formatPercent(performance.disputeRate)}
                </span>
              </div>
            </div>
            <span className="ta-perf-label">Dispute Rate</span>
          </div>

          {/* Avg job duration */}
          <div className="ta-stat-card ta-stat-card--perf">
            <span className="ta-stat-value">{performance.avgJobDuration}d</span>
            <span className="ta-stat-label">Avg Duration</span>
          </div>

          {/* On-time delivery */}
          <div className="ta-stat-card ta-stat-card--perf">
            <span className="ta-stat-value">{formatPercent(performance.onTimeDeliveryRate)}</span>
            <span className="ta-stat-label">On-Time Delivery</span>
          </div>
        </div>
      </section>

      {/* ── Team Growth ── */}
      <section className="ta-section">
        <h3 className="ta-section-title">Team Growth</h3>

        <div className="ta-stat-cards">
          <div className="ta-stat-card">
            <span className="ta-stat-value">{teamData.activeMembers}</span>
            <span className="ta-stat-label">Active Members</span>
          </div>
          <div className="ta-stat-card">
            <span className="ta-stat-value">{teamData.pendingInvites}</span>
            <span className="ta-stat-label">Pending Invites</span>
          </div>
          <div className="ta-stat-card">
            <span className="ta-stat-value">{teamData.memberCount}</span>
            <span className="ta-stat-label">Total Members</span>
          </div>
        </div>

        {/* Member growth — line with dots */}
        {teamData.memberGrowth && teamData.memberGrowth.length > 0 && (
          <div className="ta-chart-block">
            <h4 className="ta-chart-title">Member Growth</h4>
            <div className="ta-line-chart">
              <svg className="ta-line-svg" viewBox="0 0 300 100" preserveAspectRatio="none">
                {/* Line */}
                <polyline
                  className="ta-line-path"
                  fill="none"
                  stroke="var(--color-primary, #4285f4)"
                  strokeWidth="2"
                  points={teamData.memberGrowth.map((m, i) => {
                    const x = (i / Math.max(teamData.memberGrowth.length - 1, 1)) * 280 + 10;
                    const y = 90 - (m.count / maxGrowth) * 80;
                    return `${x},${y}`;
                  }).join(' ')}
                />
                {/* Dots */}
                {teamData.memberGrowth.map((m, i) => {
                  const x = (i / Math.max(teamData.memberGrowth.length - 1, 1)) * 280 + 10;
                  const y = 90 - (m.count / maxGrowth) * 80;
                  return (
                    <circle
                      key={m.month}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="var(--color-primary, #4285f4)"
                      className="ta-line-dot"
                    />
                  );
                })}
              </svg>
              <div className="ta-line-labels">
                {teamData.memberGrowth.map(m => (
                  <span key={m.month} className="ta-line-label">{formatMonth(m.month)}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
