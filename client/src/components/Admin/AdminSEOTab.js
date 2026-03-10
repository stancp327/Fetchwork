import React, { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './AdminSEOTab.css';

const EMPTY_PAGE = { title: '', description: '', keywords: '', ogImage: '', noIndex: false, enabled: true };

const AdminSEOTab = () => {
  const [pages, setPages] = useState([]);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // path string
  const [form, setForm] = useState(EMPTY_PAGE);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/seo/admin/pages');
      const all = data.pages || [];
      const global = all.find(p => p.path === '__global__');
      setGlobalEnabled(global?.enabled !== false);
      setPages(all.filter(p => p.path !== '__global__'));
    } catch {
      showToast('Failed to load SEO pages', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleGlobal = async () => {
    const next = !globalEnabled;
    setGlobalEnabled(next);
    try {
      await apiRequest('/api/seo/admin/global-toggle', { method: 'POST', body: JSON.stringify({ enabled: next }) });
      showToast(`SEO ${next ? 'enabled' : 'disabled'} globally`);
    } catch {
      setGlobalEnabled(!next);
      showToast('Failed to toggle', 'error');
    }
  };

  const startEdit = (page) => {
    setEditing(page.path);
    setForm({
      title: page.title || '',
      description: page.description || '',
      keywords: page.keywords || '',
      ogImage: page.ogImage || '',
      noIndex: page.noIndex || false,
      enabled: page.enabled !== false,
    });
  };

  const cancelEdit = () => { setEditing(null); setForm(EMPTY_PAGE); };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await apiRequest(`/api/seo/admin/pages/${encodeURIComponent(editing)}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setPages(prev => prev.map(p => p.path === editing ? { ...p, ...updated.page } : p));
      setEditing(null);
      showToast('Saved ✓');
    } catch {
      showToast('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="seo-loading">Loading SEO settings…</div>;

  return (
    <div className="admin-seo-tab">
      {toast && <div className={`seo-toast seo-toast--${toast.type}`}>{toast.msg}</div>}

      {/* Global toggle */}
      <div className="seo-global-bar">
        <div>
          <h3>SEO</h3>
          <p>Control meta tags, titles, and descriptions for each public page.</p>
        </div>
        <label className="seo-toggle" aria-label={globalEnabled ? 'Disable SEO' : 'Enable SEO'}>
          <input type="checkbox" checked={globalEnabled} onChange={toggleGlobal} />
          <span className="seo-toggle-track">
            <span className="seo-toggle-thumb" />
          </span>
          <span className="seo-toggle-label">{globalEnabled ? 'SEO On' : 'SEO Off'}</span>
        </label>
      </div>

      {!globalEnabled && (
        <div className="seo-disabled-banner">
          ⚠️ SEO is globally disabled — all pages will use component defaults and <strong>noindex</strong> will be injected.
        </div>
      )}

      {/* Page list */}
      <div className="seo-page-list">
        {pages.map(page => (
          <div key={page.path} className={`seo-page-row ${!page.enabled ? 'seo-page-row--disabled' : ''}`}>
            {editing === page.path ? (
              /* ── Edit form ── */
              <div className="seo-edit-form">
                <div className="seo-edit-header">
                  <span className="seo-page-label">{page.label}</span>
                  <span className="seo-page-path">{page.path}</span>
                </div>

                <label className="seo-field">
                  <span>Title</span>
                  <input
                    type="text" value={form.title} maxLength={70}
                    placeholder="Page title (≤60 chars ideal)"
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  />
                  <span className="seo-char-count">{form.title.length}/70</span>
                </label>

                <label className="seo-field">
                  <span>Description</span>
                  <textarea
                    value={form.description} maxLength={160} rows={3}
                    placeholder="Meta description (≤155 chars ideal)"
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                  <span className="seo-char-count">{form.description.length}/160</span>
                </label>

                <label className="seo-field">
                  <span>Keywords <span className="seo-optional">(optional)</span></span>
                  <input
                    type="text" value={form.keywords}
                    placeholder="comma, separated, keywords"
                    onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                  />
                </label>

                <label className="seo-field">
                  <span>OG Image URL <span className="seo-optional">(optional)</span></span>
                  <input
                    type="url" value={form.ogImage}
                    placeholder="https://fetchwork.net/og-image.png"
                    onChange={e => setForm(f => ({ ...f, ogImage: e.target.value }))}
                  />
                </label>

                <div className="seo-checks">
                  <label className="seo-check">
                    <input type="checkbox" checked={form.noIndex} onChange={e => setForm(f => ({ ...f, noIndex: e.target.checked }))} />
                    noindex (hide from search engines)
                  </label>
                  <label className="seo-check">
                    <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />
                    Use custom SEO for this page
                  </label>
                </div>

                {/* Preview */}
                <div className="seo-preview">
                  <div className="seo-preview-title">{form.title || page.title || '(no title)'}</div>
                  <div className="seo-preview-url">fetchwork.net{page.path}</div>
                  <div className="seo-preview-desc">{form.description || page.description || '(no description)'}</div>
                </div>

                <div className="seo-edit-actions">
                  <button className="seo-btn seo-btn--save" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="seo-btn seo-btn--cancel" onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            ) : (
              /* ── Summary row ── */
              <div className="seo-page-summary">
                <div className="seo-page-meta">
                  <span className="seo-page-label">{page.label}</span>
                  <span className="seo-page-path">{page.path}</span>
                  {!page.enabled && <span className="seo-badge seo-badge--off">Custom off</span>}
                  {page.noIndex  && <span className="seo-badge seo-badge--noindex">noindex</span>}
                </div>
                <div className="seo-page-preview-text">
                  <div className="seo-pg-title">{page.title || <em>Using defaults</em>}</div>
                  <div className="seo-pg-desc">{page.description || <em>No custom description</em>}</div>
                </div>
                <button className="seo-btn seo-btn--edit" onClick={() => startEdit(page)}>Edit</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminSEOTab;
