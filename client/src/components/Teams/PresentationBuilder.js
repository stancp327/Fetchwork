import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import './PresentationBuilder.css';

const SECTION_TYPES = [
  { type: 'intro', label: 'Cover / Intro', icon: '📄' },
  { type: 'team', label: 'Team Intro', icon: '👥' },
  { type: 'services', label: 'Services', icon: '⚙️' },
  { type: 'portfolio', label: 'Portfolio', icon: '🖼️' },
  { type: 'milestones', label: 'Milestones', icon: '🎯' },
  { type: 'pricing', label: 'Pricing', icon: '💰' },
  { type: 'custom', label: 'Custom Text', icon: '✏️' },
];

const STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
};

const defaultSectionContent = (type) => {
  switch (type) {
    case 'intro':      return { title: 'Introduction', content: '', items: null };
    case 'team':       return { title: 'Meet Our Team', content: '', items: [] };
    case 'services':   return { title: 'Our Services', content: '', items: [] };
    case 'portfolio':  return { title: 'Portfolio', content: '', items: [] };
    case 'milestones': return { title: 'Project Milestones', content: '', items: null };
    case 'pricing':    return { title: 'Pricing Summary', content: '', items: null };
    case 'custom':     return { title: 'Additional Info', content: '', items: null };
    default:           return { title: '', content: '', items: null };
  }
};

