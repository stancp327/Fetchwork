import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './AdminBillingTab.css';

const TIER_COLORS = { free: '#6c757d', plus: '#667eea', pro: '#764ba2' };
const AUDIENCE_LABELS = { freelancer: '👤 Freelancer', client: '🏢 Client' };

// ── Plan Card ───────────────────────────────────────────────────
const PlanCard = ({ plan, onEdit }) => (
  <div className={`abt-plan-card abt-tier-${plan.tier}`}>
    <div className="abt-plan-header">
      <div>
        <div className="abt-plan-name">{plan.name}</div>
        <div className="abt-plan-audience">{AUDIENCE_LABELS[plan.audience]}</div>
      </div>
      <div className="abt-plan-price">
        {plan.price === 0 ? 'Free' : `$${plan.price}/mo`}
      </div>
    </div>
    <div className="abt-plan-stats">
      <span className="abt-sub-count">{plan.subscriberCount || 0} subscribers</span>
      <span className={`abt-plan-status ${plan.active ? 'active' : 'inactive'}`}>
        {plan.active ? 'Active' : 'Inactive'}
      </span>
    </div>
    <div className="abt-plan-fees">
      <div className="abt-fee-row">
        <span>Remote client fee</span>
        <strong>{(plan.feeRates?.remoteClient * 100).toFixed(0)}%</strong>
      </div>
      <div className="abt-fee-row">
        <span>Remote freelancer fee</span>
        <strong>{(plan.feeRates?.remoteFreelancer * 100).toFixed(0)}%</strong>
      </div>
      <div className="abt-fee-row">
        <span>Local client fee (under $50)</span>
        <strong>${plan.feeRates?.localClient?.upTo50}</strong>
      </div>
    </div>
    <button className="abt-edit-btn" onClick={() => onEdit(plan)}>Edit Plan</button>
  </div>
);

