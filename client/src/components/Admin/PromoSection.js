import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';

const APPLIES_LABELS = {
  new_users: '🆕 New users', existing_users: '👥 Existing', all: '🌐 All users', specific_users: '🎯 Specific'
};
const AUDIENCE_LABELS = { freelancer: '👤 Freelancer', client: '🏢 Client', both: '👥 Both' };

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'FW-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

// ── Status helper ───────────────────────────────────────────────
const getPromoStatus = (promo) => {
  const now = new Date();
  const start = new Date(promo.startDate);
  const end = new Date(promo.endDate);
  if (!promo.active) return { label: 'Disabled', color: '#6b7280', bg: '#f3f4f6' };
  if (now < start) return { label: 'Scheduled', color: '#2563eb', bg: '#eff6ff' };
  if (now > end) return { label: 'Expired', color: '#dc2626', bg: '#fef2f2' };
  if (promo.maxRedemptions && promo.usageCount >= promo.maxRedemptions) return { label: 'Maxed Out', color: '#d97706', bg: '#fffbeb' };
  return { label: 'Active', color: '#059669', bg: '#ecfdf5' };
};

// ── Effect summary ──────────────────────────────────────────────
const getEffectSummary = (promo) => {
  const parts = [];
  const ov = promo.feeRateOverrides;
  if (ov?.remoteClient != null) parts.push(`Client fee → ${(ov.remoteClient * 100).toFixed(0)}%`);
  if (ov?.remoteFreelancer != null) parts.push(`Freelancer fee → ${(ov.remoteFreelancer * 100).toFixed(0)}%`);
  if (promo.subscriptionDiscount != null) parts.push(`${(promo.subscriptionDiscount * 100).toFixed(0)}% off subscription`);
  return parts.length ? parts.join(' · ') : 'No fee overrides';
};

