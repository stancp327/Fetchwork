import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';

const QuickUpdate = ({ jobId, onPosted }) => {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    if (!msg.trim()) return;
    setPosting(true);
    try {
      await apiRequest(`/api/jobs/${jobId}/progress`, {
        method: 'POST',
        body: JSON.stringify({ message: msg.trim() })
      });
      setMsg('');
      setOpen(false);
      if (onPosted) onPosted();
    } catch (err) {
      alert(err.message || 'Failed to post update');
    } finally { setPosting(false); }
  };

  if (!open) return (
    <button className="pm-quick-update-btn" onClick={() => setOpen(true)}>
      💬 Post Update
    </button>
  );

  return (
    <div className="pm-quick-update-form">
      <textarea
        rows={2}
        placeholder="Share a progress update with the client…"
        value={msg}
        onChange={e => setMsg(e.target.value)}
      />
      <div className="pm-quick-update-actions">
        <button className="pm-qua-cancel" onClick={() => { setOpen(false); setMsg(''); }}>
          Cancel
        </button>
        <button className="pm-qua-send" disabled={posting || !msg.trim()} onClick={submit}>
          {posting ? 'Posting…' : 'Post Update'}
        </button>
      </div>
    </div>
  );
};

export default QuickUpdate;
