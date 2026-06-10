import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../common/SEO';
import { apiRequest } from '../../utils/api';
import './BookingAnalytics.css';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtCents(cents) {
  if (!cents) return '$0';
  return `$${(cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className={`ba-stat-card ${color || ''}`}>
      <div className="ba-stat-value">{value}</div>
      <div className="ba-stat-label">{label}</div>
      {sub && <div className="ba-stat-sub">{sub}</div>}
    </div>
  );
}

function BarChart({ trends }) {
  if (!trends || trends.length === 0) {
    return <p className="ba-chart-empty">No trend data yet.</p>;
  }
  const maxVal = Math.max(...trends.map(t => t.bookings), 1);

  return (
    <div className="ba-chart">
      {trends.map((t, i) => {
        const height = Math.max(4, Math.round((t.bookings / maxVal) * 120));
        const weekLabel = t.week
          ? new Date(t.week + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : `Wk ${i + 1}`;
        return (
          <div key={t.week || i} className="ba-chart-col">
            <span className="ba-chart-tip">{t.bookings}</span>
            <div
              className="ba-chart-bar"
              style={{ height }}
              title={`${weekLabel}: ${t.bookings} bookings, ${fmtCents(t.revenue)}`}
            />
            <span className="ba-chart-label">{weekLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

const BookingAnalytics = () => {
  const [stats, setStats]   = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsData, trendsData] = await Promise.all([
          apiRequest('/api/booking-analytics'),
          apiRequest('/api/booking-analytics/trends?period=weekly&weeks=12'),
        ]);
        setStats(statsData);
        setTrends(trendsData.trends || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="ba-loading">Loading analytics…</div>;
  if (error)   return <div className="ba-error">Error: {error}</div>;
  if (!stats)  return null;

  return (
    <div className="ba-page">
      <SEO title="Booking Analytics | Fetchwork" path="/booking-analytics" noIndex />

      <div className="ba-header">
        <Link to="/bookings" className="ba-back">← My Bookings</Link>
        <h1 className="ba-title">Booking Analytics</h1>
      </div>

      {/* Top row: 4 stat cards */}
      <div className="ba-stats-row">
        <StatCard
          label="Bookings This Month"
          value={stats.bookingsThisMonth}
          sub={`${stats.bookingsTotal} total`}
          color="blue"
        />
        <StatCard
          label="Revenue This Month"
          value={fmtCents(stats.revenueThisMonth)}
          sub={`${fmtCents(stats.revenueTotal)} total`}
          color="green"
        />
        <StatCard
          label="Completion Rate"
          value={`${stats.completionRate}%`}
          sub="of non-cancelled"
          color="teal"
        />
        <StatCard
          label="Repeat Clients"
          value={`${stats.repeatClientRate}%`}
          sub="booked 2+ times"
          color="purple"
        />
      </div>

      {/* Weekly bookings trend chart */}
      <div className="ba-card">
        <h2 className="ba-section-title">Weekly Bookings (Last 12 Weeks)</h2>
        <BarChart trends={trends} />
      </div>

      {/* Bottom row */}
      <div className="ba-bottom-row">
        <div className="ba-card ba-card-sm">
          <h2 className="ba-section-title">Peak Times</h2>
          <div className="ba-peak-item">
            <span className="ba-peak-label">Busiest Day</span>
            <span className="ba-peak-value">
              {stats.busiestDayOfWeek != null ? DAY_NAMES[stats.busiestDayOfWeek] : '—'}
            </span>
          </div>
          <div className="ba-peak-item">
            <span className="ba-peak-label">Busiest Hour</span>
            <span className="ba-peak-value">
              {stats.busiestHourOfDay != null
                ? (() => {
                    const h = stats.busiestHourOfDay;
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    return `${h % 12 || 12}:00 ${ampm}`;
                  })()
                : '—'}
            </span>
          </div>
        </div>

        <div className="ba-card ba-card-sm">
          <h2 className="ba-section-title">Session Stats</h2>
          <div className="ba-peak-item">
            <span className="ba-peak-label">Avg Session Value</span>
            <span className="ba-peak-value">{fmtCents(stats.averageSessionValueCents)}</span>
          </div>
          <div className="ba-peak-item">
            <span className="ba-peak-label">No-Show Rate</span>
            <span className="ba-peak-value">{stats.noShowRate}%</span>
          </div>
          <div className="ba-peak-item">
            <span className="ba-peak-label">Upcoming Confirmed</span>
            <span className="ba-peak-value">{stats.upcomingCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingAnalytics;