// ── Create Form ─────────────────────────────────────────────────
const PromoForm = ({ onCreated }) => {
  const [form, setForm] = useState({
    name: '', description: '', code: '', appliesTo: 'all', audience: 'both',
    startDate: '', endDate: '', maxRedemptions: '',
    remoteClient: '', remoteFreelancer: '', subscriptionDiscount: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      setError('Name, start date, and end date are required');
      return;
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      setError('End date must be after start date');
      return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        name: form.name,
        description: form.description,
        code: form.code || null,
        appliesTo: form.appliesTo,
        audience: form.audience,
        startDate: form.startDate,
        endDate: form.endDate,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
        feeRateOverrides: {
          remoteClient: form.remoteClient ? Number(form.remoteClient) / 100 : null,
          remoteFreelancer: form.remoteFreelancer ? Number(form.remoteFreelancer) / 100 : null,
        },
        subscriptionDiscount: form.subscriptionDiscount ? Number(form.subscriptionDiscount) / 100 : null,
      };
      await apiRequest('/api/admin/billing/promo', { method: 'POST', body: JSON.stringify(payload) });
      setForm({ name: '', description: '', code: '', appliesTo: 'all', audience: 'both', startDate: '', endDate: '', maxRedemptions: '', remoteClient: '', remoteFreelancer: '', subscriptionDiscount: '' });
      setExpanded(false);
      onCreated();
    } catch (err) {
      setError(err.message || 'Failed to create promo');
    } finally {
      setSaving(false);
    }
  };

  if (!expanded) {
    return (
      <button className="abt-btn-primary" onClick={() => setExpanded(true)} style={{ marginBottom: 16 }}>
        + Create Promo Rule
      </button>
    );
  }

  return (
    <div className="abt-promo-form">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0 }}>Create Promo Rule</h4>
        <button className="abt-modal-close" onClick={() => setExpanded(false)} style={{ width: 32, height: 32, border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>
      <div className="abt-form-row-2">
        <div><label>Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Summer 2026 Launch Promo" /></div>
        <div>
          <label>Promo Code (optional)</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="e.g. SUMMER26" style={{ flex: 1 }} />
            <button type="button" onClick={() => set('code', generateCode())} className="abt-btn-secondary" style={{ height: 40, padding: '0 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>🎲 Generate</button>
          </div>
        </div>
        <div><label>Applies to</label>
          <select value={form.appliesTo} onChange={e => set('appliesTo', e.target.value)}>
            <option value="all">All users</option>
            <option value="new_users">New users only</option>
            <option value="existing_users">Existing users only</option>
          </select>
        </div>
        <div><label>Audience</label>
          <select value={form.audience} onChange={e => set('audience', e.target.value)}>
            <option value="both">Both</option>
            <option value="freelancer">Freelancers only</option>
            <option value="client">Clients only</option>
          </select>
        </div>
        <div><label>Start date *</label><input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></div>
        <div><label>End date *</label><input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} /></div>
      </div>

      <div className="abt-section-label" style={{ marginTop: 12 }}>Discount Effects</div>
      <div className="abt-form-row-2">
        <div><label>Remote client fee % override</label><input type="number" min="0" max="100" value={form.remoteClient} onChange={e => set('remoteClient', e.target.value)} placeholder="e.g. 3 = 3%" /></div>
        <div><label>Remote freelancer fee % override</label><input type="number" min="0" max="100" value={form.remoteFreelancer} onChange={e => set('remoteFreelancer', e.target.value)} placeholder="e.g. 5 = 5%" /></div>
        <div><label>Subscription discount %</label><input type="number" min="0" max="100" value={form.subscriptionDiscount} onChange={e => set('subscriptionDiscount', e.target.value)} placeholder="e.g. 20 = 20% off" /></div>
      </div>

      <div className="abt-form-row-2" style={{ marginTop: 8 }}>
        <div><label>Max redemptions (blank = unlimited)</label><input type="number" min="1" value={form.maxRedemptions} onChange={e => set('maxRedemptions', e.target.value)} placeholder="unlimited" /></div>
        <div><label>Description (internal notes)</label><input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Launch week promo for early adopters" /></div>
      </div>

      {error && <div className="abt-error">{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="abt-btn-primary" onClick={handleCreate} disabled={saving}>
          {saving ? 'Creating…' : '✅ Create Promo Rule'}
        </button>
        <button className="abt-btn-secondary" onClick={() => setExpanded(false)}>Cancel</button>
      </div>
    </div>
  );
};

// ── Promo Card ──────────────────────────────────────────────────
const PromoCard = ({ promo, onUpdate, onDelete }) => {
  const status = getPromoStatus(promo);
  const effect = getEffectSummary(promo);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={`abt-promo-card ${status.label.toLowerCase().replace(' ', '-')}`}>
      <div className="abt-promo-card-header">
        <div>
          <strong className="abt-promo-name">{promo.name}</strong>
          {promo.code && <span className="abt-promo-code">{promo.code}</span>}
        </div>
        <span className="abt-promo-status" style={{ color: status.color, background: status.bg }}>
          {status.label}
        </span>
      </div>

      <div className="abt-promo-meta">
        <span>{APPLIES_LABELS[promo.appliesTo] || promo.appliesTo}</span>
        <span>·</span>
        <span>{AUDIENCE_LABELS[promo.audience]}</span>
        <span>·</span>
        <span>{new Date(promo.startDate).toLocaleDateString()} – {new Date(promo.endDate).toLocaleDateString()}</span>
      </div>

      <div className="abt-promo-effect">{effect}</div>

      <div className="abt-promo-stats">
        <span>📊 {promo.usageCount || 0} uses</span>
        {promo.maxRedemptions && <span>· Max: {promo.maxRedemptions}</span>}
        {promo.description && <span className="abt-promo-desc">· {promo.description}</span>}
      </div>

      <div className="abt-promo-actions">
        <button
          className={`abt-promo-toggle ${promo.active ? 'danger' : 'success'}`}
          onClick={() => onUpdate(promo._id, { active: !promo.active })}
        >
          {promo.active ? '⏸ Disable' : '▶ Enable'}
        </button>
        {confirming ? (
          <>
            <button className="abt-promo-toggle danger" onClick={() => { onDelete(promo._id); setConfirming(false); }}>
              Confirm Delete
            </button>
            <button className="abt-promo-toggle" style={{ borderColor: '#6b7280', color: '#6b7280' }} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="abt-promo-toggle danger" onClick={() => setConfirming(true)}>🗑</button>
        )}
      </div>
    </div>
  );
};

// ── Main Section ────────────────────────────────────────────────
const PromoSection = ({ promos, onRefresh }) => {
  const handleUpdate = async (promoId, updates) => {
    await apiRequest(`/api/admin/billing/promo/${promoId}`, {
      method: 'PUT', body: JSON.stringify(updates),
    });
    onRefresh();
  };

  const handleDelete = async (promoId) => {
    await apiRequest(`/api/admin/billing/promo/${promoId}`, { method: 'DELETE' });
    onRefresh();
  };

  // Sort: active first, then by start date desc
  const sorted = [...promos].sort((a, b) => {
    const aStatus = getPromoStatus(a);
    const bStatus = getPromoStatus(b);
    if (aStatus.label === 'Active' && bStatus.label !== 'Active') return -1;
    if (bStatus.label === 'Active' && aStatus.label !== 'Active') return 1;
    return new Date(b.startDate) - new Date(a.startDate);
  });

  return (
    <section className="abt-section">
      <h3 className="abt-section-title">🎁 Promo Rules</h3>
      <PromoForm onCreated={onRefresh} />
      {sorted.length > 0 ? (
        <div className="abt-promo-grid">
          {sorted.map(p => (
            <PromoCard key={p._id} promo={p} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: 32, fontSize: '0.9rem' }}>
          No promo rules yet. Create one to get started.
        </div>
      )}
    </section>
  );
};

export default PromoSection;