export default function PresentationBuilder({ teamId, presentationId, onClose, onSaved }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    title: '',
    clientName: '',
    clientEmail: '',
    sections: [
      { type: 'intro', ...defaultSectionContent('intro') },
    ],
    proposedMilestones: [],
    totalAmount: '',
    validUntil: '',
    status: 'draft',
    slug: '',
  });

  // Load existing presentation
  const fetchPresentation = useCallback(async () => {
    if (!presentationId) return;
    try {
      setLoading(true);
      const data = await apiRequest(`/api/presentations/${presentationId}`);
      const p = data.presentation;
      setForm({
        title: p.title || '',
        clientName: p.clientName || '',
        clientEmail: p.clientEmail || '',
        sections: p.sections || [],
        proposedMilestones: p.proposedMilestones || [],
        totalAmount: p.totalAmount || '',
        validUntil: p.validUntil ? p.validUntil.slice(0, 10) : '',
        status: p.status || 'draft',
        slug: p.slug || '',
      });
    } catch (err) {
      setError(err.message || 'Failed to load presentation');
    } finally {
      setLoading(false);
    }
  }, [presentationId]);

  useEffect(() => { fetchPresentation(); }, [fetchPresentation]);

  // Section management
  const addSection = (type) => {
    setForm(prev => ({
      ...prev,
      sections: [...prev.sections, { type, ...defaultSectionContent(type) }],
    }));
  };

  const removeSection = (idx) => {
    setForm(prev => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== idx),
    }));
  };

  const updateSection = (idx, field, value) => {
    setForm(prev => {
      const sections = [...prev.sections];
      sections[idx] = { ...sections[idx], [field]: value };
      return { ...prev, sections };
    });
  };

  const moveSectionUp = (idx) => {
    if (idx === 0) return;
    setForm(prev => {
      const sections = [...prev.sections];
      [sections[idx - 1], sections[idx]] = [sections[idx], sections[idx - 1]];
      return { ...prev, sections };
    });
  };

  const moveSectionDown = (idx) => {
    setForm(prev => {
      if (idx >= prev.sections.length - 1) return prev;
      const sections = [...prev.sections];
      [sections[idx], sections[idx + 1]] = [sections[idx + 1], sections[idx]];
      return { ...prev, sections };
    });
  };

  // Milestones
  const addMilestone = () => {
    setForm(prev => ({
      ...prev,
      proposedMilestones: [...prev.proposedMilestones, { title: '', description: '', amount: '', dueDate: '' }],
    }));
  };

  const removeMilestone = (idx) => {
    setForm(prev => ({
      ...prev,
      proposedMilestones: prev.proposedMilestones.filter((_, i) => i !== idx),
    }));
  };

  const updateMilestone = (idx, field, value) => {
    setForm(prev => {
      const milestones = [...prev.proposedMilestones];
      milestones[idx] = { ...milestones[idx], [field]: value };
      return { ...prev, proposedMilestones: milestones };
    });
  };

  // Save
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setError('');
    setSaving(true);
    try {
      const payload = {
        team: teamId,
        title: form.title,
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        sections: form.sections,
        proposedMilestones: form.proposedMilestones.filter(m => m.title),
        totalAmount: form.totalAmount ? Number(form.totalAmount) : undefined,
        validUntil: form.validUntil || undefined,
      };

      let data;
      if (presentationId) {
        data = await apiRequest(`/api/presentations/${presentationId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        data = await apiRequest('/api/presentations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setForm(prev => ({
        ...prev,
        slug: data.presentation?.slug || prev.slug,
        status: data.presentation?.status || prev.status,
      }));

      if (onSaved) onSaved(data.presentation);
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Send
  const handleSend = async () => {
    if (!presentationId && !form.slug) {
      await handleSave();
    }

    const id = presentationId || form.slug;
    if (!id) return;

    try {
      setSaving(true);
      await apiRequest(`/api/presentations/${presentationId}/send`, { method: 'POST' });
      setForm(prev => ({ ...prev, status: 'sent' }));
    } catch (err) {
      setError(err.message || 'Failed to send');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (!form.slug) return;
    const url = `${window.location.origin}/presentation/${form.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return <div className="pb-loading">Loading presentation...</div>;
  }

  // ── Preview mode ──────────────────────────────────────────────
  if (showPreview) {
    return (
      <div className="pb-preview-wrapper">
        <div className="pb-preview-bar">
          <span className="pb-preview-label">Preview Mode</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowPreview(false)}>Back to Editor</button>
        </div>
        <div className="pb-preview-content">
          <h1 className="pb-preview-title">{form.title || 'Untitled Presentation'}</h1>
          {form.clientName && <p className="pb-preview-client">Prepared for: {form.clientName}</p>}
          {form.sections.map((section, i) => (
            <div key={i} className="pb-preview-section">
              <h2>{section.title || SECTION_TYPES.find(s => s.type === section.type)?.label}</h2>
              {section.content && <div className="pb-preview-text">{section.content}</div>}
              {section.type === 'services' && Array.isArray(section.items) && section.items.length > 0 && (
                <ul className="pb-preview-list">{section.items.map((item, j) => <li key={j}>{typeof item === 'string' ? item : item.name || item.title || JSON.stringify(item)}</li>)}</ul>
              )}
              {section.type === 'portfolio' && Array.isArray(section.items) && section.items.length > 0 && (
                <div className="pb-preview-grid">{section.items.map((item, j) => (
                  <div key={j} className="pb-preview-card">{typeof item === 'string' ? item : item.title || item.name || JSON.stringify(item)}</div>
                ))}</div>
              )}
            </div>
          ))}
          {form.proposedMilestones.length > 0 && (
            <div className="pb-preview-section">
              <h2>Milestones</h2>
              <table className="pb-preview-table">
                <thead><tr><th>Milestone</th><th>Description</th><th>Amount</th><th>Due</th></tr></thead>
                <tbody>
                  {form.proposedMilestones.map((m, i) => (
                    <tr key={i}><td>{m.title}</td><td>{m.description}</td><td>{m.amount ? `$${m.amount}` : '-'}</td><td>{m.dueDate ? new Date(m.dueDate).toLocaleDateString() : '-'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {form.totalAmount && (
            <div className="pb-preview-total">Total: ${Number(form.totalAmount).toLocaleString()}</div>
          )}
        </div>
      </div>
    );
  }

  // ── Editor mode ───────────────────────────────────────────────
  return (
    <div className="pb-container">
      <div className="pb-header">
        <h2 className="pb-title">{presentationId ? 'Edit Presentation' : 'New Presentation'}</h2>
        <div className="pb-header-actions">
          {form.status && (
            <span className={`pb-status pb-status--${form.status}`}>
              {STATUS_LABELS[form.status]}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowPreview(true)}>Preview</button>
          {onClose && <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>}
        </div>
      </div>

      {error && <div className="pb-error">{error}</div>}

      <form onSubmit={handleSave} className="pb-form">
        {/* Meta fields */}
        <div className="pb-meta-grid">
          <div className="pb-field">
            <label>Presentation Title *</label>
            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Website Redesign Proposal" className="form-input" required />
          </div>
          <div className="pb-field">
            <label>Client Name</label>
            <input type="text" value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} placeholder="Acme Corp" className="form-input" />
          </div>
          <div className="pb-field">
            <label>Client Email</label>
            <input type="email" value={form.clientEmail} onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))} placeholder="contact@acme.com" className="form-input" />
          </div>
          <div className="pb-field">
            <label>Valid Until</label>
            <input type="date" value={form.validUntil} onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))} className="form-input" />
          </div>
        </div>

        {/* Sections */}
        <div className="pb-sections">
          <div className="pb-sections-header">
            <h3>Sections</h3>
            <div className="pb-add-section">
              {SECTION_TYPES.map(s => (
                <button key={s.type} type="button" className="btn btn-ghost btn-sm" onClick={() => addSection(s.type)}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {form.sections.map((section, idx) => (
            <div key={idx} className="pb-section-block">
              <div className="pb-section-bar">
                <span className="pb-section-type">
                  {SECTION_TYPES.find(s => s.type === section.type)?.icon} {SECTION_TYPES.find(s => s.type === section.type)?.label}
                </span>
                <div className="pb-section-controls">
                  <button type="button" className="pb-btn-icon" onClick={() => moveSectionUp(idx)} disabled={idx === 0} title="Move up">↑</button>
                  <button type="button" className="pb-btn-icon" onClick={() => moveSectionDown(idx)} disabled={idx === form.sections.length - 1} title="Move down">↓</button>
                  <button type="button" className="pb-btn-icon pb-btn-danger" onClick={() => removeSection(idx)} title="Remove">×</button>
                </div>
              </div>
              <div className="pb-section-fields">
                <input type="text" className="form-input" value={section.title} onChange={e => updateSection(idx, 'title', e.target.value)} placeholder="Section title" />
                <textarea className="form-textarea" value={section.content} onChange={e => updateSection(idx, 'content', e.target.value)} placeholder="Section content..." rows={4} />
                {(section.type === 'services' || section.type === 'portfolio' || section.type === 'team') && (
                  <div className="pb-items-hint">
                    <label>Items (comma-separated)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={Array.isArray(section.items) ? section.items.join(', ') : ''}
                      onChange={e => updateSection(idx, 'items', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="Item 1, Item 2, Item 3"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          {form.sections.length === 0 && (
            <div className="pb-empty-sections">No sections yet. Add one above to get started.</div>
          )}
        </div>

        {/* Milestones */}
        <div className="pb-milestones">
          <div className="pb-milestones-header">
            <h3>Proposed Milestones</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addMilestone}>+ Add Milestone</button>
          </div>
          {form.proposedMilestones.map((m, idx) => (
            <div key={idx} className="pb-milestone-row">
              <input type="text" className="form-input" value={m.title} onChange={e => updateMilestone(idx, 'title', e.target.value)} placeholder="Milestone title" />
              <input type="text" className="form-input" value={m.description} onChange={e => updateMilestone(idx, 'description', e.target.value)} placeholder="Description" />
              <input type="number" className="form-input pb-input-sm" value={m.amount} onChange={e => updateMilestone(idx, 'amount', e.target.value)} placeholder="$" />
              <input type="date" className="form-input pb-input-sm" value={m.dueDate ? m.dueDate.slice(0, 10) : ''} onChange={e => updateMilestone(idx, 'dueDate', e.target.value)} />
              <button type="button" className="pb-btn-icon pb-btn-danger" onClick={() => removeMilestone(idx)}>×</button>
            </div>
          ))}
        </div>

        {/* Total amount */}
        <div className="pb-field pb-total-field">
          <label>Total Amount ($)</label>
          <input type="number" className="form-input" value={form.totalAmount} onChange={e => setForm(p => ({ ...p, totalAmount: e.target.value }))} placeholder="0.00" />
        </div>

        {/* Actions */}
        <div className="pb-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : (presentationId ? 'Save Changes' : 'Create Presentation')}
          </button>
          {presentationId && form.status === 'draft' && (
            <button type="button" className="btn btn-success" onClick={handleSend} disabled={saving}>
              Send to Client
            </button>
          )}
          {form.slug && (
            <button type="button" className="btn btn-secondary" onClick={copyLink}>
              {copied ? 'Link Copied!' : 'Copy Shareable Link'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
