import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './MyPackages.css';

export default function MyPackages() {
  const [purchases, setPurchases] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiRequest('/api/service-packages/purchases/me')
      .then(data => setPurchases(data.purchases || []))
      .catch(() => setError('Failed to load your packages.'))
      .finally(() => setLoading(false));
  }, []);

  const fmt = cents => `$${(cents / 100).toFixed(2)}`;
  const fmtDate = iso => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const statusLabel = (p) => {
    if (p.status === 'exhausted') return { text: 'Used up', color: '#6b7280' };
    if (p.status === 'expired')   return { text: 'Expired', color: '#dc2626' };
    if (new Date(p.expiresAt) < new Date()) return { text: 'Expired', color: '#dc2626' };
    return { text: 'Active', color: '#10b981' };
  };

  if (loading) return (
    <div className="my-packages">
      <div className="my-pkg-loading">Loading your packages…</div>
    </div>
  );

  return (
    <div className="my-packages">
      <h2 className="my-pkg-title">My Session Packages</h2>
      <p className="my-pkg-subtitle">Pre-purchased session bundles. Use them when booking a service.</p>

      {error && <div className="my-pkg-error">{error}</div>}

      {!loading && purchases.length === 0 && (
        <div className="my-pkg-empty">
          <p>You haven't purchased any session packages yet.</p>
          <button className="my-pkg-browse-btn" onClick={() => navigate('/browse-services')}>
            Browse Services
          </button>
        </div>
      )}

      <div className="my-pkg-list">
        {purchases.map(p => {
          const remaining = p.sessionsTotal - p.sessionsUsed;
          const pct       = Math.round((remaining / p.sessionsTotal) * 100);
          const sl        = statusLabel(p);

          return (
            <div key={p.id} className="my-pkg-card">
              <div className="my-pkg-card-header">
                <span className="my-pkg-name">{p.package?.name || 'Session Package'}</span>
                <span className="my-pkg-status-badge" style={{ color: sl.color }}>
                  {sl.text}
                </span>
              </div>

              <div className="my-pkg-progress-bar">
                <div className="my-pkg-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="my-pkg-sessions">
                <strong>{remaining}</strong> of {p.sessionsTotal} sessions remaining
              </p>

              <div className="my-pkg-meta">
                <span>Paid: {fmt(p.paidAmountCents)}</span>
                <span>Expires: {fmtDate(p.expiresAt)}</span>
                <span>Purchased: {fmtDate(p.purchasedAt)}</span>
              </div>

              {sl.text === 'Active' && remaining > 0 && (
                <button
                  className="my-pkg-book-btn"
                  onClick={() => navigate('/browse-services')}
                >
                  Book a Session
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
