import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import './PackageDisplay.css';

export default function PackageDisplay({ serviceId, onSelectPackage, activePurchaseId }) {
  const [packages,  setPackages]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [buying,    setBuying]    = useState(null);
  const [message,   setMessage]   = useState(null);
  const [myPurchases, setMyPurchases] = useState([]);

  useEffect(() => {
    if (!serviceId) return;
    Promise.all([
      apiRequest(`/api/service-packages/${serviceId}`).catch(() => ({ packages: [] })),
      apiRequest('/api/service-packages/purchases/me').catch(() => ({ purchases: [] })),
    ]).then(([pkgData, purchaseData]) => {
      setPackages(pkgData.packages || []);
      const now = new Date();
      setMyPurchases((purchaseData.purchases || []).filter(p =>
        p.package?.serviceId === serviceId &&
        p.status === 'active' &&
        new Date(p.expiresAt) > now &&
        p.sessionsUsed < p.sessionsTotal
      ));
    }).finally(() => setLoading(false));
  }, [serviceId]);

  const handleBuy = async (pkg) => {
    setBuying(pkg.id);
    setMessage(null);
    try {
      const data = await apiRequest(`/api/service-packages/${pkg.id}/purchase`, { method: 'POST', body: JSON.stringify({}) });
      setMessage({ type: 'success', text: `Payment initiated for ${pkg.name}. Complete checkout to activate.` });
      // In a real implementation, redirect to Stripe checkout using data.clientSecret
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Purchase failed.' });
    } finally {
      setBuying(null);
    }
  };

  const fmt = cents => `$${(cents / 100).toFixed(0)}`;

  if (loading) return null;
  if (!packages.length && !myPurchases.length) return null;

  return (
    <div className="pkg-display">
      <h3 className="pkg-display-title">Session Packages</h3>
      <p className="pkg-display-sub">Buy multiple sessions upfront and save.</p>

      {message && (
        <div className={`pkg-display-message pkg-display-message--${message.type}`}>{message.text}</div>
      )}

      {myPurchases.length > 0 && (
        <div className="pkg-active-section">
          <p className="pkg-active-label">Your active packages:</p>
          {myPurchases.map(p => (
            <div key={p.id} className="pkg-active-card">
              <span className="pkg-active-name">{p.package?.name}</span>
              <span className="pkg-active-remaining">{p.sessionsTotal - p.sessionsUsed} sessions left</span>
              <button
                className="pkg-use-btn"
                onClick={() => onSelectPackage?.(p.id)}
              >
                Use Package Session
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pkg-display-list">
        {packages.map(pkg => (
          <div key={pkg.id} className="pkg-display-card">
            <div className="pkg-display-card-top">
              <span className="pkg-display-name">{pkg.name}</span>
              {pkg.savingsPercent > 0 && (
                <span className="pkg-display-savings-badge">Save {Math.round(pkg.savingsPercent)}%</span>
              )}
            </div>
            {pkg.description && <p className="pkg-display-desc">{pkg.description}</p>}
            <div className="pkg-display-pricing">
              <span className="pkg-display-total">{fmt(pkg.totalPriceCents)}</span>
              <span className="pkg-display-per">for {pkg.sessionCount} sessions ({fmt(pkg.pricePerSessionCents)}/session)</span>
            </div>
            <p className="pkg-display-validity">Valid for {pkg.validityDays} days after purchase</p>
            <button
              className="pkg-buy-btn"
              onClick={() => handleBuy(pkg)}
              disabled={!!buying}
            >
              {buying === pkg.id ? 'Processing…' : 'Buy Package'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
