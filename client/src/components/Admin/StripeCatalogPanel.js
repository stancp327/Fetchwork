import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './StripeCatalogPanel.css';

const fmt = (n) => n != null
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
  : '—';

// ── Create Plan Form ────────────────────────────────────────────
const CreatePlanForm = ({ onCreated, onCancel }) => {
  const [form, setForm] = useState({
    name: '', description: '', slug: '', audience: 'freelancer',
    tier: 'plus', price: '', interval: 'month',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await apiRequest('/api/admin/stripe/plans', {
        method: 'POST',
        body: JSON.stringify({ ...form, price: parseFloat(form.price) }),
      });
      onCreated(res.plan);
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to create plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="scp-form" onSubmit={handleSubmit}>
      <h4 className="scp-form-title">New Plan</h4>
      {error && <div className="scp-error">{error}</div>}
      <div className="scp-form-grid">
        <label className="scp-field">
          <span>Name</span>
          <input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Freelancer Pro" />
        </label>
        <label className="scp-field">
          <span>Slug</span>
          <input value={form.slug} onChange={e => set('slug', e.target.value)} required placeholder="freelancer_pro" />
        </label>
        <label className="scp-field">
          <span>Audience</span>
          <select value={form.audience} onChange={e => set('audience', e.target.value)}>
            <option value="freelancer">Freelancer</option>
            <option value="client">Client</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label className="scp-field">
          <span>Tier</span>
          <select value={form.tier} onChange={e => set('tier', e.target.value)}>
            <option value="plus">Plus</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
        </label>
        <label className="scp-field">
          <span>Price ($/mo)</span>
          <input type="number" min="0.99" step="0.01" value={form.price}
            onChange={e => set('price', e.target.value)} required placeholder="29.99" />
        </label>
        <label className="scp-field">
          <span>Interval</span>
          <select value={form.interval} onChange={e => set('interval', e.target.value)}>
            <option value="month">Monthly</option>
            <option value="year">Annual</option>
          </select>
        </label>
      </div>
      <label className="scp-field scp-full">
        <span>Description (optional)</span>
        <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Best for growing freelancers" />
      </label>
      <div className="scp-form-actions">
        <button type="button" className="scp-btn scp-btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="scp-btn scp-btn-primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create Plan + Stripe Product'}
        </button>
      </div>
    </form>
  );
};

// ── Price Change Row ────────────────────────────────────────────
const PriceChangeRow = ({ plan, onUpdated }) => {
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async () => {
    if (!price || isNaN(price)) return setError('Enter a valid price');
    setSaving(true); setError('');
    try {
      const res = await apiRequest(`/api/admin/stripe/plans/${plan.dbPlan?._id}/price`, {
        method: 'PUT',
        body: JSON.stringify({ price: parseFloat(price) }),
      });
      onUpdated(res.plan);
      setPrice('');
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scp-price-change">
      <input
        type="number" min="0.99" step="0.01" placeholder="New price"
        value={price} onChange={e => setPrice(e.target.value)}
        className="scp-price-input"
      />
      <button className="scp-btn scp-btn-sm" onClick={handleSave} disabled={saving || !price}>
        {saving ? '…' : 'Update Price'}
      </button>
      {error && <span className="scp-inline-error">{error}</span>}
    </div>
  );
};

// ── Main Panel ──────────────────────────────────────────────────
const StripeCatalogPanel = () => {
  const [catalog,      setCatalog]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [showForm,     setShowForm]     = useState(false);
  const [syncing,      setSyncing]      = useState(false);
  const [expandedId,   setExpandedId]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/admin/stripe/catalog');
      setCatalog(res.catalog || []);
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await apiRequest('/api/billing/sync-plans', { method: 'POST' });
      alert(`Synced ${res.synced} plans to Stripe.`);
      load();
    } catch (err) {
      alert('Sync failed: ' + (err.data?.error || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const handlePlanCreated = (plan) => {
    setShowForm(false);
    load();
  };

  const handlePriceUpdated = () => load();

  return (
    <div className="scp-panel">
      <div className="scp-header">
        <div>
          <h3 className="scp-title">Stripe Catalog</h3>
          <p className="scp-sub">Products and prices synced with Stripe. Changes here update Stripe immediately.</p>
        </div>
        <div className="scp-header-actions">
          <button className="scp-btn scp-btn-ghost" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : '🔄 Sync Missing Plans'}
          </button>
          <button className="scp-btn scp-btn-primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancel' : '+ New Plan'}
          </button>
        </div>
      </div>

      {showForm && (
        <CreatePlanForm onCreated={handlePlanCreated} onCancel={() => setShowForm(false)} />
      )}

      {loading && <div className="scp-loading">Loading Stripe catalog…</div>}
      {!loading && error && <div className="scp-error">{error}</div>}

      {!loading && !error && (
        <div className="scp-catalog">
          {catalog.length === 0 && (
            <div className="scp-empty">No products in Stripe. Create a plan or click Sync.</div>
          )}
          {catalog.map(prod => (
            <div key={prod.id} className="scp-product">
              <div className="scp-product-header" onClick={() => setExpandedId(expandedId === prod.id ? null : prod.id)}>
                <div className="scp-product-info">
                  <span className="scp-product-name">{prod.name}</span>
                  {prod.description && <span className="scp-product-desc">{prod.description}</span>}
                  {prod.dbPlan && <span className="scp-badge">DB: {prod.dbPlan.slug}</span>}
                </div>
                <div className="scp-product-meta">
                  <span className={`scp-status ${prod.active ? 'active' : 'inactive'}`}>
                    {prod.active ? 'Active' : 'Archived'}
                  </span>
                  <span className="scp-expand">{expandedId === prod.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expandedId === prod.id && (
                <div className="scp-product-body">
                  <div className="scp-id-row">
                    <code className="scp-id">{prod.id}</code>
                  </div>

                  <table className="scp-prices-table">
                    <thead>
                      <tr><th>Price ID</th><th>Amount</th><th>Interval</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {prod.prices.length === 0 && (
                        <tr><td colSpan={4} className="scp-no-prices">No prices</td></tr>
                      )}
                      {prod.prices.map(p => (
                        <tr key={p.id}>
                          <td><code className="scp-id">{p.id}</code></td>
                          <td>{fmt(p.amount)}</td>
                          <td>{p.interval}</td>
                          <td><span className={`scp-status ${p.active ? 'active' : 'inactive'}`}>{p.active ? 'Active' : 'Archived'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {prod.dbPlan && (
                    <div className="scp-update-price">
                      <strong>Update price</strong> (archives current Stripe Price, creates new one):
                      <PriceChangeRow plan={prod} onUpdated={handlePriceUpdated} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StripeCatalogPanel;
