import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './EarningsDashboard.css';

const CURRENT_YEAR = new Date().getFullYear();

export default function EarningsDashboard() {
  const { user } = useAuth();
  const [year, setYear]         = useState(CURRENT_YEAR);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/users/me/earnings?year=${year}`);
      setData(res);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`/api/users/me/earnings/export?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `fetchwork-earnings-${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
    finally { setExporting(false); }
  };

  const maxMonth = data ? Math.max(...data.monthly.map(m => m.amount), 1) : 1;

  return (
    <div className="ed-page">
      <SEO title="My Earnings — Fetchwork" />

      <div className="ed-header">
        <div>
          <h1 className="ed-title">💰 Earnings</h1>
          <p className="ed-sub">Your freelance income breakdown</p>
        </div>
        <Link to="/profile" className="ed-back">← Back to profile</Link>
      </div>

      {/* Year picker + export */}
      <div className="ed-controls">
        <div className="ed-year-tabs">
          {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => (
            <button
              key={y}
              className={`ed-year-tab ${year === y ? 'active' : ''}`}
              onClick={() => setYear(y)}
            >{y}</button>
          ))}
        </div>
        <button className="ed-export-btn" onClick={handleExport} disabled={exporting || loading}>
          {exporting ? '⏳ Exporting…' : '⬇️ Export CSV'}
        </button>
      </div>

      {loading ? (
        <div className="ed-loading">Loading earnings…</div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="ed-summary">
            <div className="ed-stat-card">
              <span className="ed-stat-label">Year to Date</span>
              <span className="ed-stat-value">${data.ytd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="ed-stat-card">
              <span className="ed-stat-label">All Time</span>
              <span className="ed-stat-value">${data.allTime.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span className="ed-stat-sub">{data.allTimeJobs} jobs</span>
            </div>
            {data.pendingEscrow > 0 && (
              <div className="ed-stat-card pending">
                <span className="ed-stat-label">Pending in Escrow</span>
                <span className="ed-stat-value">${data.pendingEscrow.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          {/* Monthly chart */}
          <div className="ed-card">
            <h2 className="ed-section-title">Monthly Breakdown — {year}</h2>
            <div className="ed-chart">
              {data.monthly.map(m => (
                <div key={m.month} className="ed-bar-col">
                  <span className="ed-bar-amount">
                    {m.amount > 0 ? `$${m.amount.toFixed(0)}` : ''}
                  </span>
                  <div className="ed-bar-track">
                    <div
                      className="ed-bar-fill"
                      style={{ height: `${(m.amount / maxMonth) * 100}%` }}
                    />
                  </div>
                  <span className="ed-bar-month">{m.name}</span>
                  {m.jobCount > 0 && (
                    <span className="ed-bar-jobs">{m.jobCount} job{m.jobCount !== 1 ? 's' : ''}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Table */}
            <table className="ed-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Jobs</th>
                  <th>Earned</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.filter(m => m.amount > 0).map(m => (
                  <tr key={m.month}>
                    <td>{m.name} {m.year}</td>
                    <td>{m.jobCount}</td>
                    <td className="ed-td-amount">${m.amount.toFixed(2)}</td>
                  </tr>
                ))}
                {data.monthly.every(m => m.amount === 0) && (
                  <tr><td colSpan={3} className="ed-empty">No earnings recorded for {year}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="ed-loading">Failed to load earnings data.</div>
      )}
    </div>
  );
}
