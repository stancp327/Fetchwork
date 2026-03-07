/**
 * AdminUserCard
 * Full-panel user profile card for admin.
 * Replaces AdminUserDrawer with:
 *  - Wallet tab (balance, freeze, credit/debit, history)
 *  - Plan with price + duration override
 *  - Per-user feature flags
 *  - Suspend / delete / roles / fee waiver
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import { formatBudget } from '../../utils/formatters';
import FeatureFlagsPanel from './FeatureFlagsPanel';
import './AdminUserCard.css';

// ─── helpers ──────────────────────────────────────────────────────────────────
const Avatar = ({ user, size = 56 }) => {
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || '?';
  return user?.profilePicture ? (
    <img src={user.profilePicture} alt="" className="auc-avatar-img" style={{ width: size, height: size }} />
  ) : (
    <div className="auc-avatar-initials" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials}</div>
  );
};

const Stat = ({ label, value, highlight }) => (
  <div className={`auc-stat ${highlight ? 'auc-stat--highlight' : ''}`}>
    <div className="auc-stat-val">{value ?? '—'}</div>
    <div className="auc-stat-lbl">{label}</div>
  </div>
);

const Row = ({ label, value }) => (
  <div className="auc-row">
    <span className="auc-row-label">{label}</span>
    <span className="auc-row-value">{value ?? '—'}</span>
  </div>
);

const Section = ({ title, children }) => (
  <div className="auc-section">
    <h4 className="auc-section-title">{title}</h4>
    {children}
  </div>
);

// ─── Wallet Tab ───────────────────────────────────────────────────────────────
const WalletTab = ({ userId, frozen: initFrozen, frozenReason: initReason }) => {
  const [walletData, setWalletData]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [frozen, setFrozen]           = useState(initFrozen || false);
  const [freezeReason, setFreezeReason] = useState('');
  const [creditAmt, setCreditAmt]     = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [debitAmt, setDebitAmt]       = useState('');
  const [debitReason, setDebitReason] = useState('');
  const [saving, setSaving]           = useState('');
  const [msg, setMsg]                 = useState('');

  const flash = (text, isErr) => { setMsg({ text, isErr }); setTimeout(() => setMsg(''), 4000); };

  const loadWallet = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiRequest(`/api/admin/users/${userId}/wallet`);
      setWalletData(d);
      setFrozen(d.walletFrozen || false);
    } catch { flash('Failed to load wallet', true); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  const handleFreeze = async () => {
    if (!frozen && !freezeReason.trim()) { flash('Enter a reason before freezing', true); return; }
    if (frozen ? !window.confirm('Unfreeze this wallet?') : !window.confirm(`Freeze wallet? Reason: "${freezeReason}"`)) return;
    setSaving('freeze');
    try {
      await apiRequest(`/api/admin/wallets/${userId}/freeze`, {
        method: 'PUT',
        body: JSON.stringify({ freeze: !frozen, reason: freezeReason }),
      });
      setFrozen(f => !f);
      setFreezeReason('');
      flash(frozen ? '✅ Wallet unfrozen' : '🧊 Wallet frozen');
      await loadWallet();
    } catch (e) { flash(e.message || 'Failed', true); }
    setSaving('');
  };

  const handleAdjust = async (type) => {
    const amt = type === 'credit' ? creditAmt : debitAmt;
    const reason = type === 'credit' ? creditReason : debitReason;
    if (!amt || !reason) { flash('Amount and reason required', true); return; }
    setSaving(type);
    try {
      await apiRequest(`/api/admin/wallets/${userId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ type, amount: Number(amt), reason }),
      });
      flash(`✅ $${amt} ${type === 'credit' ? 'added' : 'deducted'}`);
      if (type === 'credit') { setCreditAmt(''); setCreditReason(''); }
      else { setDebitAmt(''); setDebitReason(''); }
      await loadWallet();
    } catch (e) { flash(e.message || 'Failed', true); }
    setSaving('');
  };

  const STATUS_COLORS = { active: '#16a34a', used: '#6b7280', expired: '#ef4444', voided: '#ef4444' };

  if (loading) return <div className="auc-loading">Loading wallet…</div>;

  return (
    <div className="auc-wallet">
      {msg && <div className={`auc-msg ${msg.isErr ? 'auc-msg--err' : 'auc-msg--ok'}`}>{msg.text}</div>}

      {/* Balance + freeze status */}
      <div className={`auc-wallet-hero ${frozen ? 'auc-wallet-hero--frozen' : ''}`}>
        <div>
          <div className="auc-wallet-balance">${(walletData?.balance || 0).toFixed(2)}</div>
          <div className="auc-wallet-label">Wallet Balance</div>
        </div>
        <div className={`auc-freeze-chip ${frozen ? 'auc-freeze-chip--frozen' : 'auc-freeze-chip--ok'}`}>
          {frozen ? '🧊 FROZEN' : '✅ Active'}
        </div>
      </div>

      {walletData?.walletFrozenAt && (
        <div className="auc-frozen-info">
          🧊 Frozen {new Date(walletData.walletFrozenAt).toLocaleDateString()} — {walletData.walletFrozenReason}
        </div>
      )}

      {/* Freeze / unfreeze */}
      <Section title={frozen ? '🔓 Unfreeze Wallet' : '🧊 Freeze Wallet'}>
        {!frozen && (
          <input
            className="auc-input"
            placeholder="Reason (required to freeze)"
            value={freezeReason}
            onChange={e => setFreezeReason(e.target.value)}
          />
        )}
        <button
          className={`auc-btn ${frozen ? 'auc-btn--success' : 'auc-btn--danger'}`}
          onClick={handleFreeze}
          disabled={saving === 'freeze'}
        >
          {saving === 'freeze' ? 'Working…' : frozen ? '🔓 Unfreeze Wallet' : '🧊 Freeze Wallet'}
        </button>
      </Section>

      {/* Credit / debit */}
      <div className="auc-adj-grid">
        <Section title="➕ Add Funds">
          <input className="auc-input" type="number" placeholder="Amount ($)" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} min="0.01" step="0.01" />
          <input className="auc-input" placeholder="Reason" value={creditReason} onChange={e => setCreditReason(e.target.value)} />
          <button className="auc-btn auc-btn--success" onClick={() => handleAdjust('credit')} disabled={saving === 'credit'}>
            {saving === 'credit' ? 'Adding…' : 'Add Funds'}
          </button>
        </Section>
        <Section title="➖ Deduct Funds">
          <input className="auc-input" type="number" placeholder="Amount ($)" value={debitAmt} onChange={e => setDebitAmt(e.target.value)} min="0.01" step="0.01" />
          <input className="auc-input" placeholder="Reason" value={debitReason} onChange={e => setDebitReason(e.target.value)} />
          <button className="auc-btn auc-btn--warning" onClick={() => handleAdjust('debit')} disabled={saving === 'debit'}>
            {saving === 'debit' ? 'Deducting…' : 'Deduct Funds'}
          </button>
        </Section>
      </div>

      {/* Transaction history */}
      <Section title={`📋 Transaction History (${walletData?.history?.length || 0})`}>
        {(walletData?.history || []).length === 0 ? (
          <p className="auc-empty">No transactions</p>
        ) : (
          <div className="auc-txn-list">
            {(walletData.history || []).map(t => (
              <div key={t._id} className="auc-txn-row">
                <div className="auc-txn-info">
                  <span className="auc-txn-reason">{t.reason}</span>
                  <span className="auc-txn-date">{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="auc-txn-right">
                  <span className="auc-txn-amount">+${t.amount?.toFixed(2)}</span>
                  <span className="auc-txn-status" style={{ color: STATUS_COLORS[t.status] || '#6b7280' }}>
                    {t.status}{t.remaining != null && t.status === 'active' ? ` ($${t.remaining?.toFixed(2)} left)` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
};

// ─── Billing Tab ──────────────────────────────────────────────────────────────
const BillingTab = ({ userId }) => {
  const [billingData, setBillingData] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState('');
  const [msg, setMsg]                 = useState('');

  // Grant plan fields
  const [planSlug, setPlanSlug]           = useState('');
  const [customPrice, setCustomPrice]     = useState('');
  const [durationDays, setDurationDays]   = useState('');
  const [grantReason, setGrantReason]     = useState('');

  // Credit fields
  const [creditAmt, setCreditAmt]         = useState('');
  const [creditReason, setCreditReason]   = useState('');

  const flash = (text, isErr) => { setMsg({ text, isErr }); setTimeout(() => setMsg(''), 4000); };

  const loadBilling = useCallback(async () => {
    setLoading(true);
    try { setBillingData(await apiRequest(`/api/admin/users/${userId}/billing`)); }
    catch { flash('Failed to load billing', true); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { loadBilling(); }, [loadBilling]);

  const handleGrantPlan = async () => {
    if (!planSlug || !grantReason) { flash('Plan and reason required', true); return; }
    setSaving('grant');
    try {
      const body = { planSlug, reason: grantReason };
      if (customPrice) body.customPrice = Number(customPrice);
      if (durationDays) body.expiresAt = new Date(Date.now() + Number(durationDays) * 86400000).toISOString();
      await apiRequest(`/api/admin/users/${userId}/billing/grant`, { method: 'POST', body: JSON.stringify(body) });
      flash('✅ Plan granted');
      setPlanSlug(''); setCustomPrice(''); setDurationDays(''); setGrantReason('');
      await loadBilling();
    } catch (e) { flash(e.message || 'Failed', true); }
    setSaving('');
  };

  const handleCredit = async () => {
    if (!creditAmt || !creditReason) { flash('Amount and reason required', true); return; }
    setSaving('credit');
    try {
      await apiRequest(`/api/admin/users/${userId}/billing/credit`, {
        method: 'POST', body: JSON.stringify({ amount: Number(creditAmt), reason: creditReason }),
      });
      flash(`✅ $${creditAmt} credit added`);
      setCreditAmt(''); setCreditReason('');
      await loadBilling();
    } catch (e) { flash(e.message || 'Failed', true); }
    setSaving('');
  };

  if (loading) return <div className="auc-loading">Loading billing…</div>;

  const sub = billingData?.subscription;
  const expiresIn = sub?.grantExpiresAt
    ? Math.ceil((new Date(sub.grantExpiresAt) - Date.now()) / 86400000)
    : null;

  return (
    <div className="auc-billing">
      {msg && <div className={`auc-msg ${msg.isErr ? 'auc-msg--err' : 'auc-msg--ok'}`}>{msg.text}</div>}

      {/* Current Plan */}
      <Section title="📦 Current Plan">
        <div className="auc-plan-card">
          <div className="auc-plan-name">{sub?.plan?.name || 'Free (default)'}</div>
          <div className="auc-plan-meta">
            <span className={`auc-plan-status ${sub?.status}`}>{sub?.status || 'active'}</span>
            {sub?.customPrice != null && (
              <span className="auc-plan-override">💰 Custom price: ${sub.customPrice}/mo</span>
            )}
            {sub?.grandfathered && <span className="auc-plan-flag">🔒 Grandfathered</span>}
          </div>
          {sub?.grantExpiresAt && (
            <div className={`auc-plan-expiry ${expiresIn <= 7 ? 'auc-plan-expiry--warn' : ''}`}>
              ⏱ {expiresIn > 0 ? `Expires in ${expiresIn} day${expiresIn !== 1 ? 's' : ''}` : 'Expired'} — {new Date(sub.grantExpiresAt).toLocaleDateString()}
              <span className="auc-plan-expiry-note"> Then resets to Free</span>
            </div>
          )}
          {sub?.currentPeriodEnd && !sub?.grantExpiresAt && (
            <div className="auc-plan-expiry">Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}</div>
          )}
        </div>
      </Section>

      {/* Grant Plan with Price + Duration Override */}
      <Section title="🎁 Grant Plan Override">
        <div className="auc-billing-note">
          Set a plan (optionally with a custom price and/or duration). When the duration expires, the user reverts to Free automatically.
        </div>
        <div className="auc-grant-grid">
          <div className="auc-field">
            <label className="auc-label">Plan</label>
            <select className="auc-input" value={planSlug} onChange={e => setPlanSlug(e.target.value)}>
              <option value="">Select plan…</option>
              <optgroup label="Freelancer">
                <option value="freelancer_free">Freelancer Free</option>
                <option value="freelancer_plus">Freelancer Plus</option>
                <option value="freelancer_pro">Freelancer Pro</option>
              </optgroup>
              <optgroup label="Client">
                <option value="client_free">Client Free</option>
                <option value="client_plus">Client Plus</option>
                <option value="client_business">Client Business</option>
              </optgroup>
            </select>
          </div>
          <div className="auc-field">
            <label className="auc-label">Custom Price ($/mo) <span className="auc-label-hint">optional — leave blank to use plan default</span></label>
            <input className="auc-input" type="number" placeholder="e.g. 9.99" value={customPrice} onChange={e => setCustomPrice(e.target.value)} min="0" step="0.01" />
          </div>
          <div className="auc-field">
            <label className="auc-label">Duration (days) <span className="auc-label-hint">optional — leave blank for permanent</span></label>
            <input className="auc-input" type="number" placeholder="e.g. 30" value={durationDays} onChange={e => setDurationDays(e.target.value)} min="1" step="1" />
          </div>
          <div className="auc-field">
            <label className="auc-label">Reason <span className="auc-label-req">*</span></label>
            <input className="auc-input" placeholder="e.g. New user promotion" value={grantReason} onChange={e => setGrantReason(e.target.value)} />
          </div>
        </div>
        {planSlug && durationDays && customPrice && (
          <div className="auc-grant-preview">
            Grant <strong>{planSlug}</strong> at <strong>${customPrice}/mo</strong> for <strong>{durationDays} days</strong>
            {' '}→ expires <strong>{new Date(Date.now() + Number(durationDays) * 86400000).toLocaleDateString()}</strong>, then resets to Free
          </div>
        )}
        <button className="auc-btn auc-btn--primary" onClick={handleGrantPlan} disabled={!planSlug || !grantReason || saving === 'grant'}>
          {saving === 'grant' ? 'Granting…' : '🎁 Apply Plan Override'}
        </button>
      </Section>

      {/* Add billing credit */}
      <Section title="💳 Add Billing Credit">
        <div className="auc-grant-grid">
          <div className="auc-field">
            <label className="auc-label">Amount ($)</label>
            <input className="auc-input" type="number" placeholder="e.g. 20.00" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} min="0.01" step="0.01" />
          </div>
          <div className="auc-field">
            <label className="auc-label">Reason <span className="auc-label-req">*</span></label>
            <input className="auc-input" placeholder="e.g. Service recovery credit" value={creditReason} onChange={e => setCreditReason(e.target.value)} />
          </div>
        </div>
        <button className="auc-btn auc-btn--success" onClick={handleCredit} disabled={!creditAmt || !creditReason || saving === 'credit'}>
          {saving === 'credit' ? 'Adding…' : '➕ Add Credit'}
        </button>
      </Section>

      {/* Audit log */}
      {billingData?.auditLog?.length > 0 && (
        <Section title={`📋 Audit Log (${billingData.auditLog.length})`}>
          <div className="auc-audit-list">
            {billingData.auditLog.slice(0, 15).map(log => (
              <div key={log._id} className="auc-audit-row">
                <span className="auc-audit-action">{log.action?.replace(/_/g, ' ')}</span>
                <span className="auc-audit-note">{log.note || '—'}</span>
                <span className="auc-audit-date">{new Date(log.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

// ─── Actions Tab ──────────────────────────────────────────────────────────────
const ActionsTab = ({ u, onRefresh, onClose }) => {
  const [saving, setSaving] = useState('');
  const isWaived = u?.feeWaiver?.enabled;

  const doAction = async (label, fn) => {
    setSaving(label);
    try { await fn(); onRefresh?.(); }
    catch (e) { alert(e.message || 'Action failed'); }
    setSaving('');
  };

  const handleSuspend = () => {
    const reason = prompt('Reason for suspension:');
    if (!reason) return;
    const days = prompt('Days (blank = indefinite):');
    doAction('suspend', () => apiRequest(`/api/admin/users/${u._id}/suspend`, {
      method: 'PUT', body: JSON.stringify({ reason, duration: days ? parseInt(days) : undefined }),
    }));
  };

  const handleFeeWaiver = () => {
    if (isWaived) {
      if (window.confirm('Remove fee waiver?'))
        doAction('waiver', () => apiRequest(`/api/admin/users/${u._id}/fee-waiver`, { method: 'PUT', body: JSON.stringify({ enabled: false }) }));
    } else {
      const reason = prompt('Waiver reason:', 'Promo') || 'Promo';
      const maxJobs = prompt('Max free jobs (blank = unlimited):', '10');
      const days = prompt('Duration in days (blank = 30):', '30');
      const expiresAt = new Date(Date.now() + (parseInt(days) || 30) * 86400000).toISOString();
      doAction('waiver', () => apiRequest(`/api/admin/users/${u._id}/fee-waiver`, {
        method: 'PUT', body: JSON.stringify({ enabled: true, reason, expiresAt, maxJobs: maxJobs ? parseInt(maxJobs) : null }),
      }));
    }
  };

  const handleDelete = () => {
    if (!window.confirm(`Permanently delete ${u.firstName}'s account? This cannot be undone.`)) return;
    const reason = prompt('Reason for deletion:');
    if (!reason) return;
    doAction('delete', () => apiRequest(`/api/admin/users/${u._id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }));
  };

  return (
    <div className="auc-actions">
      <Section title="🔐 Account Status">
        <div className="auc-action-group">
          {u.isSuspended ? (
            <button className="auc-btn auc-btn--success auc-btn--wide" onClick={() => doAction('unsuspend', () => apiRequest(`/api/admin/users/${u._id}/unsuspend`, { method: 'PUT' }))} disabled={saving === 'unsuspend'}>
              ✅ Unsuspend Account
            </button>
          ) : (
            <button className="auc-btn auc-btn--warning auc-btn--wide" onClick={handleSuspend} disabled={saving === 'suspend'}>
              ⛔ Suspend Account
            </button>
          )}
          <button className="auc-btn auc-btn--danger auc-btn--wide" onClick={handleDelete} disabled={saving === 'delete'}>
            🗑️ Delete Account Permanently
          </button>
        </div>
      </Section>

      <Section title="👥 Role Management">
        <div className="auc-action-group">
          {u.role === 'moderator' ? (
            <button className="auc-btn auc-btn--wide" onClick={() => doAction('remove-mod', () => apiRequest(`/api/admin/users/${u._id}/remove-moderator`, { method: 'PUT' }))} disabled={saving === 'remove-mod'}>
              🛡️ Remove Moderator Role
            </button>
          ) : (
            <button className="auc-btn auc-btn--primary auc-btn--wide" onClick={() => doAction('moderator', () => apiRequest(`/api/admin/users/${u._id}/make-moderator`, { method: 'PUT', body: JSON.stringify({ permissions: ['job_management', 'content_moderation', 'dispute_management'] }) }))} disabled={saving === 'moderator'}>
              🛡️ Make Moderator
            </button>
          )}
          {u.role !== 'admin' ? (
            <button className="auc-btn auc-btn--wide" onClick={() => doAction('admin', () => apiRequest(`/api/admin/users/${u._id}/promote`, { method: 'PUT' }))} disabled={saving === 'admin'}>
              👑 Promote to Admin
            </button>
          ) : (
            <button className="auc-btn auc-btn--warning auc-btn--wide" onClick={() => { if (window.confirm('Remove admin?')) doAction('admin', () => apiRequest(`/api/admin/users/${u._id}/demote`, { method: 'PUT' })); }} disabled={saving === 'admin'}>
              👑 Demote from Admin
            </button>
          )}
        </div>
      </Section>

      <Section title="💸 Fee Management">
        <div className="auc-action-group">
          {isWaived && (
            <div className="auc-waiver-active">
              💚 Fee waiver active — {u.feeWaiver.reason} · {u.feeWaiver.jobsUsed || 0}/{u.feeWaiver.maxJobs || '∞'} jobs
              {u.feeWaiver.expiresAt && ` · Exp ${new Date(u.feeWaiver.expiresAt).toLocaleDateString()}`}
            </div>
          )}
          <button className={`auc-btn ${isWaived ? 'auc-btn--warning' : 'auc-btn--success'} auc-btn--wide`} onClick={handleFeeWaiver} disabled={saving === 'waiver'}>
            {isWaived ? '❌ Remove Fee Waiver' : '💚 Grant Fee Waiver'}
          </button>
        </div>
      </Section>

      <Section title="📨 Communication">
        <a href={`/messages?to=${u._id}`} className="auc-btn auc-btn--primary auc-btn--wide" target="_blank" rel="noopener noreferrer">
          💬 Send Direct Message
        </a>
      </Section>
    </div>
  );
};

// ─── Main Card ────────────────────────────────────────────────────────────────
const AdminUserCard = ({ data, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const u = data?.user;

  const TABS = [
    { id: 'overview',  label: '👤 Overview' },
    { id: 'jobs',      label: `📋 Jobs (${(data?.jobsAsClient?.length || 0) + (data?.jobsAsFreelancer?.length || 0)})` },
    { id: 'services',  label: `🛍 Services (${data?.services?.length || 0})` },
    { id: 'wallet',    label: `💼 Wallet${u?.walletFrozen ? ' 🧊' : ''}` },
    { id: 'billing',   label: '💳 Billing' },
    { id: 'features',  label: '🚩 Features' },
    { id: 'reviews',   label: `⭐ Reviews (${data?.reviews?.length || 0})` },
    { id: 'actions',   label: '⚡ Actions' },
  ];

  if (!u) return null;

  const accountAge = data?.summary?.accountAge || 0;
  const isWaived   = u.feeWaiver?.enabled;

  return (
    <div className="auc-overlay" onClick={onClose}>
      <div className="auc-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">

        {/* ── Top bar ── */}
        <div className="auc-topbar">
          <button className="auc-topbar-close" onClick={onClose} aria-label="Close">×</button>
          <div className="auc-topbar-links">
            <a href={`/freelancers/${u._id}`} target="_blank" rel="noopener noreferrer" className="auc-link">View Public Profile ↗</a>
          </div>
        </div>

        {/* ── Profile header ── */}
        <div className="auc-header">
          <Avatar user={u} size={64} />
          <div className="auc-header-info">
            <div className="auc-header-name">
              {u.firstName} {u.lastName}
              {u.isVerified && <span className="auc-verified" title="ID Verified">✓</span>}
            </div>
            <div className="auc-header-email">{u.email}</div>
            <div className="auc-header-meta">{u.headline || u.accountType || 'User'}</div>
            <div className="auc-header-badges">
              <span className={`auc-chip auc-chip--role-${u.role}`}>{u.role}</span>
              <span className={`auc-chip ${u.isSuspended ? 'auc-chip--danger' : 'auc-chip--success'}`}>
                {u.isSuspended ? '⛔ Suspended' : '✅ Active'}
              </span>
              {u.walletFrozen && <span className="auc-chip auc-chip--warning">🧊 Wallet Frozen</span>}
              {isWaived && <span className="auc-chip auc-chip--green">💚 Fee Waived</span>}
              {u.isEmailVerified && <span className="auc-chip auc-chip--subtle">📧 Email ✓</span>}
              {u.stripeAccountId && <span className="auc-chip auc-chip--subtle">💳 Stripe ✓</span>}
            </div>
          </div>
          {/* Quick stats */}
          <div className="auc-header-stats">
            <Stat label="Posted"   value={data?.summary?.totalJobsPosted || 0} />
            <Stat label="Worked"   value={data?.summary?.totalJobsWorked || 0} />
            <Stat label="Services" value={data?.services?.length || 0} />
            <Stat label="Rating"   value={u.rating ? `${u.rating.toFixed(1)}⭐` : '—'} />
            <Stat label="Age"      value={`${accountAge}d`} />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="auc-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`auc-tab ${activeTab === t.id ? 'auc-tab--active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="auc-body">

          {activeTab === 'overview' && (
            <div className="auc-overview">
              <div className="auc-two-col">
                <Section title="Account">
                  <Row label="Username"    value={u.username} />
                  <Row label="Account Type" value={u.accountType} />
                  <Row label="Joined"      value={new Date(u.createdAt).toLocaleDateString()} />
                  <Row label="Last Login"  value={u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : null} />
                  <Row label="Location"    value={u.location?.city ? `${u.location.city}, ${u.location.state || u.location.country}` : null} />
                  <Row label="Timezone"    value={u.timezone} />
                </Section>
                <Section title="Stats">
                  <Row label="Hourly Rate"       value={u.hourlyRate ? `$${u.hourlyRate}/hr` : null} />
                  <Row label="Completed Jobs"    value={u.completedJobs || 0} />
                  <Row label="Profile Complete"  value={`${u.profileCompletion || 0}%`} />
                  <Row label="Email Verified"    value={u.isEmailVerified ? '✅ Yes' : '❌ No'} />
                  <Row label="Stripe Connected"  value={u.stripeAccountId ? '✅ Yes' : '❌ No'} />
                  <Row label="Referral Credits"  value={u.referralCredits ? `$${u.referralCredits}` : null} />
                </Section>
              </div>

              {u.skills?.length > 0 && (
                <Section title="Skills">
                  <div className="auc-tag-cloud">
                    {u.skills.map((s, i) => <span key={i} className="auc-tag">{s}</span>)}
                  </div>
                </Section>
              )}

              {u.bio && (
                <Section title="Bio">
                  <p className="auc-bio">{u.bio}</p>
                </Section>
              )}

              {u.isSuspended && (
                <div className="auc-alert auc-alert--danger">
                  ⛔ Suspended — {u.suspensionReason || 'No reason provided'}
                </div>
              )}
            </div>
          )}

          {activeTab === 'jobs' && (
            <div className="auc-list-content">
              {data.jobsAsClient?.length > 0 && (
                <Section title={`Posted (${data.jobsAsClient.length})`}>
                  {data.jobsAsClient.map(j => (
                    <div key={j._id} className="auc-list-item">
                      <a href={`/jobs/${j._id}`} target="_blank" rel="noopener noreferrer" className="auc-list-title">{j.title}</a>
                      <div className="auc-list-meta">
                        <span className={`auc-status-pill auc-status-${j.status}`}>{j.status?.replace(/_/g, ' ')}</span>
                        <span>{formatBudget(j.budget)}</span>
                        <span>{j.category?.replace(/_/g, ' ')}</span>
                        <span>{new Date(j.createdAt).toLocaleDateString()}</span>
                        {j.freelancer && <span>→ {j.freelancer.firstName} {j.freelancer.lastName}</span>}
                      </div>
                    </div>
                  ))}
                </Section>
              )}
              {data.jobsAsFreelancer?.length > 0 && (
                <Section title={`Worked (${data.jobsAsFreelancer.length})`}>
                  {data.jobsAsFreelancer.map(j => (
                    <div key={j._id} className="auc-list-item">
                      <a href={`/jobs/${j._id}`} target="_blank" rel="noopener noreferrer" className="auc-list-title">{j.title}</a>
                      <div className="auc-list-meta">
                        <span className={`auc-status-pill auc-status-${j.status}`}>{j.status?.replace(/_/g, ' ')}</span>
                        <span>{formatBudget(j.budget)}</span>
                        {j.client && <span>Client: {j.client.firstName} {j.client.lastName}</span>}
                      </div>
                    </div>
                  ))}
                </Section>
              )}
              {!data.jobsAsClient?.length && !data.jobsAsFreelancer?.length && (
                <p className="auc-empty">No jobs found</p>
              )}
            </div>
          )}

          {activeTab === 'services' && (
            <div className="auc-list-content">
              {data.services?.length > 0 ? data.services.map(s => (
                <div key={s._id} className="auc-list-item">
                  <a href={`/services/${s._id}`} target="_blank" rel="noopener noreferrer" className="auc-list-title">{s.title}</a>
                  <div className="auc-list-meta">
                    <span className={`auc-status-pill ${s.isActive ? 'auc-status-open' : 'auc-status-inactive'}`}>{s.isActive ? 'Active' : 'Inactive'}</span>
                    <span>{s.category?.replace(/_/g, ' ')}</span>
                    {s.pricing?.base && <span>${s.pricing.base}</span>}
                  </div>
                </div>
              )) : <p className="auc-empty">No services</p>}
            </div>
          )}

          {activeTab === 'wallet' && (
            <WalletTab userId={u._id} frozen={u.walletFrozen} frozenReason={u.walletFrozenReason} />
          )}

          {activeTab === 'billing' && <BillingTab userId={u._id} />}

          {activeTab === 'features' && <FeatureFlagsPanel userId={u._id} />}

          {activeTab === 'reviews' && (
            <div className="auc-list-content">
              {data.reviews?.length > 0 ? data.reviews.map(r => (
                <div key={r._id} className="auc-list-item">
                  <div className="auc-review-top">
                    <span>{'⭐'.repeat(Math.round(r.rating || 0))}</span>
                    <span className="auc-review-date">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  {r.comment && <p className="auc-review-comment">{r.comment}</p>}
                  <div className="auc-list-meta">
                    <span>From: {r.client?.firstName || r.freelancer?.firstName || 'Unknown'}</span>
                  </div>
                </div>
              )) : <p className="auc-empty">No reviews</p>}
            </div>
          )}

          {activeTab === 'actions' && (
            <ActionsTab u={u} onRefresh={onRefresh} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUserCard;
