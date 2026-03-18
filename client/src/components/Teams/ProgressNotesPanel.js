import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '../../utils/api';

const relTime = (d) => {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
};

export default function ProgressNotesPanel({ teamId, jobId, teamMembers = [], currentUserId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/notes`);
      setNotes(res.notes || []);
    } catch (e) {
      setError(e.message || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [teamId, jobId]);

  useEffect(() => { load(); }, [load]);

  const addNote = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: text.trim() }),
      });
      setNotes(prev => [res.note, ...prev]);
      setText('');
    } catch (err) {
      alert(err.message || 'Failed to add note');
    } finally {
      setSending(false);
    }
  };

  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    setNotes(prev => prev.filter(n => n._id !== noteId));
    try {
      await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/notes/${noteId}`, { method: 'DELETE' });
    } catch { load(); }
  };

  // @mention helpers
  const filteredMembers = mentionQuery !== null
    ? teamMembers.filter(m => m.firstName?.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : [];

  const handleInputChange = (e) => {
    const val = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const atMatch = before.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (member) => {
    const cursor = inputRef.current?.selectionStart || text.length;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    const replaced = before.replace(/@(\w*)$/, `@${member.firstName} `);
    setText(replaced + after);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, filteredMembers.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMembers[mentionIdx]); return; }
      if (e.key === 'Escape') { setMentionQuery(null); return; }
    }
  };

  const canDelete = (note) => {
    if (!note.author) return false;
    return String(note.author._id || note.author) === String(currentUserId);
  };

  const visible = showAll ? notes : notes.slice(0, 5);

  if (loading) return <div className="pn-loading">Loading notes…</div>;
  if (error) return (
    <div className="pn-error">
      {error} <button className="pn-retry-btn" onClick={load}>Retry</button>
    </div>
  );

  return (
    <div className="pn-panel">
      <div className="pn-header">
        <span className="pn-label">Progress Notes</span>
        <span className="pn-count">{notes.length}</span>
      </div>

      {/* Add note input */}
      <div className="pn-add" style={{ position: 'relative' }}>
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div className="jc-mention-dropdown" style={{ bottom: '100%', left: 0 }}>
            {filteredMembers.map((m, i) => (
              <div
                key={m._id}
                className={`jc-mention-item${i === mentionIdx ? ' jc-mention-active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
              >
                {m.firstName} {m.lastName}
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          className="pn-textarea"
          placeholder="Add a progress update… (@ to mention)"
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={() => { setTimeout(() => setMentionQuery(null), 150); }}
          rows={2}
        />
        <button className="pn-add-btn" onClick={addNote} disabled={sending || !text.trim()}>
          {sending ? 'Posting…' : 'Post Update'}
        </button>
      </div>

      {/* Timeline */}
      {notes.length === 0 ? (
        <div className="pn-empty">
          <span className="pn-empty-icon">📝</span>
          <p>No progress notes yet.</p>
          <p className="pn-empty-sub">Add updates to keep your team in the loop.</p>
        </div>
      ) : (
        <div className="pn-timeline">
          {visible.map(note => (
            <div key={note._id} className="pn-note">
              <div className="pn-note-dot" />
              <div className="pn-note-content">
                <div className="pn-note-header">
                  <span className="pn-note-author">{note.author?.firstName || 'Unknown'}</span>
                  <span className="pn-note-time">{relTime(note.createdAt)}</span>
                  {canDelete(note) && (
                    <button className="pn-note-del" onClick={() => deleteNote(note._id)} title="Delete">×</button>
                  )}
                </div>
                <div className="pn-note-body">{note.content}</div>
              </div>
            </div>
          ))}
          {notes.length > 5 && !showAll && (
            <button className="pn-show-all" onClick={() => setShowAll(true)}>
              Show all ({notes.length}) notes
            </button>
          )}
        </div>
      )}
    </div>
  );
}
