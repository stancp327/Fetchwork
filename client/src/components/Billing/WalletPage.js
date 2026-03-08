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
  const [payoutStatus, setPayoutStatus] = useState(null); // { connected, payoutsEnabled }
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing]     = useState(false);

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
    // Check if user has Stripe Connect (for withdraw section)
    apiRequest('/api/payments/status')
      .then(d => setPayoutStatus(d))
      .catch(() => {});
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

  const handleWithdraw = async () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 1) { setError('Minimum withdrawal is $1'); return; }
    if (amt > balance) { setError('Withdrawal exceeds wallet balance'); return; }
    setWithdrawing(true);
    setError('');
    try {
      const data = await apiRequest('/api/billing/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: amt }),
      });
      setSuccessMsg(`$${data.withdrawn.toFixed(2)} withdrawn to your bank account`);
      setWithdrawAmount('');
      fetchWallet();
    } catch (err) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
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

  if (loading) return <div className="wp-wallet-loading">Loading wallet…</div>;

  if (gated) {
    return (
      <div className="wp-wallet-wrap">
      <SEO title="Wallet" path="/wallet" noIndex={true} />
        <div className="wp-wallet-header">
          <h1 className="wp-wallet-title">Wallet</h1>
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
    <div className="wp-wallet-wrap">
      <SEO title="Wallet" path="/wallet" noIndex={true} />
      <div className="wp-wallet-header">
        <h1 className="wp-wallet-title">Wallet</h1>
        <Link to="/billing" className="wp-wallet-billing-link">Billing settings →</Link>
      </div>

      {successMsg && <div className="wp-wallet-success">{successMsg}</div>}
      {error      && <div className="wp-wallet-error">{error}</div>}

      {/* ── Balance card ── */}
      <div className="wp-wallet-balance-card">
        <div className="wp-wallet-balance-label">Available balance</div>
        <div className="wp-wallet-balance-amount">${balance.toFixed(2)}</div>
        <div className="wp-wallet-balance-note">Applied automatically to job fees and platform charges</div>
      </div>

      {/* ── Add funds ── */}
      <div className="wp-wallet-card">
        <div className="wp-wallet-card-title">Add funds</div>
        <div className="wp-wallet-presets">
          {PRESET_AMOUNTS.map(a => (
            <button
              key={a}
              className={`wp-wallet-preset-btn ${amount === String(a) && !customAmount ? 'active' : ''}`}
              onClick={() => { setAmount(String(a)); setCustomAmount(''); setError(''); }}
            >
              ${a}
            </button>
          ))}
        </div>
        <div className="wp-wallet-custom-row">
          <input
            className="wp-wallet-custom-input"
            type="number"
            placeholder="Custom amount"
            min="5"
            max="500"
            step="1"
            value={customAmount}
            onChange={e => { setCustomAmount(e.target.value); setAmount(''); setError(''); }}
          />
          <button
            className="wp-wallet-add-btn"
            onClick={handleAddFunds}
            disabled={adding || (!amount && !customAmount)}
          >
            {adding ? 'Redirecting…' : `Add $${parseFloat(customAmount || amount || 0).toFixed(2)}`}
          </button>
        </div>
        <p className="wp-wallet-add-note">Funds are added instantly via Stripe. No expiry.</p>
      </div>

      {/* ── Withdraw funds (freelancers with Stripe Connect) ── */}
      {payoutStatus?.connected && payoutStatus?.payoutsEnabled && balance > 0 && (
        <div className="wp-wallet-card">
          <div className="wp-wallet-card-title">Withdraw to bank</div>
          <div className="wp-wallet-custom-row">
            <input
              className="wp-wallet-custom-input"
              type="number"
              placeholder="Amount to withdraw"
              min="1"
              max={balance}
              step="0.01"
              value={withdrawAmount}
              onChange={e => { setWithdrawAmount(e.target.value); setError(''); }}
            />
            <button
              className="wp-wallet-add-btn"
              onClick={handleWithdraw}
              disabled={withdrawing || !withdrawAmount}
              style={{ background: '#059669' }}
            >
              {withdrawing ? 'Processing…' : `Withdraw $${parseFloat(withdrawAmount || 0).toFixed(2)}`}
            </button>
          </div>
          <p className="wp-wallet-add-note">
            Transferred to your connected Stripe account. May take 1–2 business days.
          </p>
        </div>
      )}

      {/* ── Active credits ── */}
      {active.length > 0 && (
        <div className="wp-wallet-card">
          <div className="wp-wallet-card-title">Active credits</div>
          <div className="wp-wallet-credit-list">
            {active.map(c => (
              <div key={c._id} className="wp-wallet-credit-row">
                <div className="wp-wallet-credit-info">
                  <span className="wp-wallet-credit-reason">{c.reason}</span>
                  <span className="wp-wallet-credit-date">Added {new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="wp-wallet-credit-amount">
                  ${c.remaining?.toFixed(2)}
                  {c.amount !== c.remaining && (
                    <span className="wp-wallet-credit-original"> of ${c.amount?.toFixed(2)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── History ── */}
      {history.length > 0 && (
        <div className="wp-wallet-card">
          <div className="wp-wallet-card-title">History</div>
          <div className="wp-wallet-credit-list">
            {history.map(c => (
              <div key={c._id} className={`wp-wallet-credit-row wp-wallet-credit-${c.status}`}>
                <div className="wp-wallet-credit-info">
                  <span className="wp-wallet-credit-reason">{c.reason}</span>
                  <span className="wp-wallet-credit-date">{new Date(c.updatedAt || c.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="wp-wallet-credit-amount wp-wallet-credit-used">
                  ${c.amount?.toFixed(2)}
                  <span className="wp-wallet-credit-status-pill">{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {active.length === 0 && history.length === 0 && (
        <div className="wp-wallet-empty">
          <p>No credits yet. Add funds above to get started.</p>
        </div>
      )}
    </div>
  );
};

export default WalletPage;

