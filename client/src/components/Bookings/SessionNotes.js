import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import './SessionNotes.css';

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function NoteAvatar({ author }) {
  const name     = author ? `${author.firstName} ${author.lastName}` : '?';
  const initials = (name).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (author?.avatar) {
    return <img src={author.avatar} alt={name} className="sn-avatar" />;
  }
  return <div className="sn-avatar sn-avatar-initials">{initials}</div>;
}

const SessionNotes = ({ bookingId, occurrenceId }) => {
  const { user } = useAuth();
  const myId = user?._id || user?.userId;

  const [notes,    setNotes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const [content,    setContent]    = useState('');
  const [isPrivate,  setIsPrivate]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState('');

  const [editingId,      setEditingId]      = useState(null);
  const [editContent,    setEditContent]    = useState('');
  const [editIsPrivate,  setEditIsPrivate]  = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/api/bookings/${bookingId}/notes`);
      setNotes(data.notes || []);
    } catch (err) {
      setError('Could not load notes.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setSubmitErr('');
    try {
      await apiRequest(`/api/bookings/${bookingId}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          content,
          isPrivate,
          occurrenceId: occurrenceId || undefined,
        }),
      });
      setContent('');
      setIsPrivate(false);
      await load();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      setSubmitErr(err.message || 'Could not add note.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditContent(note.content);
    setEditIsPrivate(note.isPrivate);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = async (noteId) => {
    if (!editContent.trim()) return;
    setEditSubmitting(true);
    try {
      await apiRequest(`/api/bookings/${bookingId}/notes/${noteId}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editContent, isPrivate: editIsPrivate }),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      // inline error kept in state is enough
    } finally {
      setEditSubmitting(false);
    }
  };

  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await apiRequest(`/api/bookings/${bookingId}/notes/${noteId}`, { method: 'DELETE' });
      await load();
    } catch (_) {}
  };

  return (
    <div className="sn">
      <h2 className="sn-title">Session Notes</h2>

      {loading ? (
        <div className="sn-loading">Loading notes…</div>
      ) : error ? (
        <div className="sn-error">{error}</div>
      ) : notes.length === 0 ? (
        <p className="sn-empty">No notes yet. Add the first one below.</p>
      ) : (
        <div className="sn-list">
          {notes.map(note => {
            const isMine = note.authorId === myId?.toString();
            const authorName = note.author
              ? `${note.author.firstName} ${note.author.lastName}`
              : note.authorRole;

            return (
              <div
                key={note.id}
                className={`sn-note ${isMine ? 'sn-note-mine' : 'sn-note-theirs'} ${note.isPrivate ? 'sn-note-private' : ''}`}
              >
                <div className="sn-note-avatar-col">
                  <NoteAvatar author={note.author} />
                </div>
                <div className="sn-note-body">
                  <div className="sn-note-meta">
                    <span className="sn-note-author">{authorName}</span>
                    {note.isPrivate && (
                      <span className="sn-private-badge" title="Only visible to you">
                        🔒 Private
                      </span>
                    )}
                    <span className="sn-note-time">{timeAgo(note.createdAt)}</span>
                  </div>

                  {editingId === note.id ? (
                    <div className="sn-edit-form">
                      <textarea
                        className="sn-textarea"
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={3}
                        autoFocus
                      />
                      <div className="sn-edit-row">
                        <label className="sn-check-label">
                          <input
                            type="checkbox"
                            checked={editIsPrivate}
                            onChange={e => setEditIsPrivate(e.target.checked)}
                          />
                          Private
                        </label>
                        <div className="sn-edit-actions">
                          <button className="sn-btn-text" onClick={cancelEdit} disabled={editSubmitting}>
                            Cancel
                          </button>
                          <button
                            className="sn-btn-save"
                            onClick={() => saveEdit(note.id)}
                            disabled={editSubmitting || !editContent.trim()}
                          >
                            {editSubmitting ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="sn-note-content">{note.content}</p>
                      {isMine && (
                        <div className="sn-note-actions">
                          <button className="sn-action-btn" onClick={() => startEdit(note)}>
                            Edit
                          </button>
                          <button className="sn-action-btn sn-action-delete" onClick={() => deleteNote(note.id)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Add note form */}
      <form className="sn-form" onSubmit={handleSubmit}>
        <textarea
          className="sn-textarea"
          placeholder="Add a session note…"
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={3}
          required
        />
        <div className="sn-form-footer">
          <label className="sn-check-label">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={e => setIsPrivate(e.target.checked)}
            />
            <span>
              🔒 Private{' '}
              <span className="sn-check-hint">(only you can see this)</span>
            </span>
          </label>
          <button className="sn-submit" type="submit" disabled={submitting || !content.trim()}>
            {submitting ? 'Adding…' : 'Add Note'}
          </button>
        </div>
        {submitErr && <p className="sn-submit-err">{submitErr}</p>}
      </form>
    </div>
  );
};

export default SessionNotes;
