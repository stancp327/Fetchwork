import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import TeamChannelView from './TeamChannelView';
import './TeamChannels.css';

export default function TeamChannels({ teamId, teamMembers = [] }) {
  const [channels, setChannels]     = useState([]);
  const [active, setActive]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState({ name: '', description: '', memberIds: [] });
  const [saving, setSaving]         = useState(false);
  const [createError, setCreateError] = useState('');

  const activeRef = React.useRef(active);
  activeRef.current = active;

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/team-channels/${teamId}`);
      setChannels(data.channels || []);
      if (!activeRef.current && data.channels?.length) setActive(data.channels[0]);
    } catch (err) {
      setError(err.message || 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const createChannel = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setCreateError('');
    try {
      const data = await apiRequest('/api/team-channels', {
        method: 'POST',
        body: JSON.stringify({ teamId, ...form }),
      });
      setChannels(prev => [data.channel, ...prev]);
      setActive(data.channel);
      setShowCreate(false);
      setForm({ name: '', description: '', memberIds: [] });
    } catch (err) {
      setCreateError(err.message || 'Failed to create channel');
    } finally {
      setSaving(false);
    }
  };

  const toggleMember = (id) => {
    setForm(f => ({
      ...f,
      memberIds: f.memberIds.includes(id) ? f.memberIds.filter(m => m !== id) : [...f.memberIds, id],
    }));
  };

  return (
    <div className="tc-root">
      {/* Sidebar */}
      <div className="tc-sidebar">
        <div className="tc-sidebar-header">
          <span className="tc-sidebar-title">Channels</span>
          <button className="tc-create-btn" onClick={() => setShowCreate(true)} title="Create channel">＋</button>
        </div>

        {loading ? (
          <p className="tc-loading">Loading...</p>
        ) : error ? (
          <div className="tc-error">
            <p>{error}</p>
            <button className="tc-empty-link" onClick={load}>Retry</button>
          </div>
        ) : channels.length === 0 ? (
          <p className="tc-empty">No channels yet.<br /><button className="tc-empty-link" onClick={() => setShowCreate(true)}>Create one</button></p>
        ) : (
          <ul className="tc-channel-list">
            {channels.map(ch => (
              <li
                key={ch._id}
                className={`tc-channel-item${active?._id === ch._id ? ' active' : ''}`}
                onClick={() => setActive(ch)}
              >
                <span className="tc-channel-hash">#</span>
                <div className="tc-channel-info">
                  <span className="tc-channel-name">{ch.name}</span>
                  {ch.lastMessage && <span className="tc-channel-preview">{ch.lastMessage}</span>}
                </div>
                {ch.unreadCount > 0 && <span className="tc-unread-badge">{ch.unreadCount}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Main view */}
      <div className="tc-main">
        {active
          ? <TeamChannelView channel={active} teamMembers={teamMembers} onChannelUpdate={load} />
          : <div className="tc-no-selection"><p>Select a channel to start messaging</p></div>
        }
      </div>

      {/* Create channel modal */}
      {showCreate && (
        <div className="tc-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="tc-modal" onClick={e => e.stopPropagation()}>
            <div className="tc-modal-header">
              <h3>Create Channel</h3>
              <button className="tc-modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={createChannel} className="tc-modal-form">
              <label className="tc-label">Channel name</label>
              <input
                className="tc-input"
                placeholder="e.g. general, design, announcements"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
              <label className="tc-label">Description (optional)</label>
              <input
                className="tc-input"
                placeholder="What's this channel for?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
              {teamMembers.length > 0 && (
                <>
                  <label className="tc-label">Add members</label>
                  <div className="tc-member-list">
                    {teamMembers.map(m => {
                      const id = m.user?._id || m.user;
                      const name = m.user?.firstName ? `${m.user.firstName} ${m.user.lastName || ''}`.trim() : 'Member';
                      return (
                        <label key={id} className="tc-member-row">
                          <input type="checkbox" checked={form.memberIds.includes(id)} onChange={() => toggleMember(id)} />
                          <span>{name}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
              {createError && <p className="tc-create-error">{createError}</p>}
              <div className="tc-modal-actions">
                <button type="button" className="tc-btn-cancel" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="tc-btn-primary" disabled={!form.name.trim() || saving}>
                  {saving ? 'Creating…' : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
