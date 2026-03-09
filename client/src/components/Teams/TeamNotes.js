import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './TeamNotes.css';

const FILTERS = ['All', 'Pinned', 'General', 'Member', 'Job'];

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function authorName(author) {
  if (!author) return 'Unknown';
  return `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.email || 'Unknown';
}

export default function TeamNotes({ teamId, currentUserId, isAdmin }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [content, setContent] = useState('');
  const [relatedType, setRelatedType] = useState('general');
  const [submitting, setSubmitting] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/notes`);
      setNotes(data.notes || []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/teams/${teamId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: content.trim(), relatedTo: { type: relatedType } }),
      });
      setContent('');
      setRelatedType('general');
      await fetchNotes();
    } catch {
      // error handled silently
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noteId) => {
    try {
      await apiRequest(`/api/teams/${teamId}/notes/${noteId}`, { method: 'DELETE' });
      await fetchNotes();
    } catch {
      // error handled silently
    }
  };

  const handleTogglePin = async (noteId, currentlyPinned) => {
    try {
      await apiRequest(`/api/teams/${teamId}/notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned: !currentlyPinned }),
      });
      await fetchNotes();
    } catch {
      // error handled silently
    }
  };

  const filtered = notes.filter(note => {
    if (filter === 'All') return true;
    if (filter === 'Pinned') return note.pinned;
    return (note.relatedTo?.type || 'general') === filter.toLowerCase();
  });

  // Pinned notes first, then by date
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  if (loading) {
    return <div className="tn2-root"><div className="tn2-loading">Loading notes...</div></div>;
  }

  return (
    <div className="tn2-root">
      <h3 className="tn2-title">Team Notes</h3>

      {/* Add note form */}
      <form className="tn2-form" onSubmit={handleSubmit}>
        <textarea
          className="tn2-textarea"
          placeholder="Add a note for your team..."
          value={content}
          onChange={e => setContent(e.target.value)}
          maxLength={1000}
          rows={3}
        />
        <div className="tn2-form-footer">
          <select
            className="tn2-select"
            value={relatedType}
            onChange={e => setRelatedType(e.target.value)}
          >
            <option value="general">General</option>
            <option value="member">Member-related</option>
            <option value="job">Job-related</option>
          </select>
          <span className="tn2-char-count">{content.length}/1000</span>
          <button
            type="submit"
            className="tn2-submit"
            disabled={!content.trim() || submitting}
          >
            {submitting ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      </form>

      {/* Filter bar */}
      <div className="tn2-filters">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`tn2-filter-btn ${filter === f ? 'tn2-filter-btn--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'Member' ? 'Member-related' : f === 'Job' ? 'Job-related' : f}
          </button>
        ))}
      </div>

      {/* Notes list */}
      {sorted.length === 0 ? (
        <div className="tn2-empty">No notes yet. Add the first one above.</div>
      ) : (
        <div className="tn2-list">
          {sorted.map(note => {
            const isAuthor = currentUserId && (
              String(note.author?._id || note.author) === String(currentUserId)
            );
            const canDelete = isAuthor || isAdmin;
            return (
              <div className={`tn2-note ${note.pinned ? 'tn2-note--pinned' : ''}`} key={note._id}>
                <div className="tn2-note-header">
                  <div className="tn2-note-author">
                    {note.author?.profileImage ? (
                      <img className="tn2-avatar" src={note.author.profileImage} alt="" />
                    ) : (
                      <span className="tn2-avatar-placeholder">
                        {(note.author?.firstName || '?')[0]}
                      </span>
                    )}
                    <span className="tn2-author-name">{authorName(note.author)}</span>
                  </div>
                  <span className="tn2-note-time">{relativeTime(note.createdAt)}</span>
                </div>
                <p className="tn2-note-content">{note.content}</p>
                <div className="tn2-note-footer">
                  {note.relatedTo?.type && note.relatedTo.type !== 'general' && (
                    <span className="tn2-note-tag">{note.relatedTo.type}</span>
                  )}
                  <div className="tn2-note-actions">
                    <button
                      className="tn2-pin-btn"
                      onClick={() => handleTogglePin(note._id, note.pinned)}
                      title={note.pinned ? 'Unpin' : 'Pin'}
                    >
                      {note.pinned ? '📌' : '📍'}
                    </button>
                    {canDelete && (
                      <button
                        className="tn2-delete-btn"
                        onClick={() => handleDelete(note._id)}
                        title="Delete note"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
