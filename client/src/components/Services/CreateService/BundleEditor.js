import React from 'react';

const EMPTY_BUNDLE = { name: '', sessions: '', price: '', expiresInDays: '' };

const BundleEditor = ({ bundles, onChange }) => {
  const [draft, setDraft] = React.useState(EMPTY_BUNDLE);
  const [draftErr, setDraftErr] = React.useState({});

  const updateDraft = (k, v) => {
    setDraft(prev => ({ ...prev, [k]: v }));
    if (draftErr[k]) setDraftErr(prev => ({ ...prev, [k]: '' }));
  };

  const addBundle = () => {
    const e = {};
    if (!draft.name.trim())                             e.name     = 'Required';
    if (!draft.sessions || parseInt(draft.sessions) < 2) e.sessions = 'Min 2 sessions';
    if (!draft.price    || parseFloat(draft.price)   < 5) e.price    = 'Min $5';
    if (Object.keys(e).length) { setDraftErr(e); return; }
    onChange([...bundles, {
      name:          draft.name.trim(),
      sessions:      parseInt(draft.sessions),
      price:         parseFloat(draft.price),
      expiresInDays: draft.expiresInDays ? parseInt(draft.expiresInDays) : null,
      active:        true,
    }]);
    setDraft(EMPTY_BUNDLE);
    setDraftErr({});
  };

  const removeBundle = idx => onChange(bundles.filter((_, i) => i !== idx));

  return (
    <div className="bundle-editor">
      <h4>📦 Session Bundles <span className="pkg-add-hint">— optional prepaid packages (e.g. 3 sessions for $80)</span></h4>

      {bundles.length > 0 && (
        <div className="bundle-list">
          {bundles.map((b, i) => (
            <div key={i} className="bundle-chip">
              <span className="bundle-chip-name">{b.name}</span>
              <span className="bundle-chip-detail">{b.sessions} sessions · ${b.price}</span>
              {b.expiresInDays && <span className="bundle-chip-expiry">⏱ {b.expiresInDays}d</span>}
              <button type="button" className="bundle-chip-remove" onClick={() => removeBundle(i)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="bundle-draft">
        <div className="bundle-draft-row">
          <div className="wiz-field">
            <label>Bundle name</label>
            <input type="text" value={draft.name} onChange={e => updateDraft('name', e.target.value)}
              placeholder='e.g. "3-session pack"' />
            {draftErr.name && <span className="wiz-error">{draftErr.name}</span>}
          </div>
          <div className="wiz-field" style={{ maxWidth: 100 }}>
            <label># Sessions</label>
            <input type="number" min="2" max="100" value={draft.sessions}
              onChange={e => updateDraft('sessions', e.target.value)} placeholder="3" />
            {draftErr.sessions && <span className="wiz-error">{draftErr.sessions}</span>}
          </div>
          <div className="wiz-field" style={{ maxWidth: 110 }}>
            <label>Total price</label>
            <input type="number" min="5" step="0.01" value={draft.price}
              onChange={e => updateDraft('price', e.target.value)} placeholder="$80" />
            {draftErr.price && <span className="wiz-error">{draftErr.price}</span>}
          </div>
          <div className="wiz-field" style={{ maxWidth: 120 }}>
            <label>Expires (days)</label>
            <input type="number" min="7" value={draft.expiresInDays}
              onChange={e => updateDraft('expiresInDays', e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <button type="button" className="pkg-add-btn" style={{ marginTop: 8 }} onClick={addBundle}>
          + Add Bundle
        </button>
      </div>
    </div>
  );
};


export default BundleEditor;