// ── Edit Plan Modal ─────────────────────────────────────────────
const EditPlanModal = ({ plan, onSave, onClose }) => {
  const [form, setForm] = useState({
    price:                plan.price,
    active:               plan.active,
    remoteClient:         (plan.feeRates?.remoteClient * 100) || 5,
    remoteFreelancer:     (plan.feeRates?.remoteFreelancer * 100) || 10,
    localUpTo50:          plan.feeRates?.localClient?.upTo50 || 4,
    localUpTo150:         plan.feeRates?.localClient?.upTo150 || 6,
    localUpTo400:         plan.feeRates?.localClient?.upTo400 || 10,
    localAbove400:        plan.feeRates?.localClient?.above400 || 15,
    activeJobsLimit:      plan.limits?.activeJobs ?? '',
    activeServicesLimit:  plan.limits?.activeServices ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(plan._id, {
        price:  Number(form.price),
        active: form.active,
        feeRates: {
          remoteClient:     Number(form.remoteClient)     / 100,
          remoteFreelancer: Number(form.remoteFreelancer) / 100,
          localClient: {
            upTo50:   Number(form.localUpTo50),
            upTo150:  Number(form.localUpTo150),
            upTo400:  Number(form.localUpTo400),
            above400: Number(form.localAbove400),
          },
        },
        limits: {
          activeJobs:     form.activeJobsLimit === '' ? null : Number(form.activeJobsLimit),
          activeServices: form.activeServicesLimit === '' ? null : Number(form.activeServicesLimit),
        },
      });
    } catch (err) {
      setError(err.message || 'Save failed');
      setSaving(false);
    }
  };

  return (
    <div className="abt-modal-overlay" onClick={onClose}>
      <div className="abt-modal" onClick={e => e.stopPropagation()}>
        <div className="abt-modal-header">
          <h3>Edit — {plan.name}</h3>
          <button className="abt-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="abt-modal-body">
          <div className="abt-form-row">
            <label>Monthly Price ($)</label>
            <input type="number" value={form.price} onChange={e => set('price', e.target.value)} min="0" />
          </div>
          <div className="abt-form-row">
            <label>Status</label>
            <select value={form.active} onChange={e => set('active', e.target.value === 'true')}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div className="abt-section-label">Remote Fees (%)</div>
          <div className="abt-form-row-2">
            <div>
              <label>Client fee %</label>
              <input type="number" value={form.remoteClient} onChange={e => set('remoteClient', e.target.value)} min="0" max="100" step="0.5" />
            </div>
            <div>
              <label>Freelancer fee %</label>
              <input type="number" value={form.remoteFreelancer} onChange={e => set('remoteFreelancer', e.target.value)} min="0" max="100" step="0.5" />
            </div>
          </div>

          <div className="abt-section-label">Local Client Flat Fees ($)</div>
          <div className="abt-form-row-2">
            <div>
              <label>Under $50</label>
              <input type="number" value={form.localUpTo50} onChange={e => set('localUpTo50', e.target.value)} min="0" />
            </div>
            <div>
              <label>$50–$149</label>
              <input type="number" value={form.localUpTo150} onChange={e => set('localUpTo150', e.target.value)} min="0" />
            </div>
            <div>
              <label>$150–$399</label>
              <input type="number" value={form.localUpTo400} onChange={e => set('localUpTo400', e.target.value)} min="0" />
            </div>
            <div>
              <label>$400+</label>
              <input type="number" value={form.localAbove400} onChange={e => set('localAbove400', e.target.value)} min="0" />
            </div>
          </div>

          <div className="abt-section-label">Limits (blank = unlimited)</div>
          <div className="abt-form-row-2">
            <div>
              <label>Active job posts</label>
              <input type="number" value={form.activeJobsLimit} onChange={e => set('activeJobsLimit', e.target.value)} min="0" placeholder="unlimited" />
            </div>
            <div>
              <label>Active services</label>
              <input type="number" value={form.activeServicesLimit} onChange={e => set('activeServicesLimit', e.target.value)} min="0" placeholder="unlimited" />
            </div>
          </div>

          {error && <div className="abt-error">{error}</div>}
        </div>

        <div className="abt-modal-footer">
          <button className="abt-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="abt-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Promo Rule Form ─────────────────────────────────────────────
const PromoForm = ({ onCreated }) => {
  const [form, setForm] = useState({
    name: '', description: '', appliesTo: 'new_users', audience: 'both',
    startDate: '', endDate: '',
    remoteClient: '', remoteFreelancer: '', subscriptionDiscount: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      setError('Name, start date, and end date are required');
      return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        name:        form.name,
        description: form.description,
        appliesTo:   form.appliesTo,
        audience:    form.audience,
        startDate:   form.startDate,
        endDate:     form.endDate,
        feeRateOverrides: {
          remoteClient:     form.remoteClient     ? Number(form.remoteClient)     / 100 : null,
          remoteFreelancer: form.remoteFreelancer ? Number(form.remoteFreelancer) / 100 : null,
        },
        subscriptionDiscount: form.subscriptionDiscount ? Number(form.subscriptionDiscount) / 100 : null,
      };
      await apiRequest('/api/admin/billing/promo', { method: 'POST', body: JSON.stringify(payload) });
      setForm({ name: '', description: '', appliesTo: 'new_users', audience: 'both', startDate: '', endDate: '', remoteClient: '', remoteFreelancer: '', subscriptionDiscount: '' });
      onCreated();
    } catch (err) {
      setError(err.message || 'Failed to create promo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="abt-promo-form">
      <h4>Create Promo Rule</h4>
      <div className="abt-form-row-2">
        <div><label>Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Summer 2026 promo" /></div>
        <div><label>Applies to</label>
          <select value={form.appliesTo} onChange={e => set('appliesTo', e.target.value)}>
            <option value="new_users">New users only</option>
            <option value="existing_users">Existing users only</option>
            <option value="all">All users</option>
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
        <div><label>Remote client fee % (override)</label><input type="number" value={form.remoteClient} onChange={e => set('remoteClient', e.target.value)} placeholder="leave blank to skip" /></div>
        <div><label>Remote freelancer fee % (override)</label><input type="number" value={form.remoteFreelancer} onChange={e => set('remoteFreelancer', e.target.value)} placeholder="leave blank to skip" /></div>
        <div><label>Subscription discount %</label><input type="number" value={form.subscriptionDiscount} onChange={e => set('subscriptionDiscount', e.target.value)} placeholder="e.g. 20 = 20% off" /></div>
      </div>
      <div><label>Description</label><input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Internal notes" /></div>
      {error && <div className="abt-error">{error}</div>}
      <button className="abt-btn-primary" onClick={handleCreate} disabled={saving}>
        {saving ? 'Creating…' : 'Create Promo Rule'}
      </button>
    </div>
  );
};

// ── Main Tab ────────────────────────────────────────────────────
const AdminBillingTab = () => {
  const [plans,  setPlans]  = useState([]);
  const [promos, setPromos] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, prRes] = await Promise.all([
        apiRequest('/api/admin/billing/plans'),
        apiRequest('/api/admin/billing/promos'),
      ]);
      setPlans(pRes.plans  || []);
      setPromos(prRes.promos || []);
    } catch (err) {
      setError('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSavePlan = async (planId, updates) => {
    await apiRequest(`/api/admin/billing/plans/${planId}`, { method: 'PUT', body: JSON.stringify(updates) });
    setSaveMsg('Plan updated ✅');
    setTimeout(() => setSaveMsg(''), 3000);
    setEditingPlan(null);
    fetchAll();
  };

  const freelancerPlans = plans.filter(p => p.audience === 'freelancer');
  const clientPlans     = plans.filter(p => p.audience === 'client');

  if (loading) return <div className="abt-loading">Loading billing data…</div>;
  if (error)   return <div className="abt-error">{error}</div>;

  return (
    <div className="abt-wrap">
      {saveMsg && <div className="abt-save-msg">{saveMsg}</div>}

      {/* ── Plans ── */}
      <section className="abt-section">
        <h3 className="abt-section-title">📋 Freelancer Plans</h3>
        <div className="abt-plans-grid">
          {freelancerPlans.map(p => <PlanCard key={p._id} plan={p} onEdit={setEditingPlan} />)}
        </div>
      </section>

      <section className="abt-section">
        <h3 className="abt-section-title">📋 Client Plans</h3>
        <div className="abt-plans-grid">
          {clientPlans.map(p => <PlanCard key={p._id} plan={p} onEdit={setEditingPlan} />)}
        </div>
      </section>

      {/* ── Promo Rules ── */}
      <section className="abt-section">
        <h3 className="abt-section-title">🎁 Promo Rules</h3>
        <PromoForm onCreated={fetchAll} />
        {promos.length > 0 && (
          <div className="abt-promo-list">
            {promos.map(promo => (
              <div key={promo._id} className={`abt-promo-row ${promo.active ? '' : 'inactive'}`}>
                <div className="abt-promo-info">
                  <strong>{promo.name}</strong>
                  <span>{promo.appliesTo} · {promo.audience}</span>
                  <span>{new Date(promo.startDate).toLocaleDateString()} – {new Date(promo.endDate).toLocaleDateString()}</span>
                </div>
                <div className="abt-promo-actions">
                  <button
                    className={`abt-promo-toggle ${promo.active ? 'danger' : 'success'}`}
                    onClick={async () => {
                      await apiRequest(`/api/admin/billing/promo/${promo._id}`, {
                        method: 'PUT', body: JSON.stringify({ active: !promo.active }),
                      });
                      fetchAll();
                    }}
                  >
                    {promo.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Edit Modal ── */}
      {editingPlan && (
        <EditPlanModal
          plan={editingPlan}
          onSave={handleSavePlan}
          onClose={() => setEditingPlan(null)}
        />
      )}
    </div>
  );
};

export default AdminBillingTab;
