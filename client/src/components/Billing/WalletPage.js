import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import UpgradePrompt from './UpgradePrompt';
import SEO from '../common/SEO';
import './WalletPage.css';

const PRESET_AMOUNTS = [10, 25, 50, 100];

const WalletPage = () => {
  const navigate = useNavigate();
  const [wallet, setWallet]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [amount, setAmount]       = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [error, setError]         = useState('');
  const [gated, setGated]         = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('funded') === '1') {
      const amt = params.get('amount');
      setSuccessMsg(`✅ $${parseFloat(amt).toFixed(2)} added to your wallet!`);
      window.history.replaceState({}, '', '/wallet');
    }
    if (params.get('cancelled') === '1') {
      setError('Top-up cancelled — you were not charged.');
      window.history.replaceState({}, '', '/wallet');
    }

    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const data = await apiRequest('/api/billing/wallet');
      setWallet(data);
    } catch (err) {
      if (err.data?.reason === 'feature_gated') {
        setGated(true);
      } else {
        setError(err.message || 'Could not load wallet');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async () => {
    const finalAmount = parseFloat(customAmount || amount);
    if (!finalAmount || finalAmount < 5) {
      setError('Minimum top-up is $5');
      return;
    }
    setAdding(true);
    setError('');
    try {
      const data = await apiRequest('/api/billing/wallet/add', {
        method: 'POST',
        body: JSON.stringify({ amount: finalAmount }),
      });
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (err) {
      if (err.data?.reason === 'feature_gated') {
        setGated(true);
      } else {
        setError(err.message || 'Could not start checkout');
      }
      setAdding(false);
    }
  };

  if (loading) return <div className="wallet-loading">Loading wallet…</div>;

  if (gated) {
    return (
      <div className="wallet-wrap">
      <SEO title="Wallet" path="/wallet" noIndex={true} />
        <div className="wallet-header">
          <h1 className="wallet-title">Wallet</h1>
        </div>
        <UpgradePrompt
          reason="wallet"
          onDismiss={() => navigate('/billing')}
        />
      </div>
    );
  }

  const balance  = wallet?.balance || 0;
  const active   = wallet?.active  || [];
  const history  = wallet?.history || [];

  return (
    <div className="wallet-wrap">
      <SEO title="Wallet" path="/wallet" noIndex={true} />
      <div className="wallet-header">
        <h1 className="wallet-title">Wallet</h1>
        <Link to="/billing" className="wallet-billing-link">Billing settings →</Link>
      </div>

      {successMsg && <div className="wallet-success">{successMsg}</div>}
      {error      && <div className="wallet-error">{error}</div>}

      {/* ── Balance card ── */}
      <div className="wallet-balance-card">
        <div className="wallet-balance-label">Available balance</div>
        <div className="wallet-balance-amount">${balance.toFixed(2)}</div>
        <div className="wallet-balance-note">Applied automatically to job fees and platform charges</div>
      </div>

      {/* ── Add funds ── */}
      <div className="wallet-card">
        <div className="wallet-card-title">Add funds</div>
        <div className="wallet-presets">
          {PRESET_AMOUNTS.map(a => (
            <button
              key={a}
              className={`wallet-preset-btn ${amount === String(a) && !customAmount ? 'active' : ''}`}
              onClick={() => { setAmount(String(a)); setCustomAmount(''); setError(''); }}
            >
              ${a}
            </button>
          ))}
        </div>
        <div className="wallet-custom-row">
          <input
            className="wallet-custom-input"
            type="number"
            placeholder="Custom amount"
            min="5"
            max="500"
            step="1"
            value={customAmount}
            onChange={e => { setCustomAmount(e.target.value); setAmount(''); setError(''); }}
          />
          <button
            className="wallet-add-btn"
            onClick={handleAddFunds}
            disabled={adding || (!amount && !customAmount)}
          >
            {adding ? 'Redirecting…' : `Add $${parseFloat(customAmount || amount || 0).toFixed(2)}`}
          </button>
        </div>
        <p className="wallet-add-note">Funds are added instantly via Stripe. No expiry.</p>
      </div>

      {/* ── Active credits ── */}
      {active.length > 0 && (
        <div className="wallet-card">
          <div className="wallet-card-title">Active credits</div>
          <div className="wallet-credit-list">
            {active.map(c => (
              <div key={c._id} className="wallet-credit-row">
                <div className="wallet-credit-info">
                  <span className="wallet-credit-reason">{c.reason}</span>
                  <span className="wallet-credit-date">Added {new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="wallet-credit-amount">
                  ${c.remaining?.toFixed(2)}
                  {c.amount !== c.remaining && (
                    <span className="wallet-credit-original"> of ${c.amount?.toFixed(2)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── History ── */}
      {history.length > 0 && (
        <div className="wallet-card">
          <div className="wallet-card-title">History</div>
          <div className="wallet-credit-list">
            {history.map(c => (
              <div key={c._id} className={`wallet-credit-row wallet-credit-${c.status}`}>
                <div className="wallet-credit-info">
                  <span className="wallet-credit-reason">{c.reason}</span>
                  <span className="wallet-credit-date">{new Date(c.updatedAt || c.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="wallet-credit-amount wallet-credit-used">
                  ${c.amount?.toFixed(2)}
                  <span className="wallet-credit-status-pill">{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {active.length === 0 && history.length === 0 && (
        <div className="wallet-empty">
          <p>No credits yet. Add funds above to get started.</p>
        </div>
      )}
    </div>
  );
};

export default WalletPage;

