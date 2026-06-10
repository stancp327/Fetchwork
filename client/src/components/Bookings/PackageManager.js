import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './PackageManager.css';

const emptyForm = {
  name: '',
  description: '',
  sessionCount: 5,
  pricePerSessionCents: '',
  normalPriceCents: '',
  validityDays: 365,
  maxPerClient: 1,
};

export default function PackageManager({ serviceId: propServiceId }) {
  const { serviceId: paramServiceId } = useParams();
  const serviceId = propServiceId || paramServiceId;
  const [packages, setPackages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [form,     setForm]     = useState(emptyForm);
  const [editing,  setEditing]  = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message,  setMessage]  = useState(null);

  const loadPackages = useCallback(async () => {
    if (!serviceId) return;
    try {
      const data = await apiRequest(`/api/service-packages/${serviceId}`);
      setPackages(data.packages || []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load packages.' });
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => { loadPackages(); }, [loadPackages]);

  const totalCents = () => {
    const pps   = parseInt(form.pricePerSessionCents) || 0;
    const count = parseInt(form.sessionCount) || 0;
    return pps * count;
  };

  const savingsPercent = () => {
    const normal  = parseInt(form.normalPriceCents) || 0;
    const total   = totalCents();
    if (!normal || !total || total >= normal) return 0;
    return Math.round((1 - total / normal) * 100);
  };

  const handleSave = async () => {
    if (!form.name || !form.sessionCount || !form.pricePerSessionCents) {
      setMessage({ type: 'error', text: 'Name, session count, and price per session are required.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const body = {
        serviceId,
        name:                 form.name,
        description:          form.description || undefined,
        sessionCount:         parseInt(form.sessionCount),
        pricePerSessionCents: parseInt(form.pricePerSessionCents),
        totalPriceCents:      totalCents(),
        savingsPercent:       savingsPercent(),
        validityDays:         parseInt(form.validityDays) || 365,
        maxPerClient:         parseInt(form.maxPerClient) || 1,
      };

      if (editing) {
        await apiRequest(`/api/service-packages/${editing}`, { method: 'PUT', body: JSON.stringify(body) });
        setMessage({ type: 'success', text: 'Package updated.' });
      } else {
        await apiRequest('/api/service-packages', { method: 'POST', body: JSON.stringify(body) });
        setMessage({ type: 'success', text: 'Package created.' });
      }
      setForm(emptyForm);
      setEditing(null);
      setShowForm(false);
      loadPackages();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save package.' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (pkg) => {
    setForm({
      name:                 pkg.name,
      description:          pkg.description || '',
      sessionCount:         pkg.sessionCount,
      pricePerSessionCents: pkg.pricePerSessionCents,
      normalPriceCents:     '',
      validityDays:         pkg.validityDays,
      maxPerClient:         pkg.maxPerClient,
    });
    setEditing(pkg.id);
    setShowForm(true);
    setMessage(null);
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this package? Clients with active purchases are unaffected.')) return;
    try {
      await apiRequest(`/api/service-packages/${id}`, { method: 'DELETE' });
      loadPackages();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to deactivate.' });
    }
  };

  const fmt = cents => `$${(cents / 100).toFixed(2)}`;

  if (!serviceId) return (
    <div className="pkg-manager">
      <p className="pkg-empty">Navigate to a specific service to manage its packages. e.g. /service-packages/SERVICE_ID</p>
    </div>
  );

  if (loading) return <div className="pkg-manager"><div className="pkg-loading">Loading packages…</div></div>;

  return (
    <div className="pkg-manager">
      <div className="pkg-manager-header">
        <h3 className="pkg-manager-title">Session Packages</h3>
        <button className="pkg-add-btn" onClick={() => { setForm(emptyForm); setEditing(null); setShowForm(v => !v); }}>
          {showForm ? 'Cancel' : '+ New Package'}
        </button>
      </div>

      {message && (
        <div className={`pkg-message pkg-message--${message.type}`}>{message.text}</div>
      )}

      {showForm && (
        <div className="pkg-form">
          <h4 className="pkg-form-title">{editing ? 'Edit Package' : 'Create Package'}</h4>

          <label className="pkg-field-label">Package name *</label>
          <input className="pkg-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 5-Session Bundle" />

          <label className="pkg-field-label">Description</label>
          <textarea className="pkg-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details…" rows={2} />

          <div className="pkg-form-row">
            <div className="pkg-form-col">
              <label className="pkg-field-label">Number of sessions *</label>
              <input className="pkg-input" type="number" min="2" max="100" value={form.sessionCount} onChange={e => setForm(f => ({ ...f, sessionCount: e.target.value }))} />
            </div>
            <div className="pkg-form-col">
              <label className="pkg-field-label">Package price per session (cents) *</label>
              <input className="pkg-input" type="number" min="100" value={form.pricePerSessionCents} onChange={e => setForm(f => ({ ...f, pricePerSessionCents: e.target.value }))} placeholder="e.g. 8000 = $80" />
            </div>
          </div>

          <div className="pkg-form-row">
            <div className="pkg-form-col">
              <label className="pkg-field-label">Normal price per session (to calc savings)</label>
              <input className="pkg-input" type="number" min="0" value={form.normalPriceCents} onChange={e => setForm(f => ({ ...f, normalPriceCents: e.target.value }))} placeholder="e.g. 10000 = $100" />
            </div>
            <div className="pkg-form-col">
              <label className="pkg-field-label">Validity (days)</label>
              <input className="pkg-input" type="number" min="30" value={form.validityDays} onChange={e => setForm(f => ({ ...f, validityDays: e.target.value }))} />
            </div>
          </div>

          {totalCents() > 0 && (
            <div className="pkg-summary">
              Total: <strong>{fmt(totalCents())}</strong>
              {savingsPercent() > 0 && <span className="pkg-savings-badge">Save {savingsPercent()}%</span>}
            </div>
          )}

          <button className="pkg-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Update Package' : 'Create Package'}
          </button>
        </div>
      )}

      {packages.length === 0 && !showForm ? (
        <p className="pkg-empty">No packages yet. Create one to offer session bundles to clients.</p>
      ) : (
        <div className="pkg-list">
          {packages.map(pkg => (
            <div key={pkg.id} className="pkg-card">
              <div className="pkg-card-header">
                <span className="pkg-card-name">{pkg.name}</span>
                {pkg.savingsPercent > 0 && (
                  <span className="pkg-card-savings">Save {Math.round(pkg.savingsPercent)}%</span>
                )}
              </div>
              {pkg.description && <p className="pkg-card-desc">{pkg.description}</p>}
              <div className="pkg-card-meta">
                <span>{pkg.sessionCount} sessions</span>
                <span>{fmt(pkg.pricePerSessionCents)} / session</span>
                <span><strong>{fmt(pkg.totalPriceCents)}</strong> total</span>
                <span>Valid {pkg.validityDays} days</span>
              </div>
              <div className="pkg-card-actions">
                <button className="pkg-edit-btn" onClick={() => handleEdit(pkg)}>Edit</button>
                <button className="pkg-deactivate-btn" onClick={() => handleDeactivate(pkg.id)}>Deactivate</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
