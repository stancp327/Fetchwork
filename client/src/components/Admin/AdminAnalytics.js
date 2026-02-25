import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './AdminAnalytics.css';

const AdminAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState(30);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [overview, funnel] = await Promise.all([
        apiRequest('/api/analytics/overview'),
        apiRequest(`/api/analytics/funnel?days=${period}`)
      ]);
      setData({ ...overview, funnel: funnel.funnel });
    } catch (e) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="aa-loading">Loading analytics...</div>;
  if (error) return <div className="aa-error">{error}</div>;
  if (!data) return null;

  const { today, last30Days, conversionRate, platform, devices, topPages, chartData, funnel } = data;

  // Simple sparkline using CSS
  const maxVisitors = Math.max(...(chartData || []).map(d => d.visitors), 1);

  return (
    <div className="admin-analytics">
      {/* Period selector */}
      <div className="aa-header">
        <h2>📊 Analytics</h2>
        <div className="aa-period-btns">
          {[7, 30, 90].map(d => (
            <button key={d} className={`aa-period-btn ${period === d ? 'active' : ''}`}
              onClick={() => setPeriod(d)}>{d}d</button>
          ))}
        </div>
      </div>

      {/* Today snapshot */}
      <div className="aa-section-title">Today</div>
      <div className="aa-stat-grid">
        <div className="aa-stat-card highlight">
          <span className="aa-stat-num">{today.visitors || 0}</span>
          <span className="aa-stat-label">Visitors</span>
        </div>
        <div className="aa-stat-card">
          <span className="aa-stat-num">{today.pageViews || 0}</span>
          <span className="aa-stat-label">Page Views</span>
        </div>
        <div className="aa-stat-card">
          <span className="aa-stat-num">{today.signups || 0}</span>
          <span className="aa-stat-label">Sign Ups</span>
        </div>
        <div className="aa-stat-card">
          <span className="aa-stat-num">{today.jobsPosted || 0}</span>
          <span className="aa-stat-label">Jobs Posted</span>
        </div>
      </div>

      {/* 30-day summary */}
      <div className="aa-section-title">Last {period} Days</div>
      <div className="aa-stat-grid">
        <div className="aa-stat-card">
          <span className="aa-stat-num">{last30Days.visitors}</span>
          <span className="aa-stat-label">Total Visitors</span>
        </div>
        <div className="aa-stat-card">
          <span className="aa-stat-num">{last30Days.pageViews}</span>
          <span className="aa-stat-label">Page Views</span>
        </div>
        <div className="aa-stat-card">
          <span className="aa-stat-num">{last30Days.signups}</span>
          <span className="aa-stat-label">Sign Ups</span>
        </div>
        <div className="aa-stat-card highlight">
          <span className="aa-stat-num">{conversionRate}%</span>
          <span className="aa-stat-label">Conversion Rate</span>
        </div>
        <div className="aa-stat-card">
          <span className="aa-stat-num">{last30Days.jobsPosted}</span>
          <span className="aa-stat-label">Jobs Posted</span>
        </div>
        <div className="aa-stat-card">
          <span className="aa-stat-num">{last30Days.proposalsSent}</span>
          <span className="aa-stat-label">Proposals</span>
        </div>
        <div className="aa-stat-card">
          <span className="aa-stat-num">{last30Days.jobsCompleted}</span>
          <span className="aa-stat-label">Completed</span>
        </div>
        <div className="aa-stat-card">
          <span className="aa-stat-num">{last30Days.messagesExchanged}</span>
          <span className="aa-stat-label">Messages</span>
        </div>
      </div>

      {/* Visitor chart */}
      {chartData?.length > 0 && (
        <>
          <div className="aa-section-title">Visitor Trend</div>
          <div className="aa-chart">
            {chartData.map((d, i) => (
              <div key={i} className="aa-bar-col" title={`${d.date}: ${d.visitors} visitors`}>
                <div className="aa-bar" style={{ height: `${Math.max((d.visitors / maxVisitors) * 100, 2)}%` }} />
                {i % 5 === 0 && <span className="aa-bar-label">{d.date.slice(5)}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Conversion funnel */}
      {funnel?.length > 0 && (
        <>
          <div className="aa-section-title">Conversion Funnel ({period}d)</div>
          <div className="aa-funnel">
            {funnel.map((step, i) => (
              <div key={i} className="aa-funnel-step">
                <div className="aa-funnel-bar" style={{ width: `${Math.max(parseFloat(step.pct), 5)}%` }}>
                  <span>{step.stage}</span>
                </div>
                <div className="aa-funnel-nums">
                  <strong>{step.count}</strong>
                  <span>{step.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Platform stats */}
      <div className="aa-section-title">Platform</div>
      <div className="aa-stat-grid cols-3">
        <div className="aa-stat-card">
          <span className="aa-stat-num">{platform.totalUsers}</span>
          <span className="aa-stat-label">Total Users</span>
        </div>
        <div className="aa-stat-card">
          <span className="aa-stat-num">{platform.activeUsers30d}</span>
          <span className="aa-stat-label">Active (30d)</span>
        </div>
        <div className="aa-stat-card">
          <span className="aa-stat-num">{platform.totalJobs}</span>
          <span className="aa-stat-label">Total Jobs</span>
        </div>
        <div className="aa-stat-card">
          <span className="aa-stat-num">{platform.openJobs}</span>
          <span className="aa-stat-label">Open Jobs</span>
        </div>
        <div className="aa-stat-card">
          <span className="aa-stat-num">{platform.totalServices}</span>
          <span className="aa-stat-label">Active Services</span>
        </div>
      </div>

      {/* Device breakdown */}
      {Object.keys(devices || {}).length > 0 && (
        <>
          <div className="aa-section-title">Devices (7d)</div>
          <div className="aa-devices">
            {Object.entries(devices).map(([device, count]) => {
              const total = Object.values(devices).reduce((a, b) => a + b, 0);
              const pct = ((count / total) * 100).toFixed(0);
              const icon = device === 'mobile' ? '📱' : device === 'tablet' ? '📋' : device === 'desktop' ? '🖥️' : '❓';
              return (
                <div key={device} className="aa-device-row">
                  <span>{icon} {device}</span>
                  <div className="aa-device-bar"><div style={{ width: `${pct}%` }} /></div>
                  <span>{pct}% ({count})</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Top pages */}
      {topPages?.length > 0 && (
        <>
          <div className="aa-section-title">Top Pages (7d)</div>
          <div className="aa-pages">
            {topPages.map((p, i) => (
              <div key={i} className="aa-page-row">
                <span className="aa-page-path">{p.path}</span>
                <span className="aa-page-views">{p.views} views</span>
                <span className="aa-page-unique">{p.unique} unique</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAnalytics;
