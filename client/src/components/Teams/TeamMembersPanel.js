import React, { useState, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './TeamMembersPanel.css';

const ROLES = ['admin', 'manager', 'member'];

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function memberName(u) {
  if (!u) return 'Unknown';
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Unknown';
}

function memberInitials(u) {
  if (!u) return '?';
  return ((u.firstName?.[0] || '') + (u.lastName?.[0] || '')).toUpperCase() || '?';
}

export default function TeamMembersPanel({ teamId, team, onTeamUpdated }) {
  const { user } = useAuth();
  const currentUserId = String(user?._id || user?.id || '');

  const allMembers = team?.members || [];
  const activeMembers = allMembers.filter(m => m.status === 'active');
  const pendingInvites = allMembers.filter(m => m.status === 'invited');

  const currentUserRole = team?.currentUserRole;
  const canManage = ['owner', 'admin'].includes(currentUserRole);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteTab, setInviteTab] = useState('search'); // 'search' | 'email'
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member', title: '' });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // User search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchTimer, setSearchTimer] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  // Join code
  const [joinCode, setJoinCode] = useState(team?.joinCode || '');
  const [joinCodeEnabled, setJoinCodeEnabled] = useState(team?.joinCodeEnabled || false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Role change
  const [changingRole, setChangingRole] = useState(null);

  // Remove confirm
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  const refreshTeam = useCallback(async () => {
    try {
      const data = await apiRequest(`/api/teams/${teamId}`);
      if (data?.team && onTeamUpdated) onTeamUpdated(data.team);
    } catch { /* silent */ }
  }, [teamId, onTeamUpdated]);

  // Debounced user search
  const handleSearchChange = (q) => {
    setSearchQuery(q);
    setSelectedUser(null);
    if (searchTimer) clearTimeout(searchTimer);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiRequest(`/api/teams/${teamId}/search-users?q=${encodeURIComponent(q.trim())}`);
        setSearchResults(data.users || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    setSearchTimer(timer);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (inviting) return;

    const body = { role: inviteForm.role, title: inviteForm.title.trim() || undefined };

    if (inviteTab === 'search') {
      if (!selectedUser) { setInviteError('Select a user to invite'); return; }
      body.userId = selectedUser._id || selectedUser.id;
    } else {
      if (!inviteForm.email.trim()) return;
      body.email = inviteForm.email.trim();
    }

    setInviteError('');
    setInviteSuccess('');
    setInviting(true);
    try {
      await apiRequest(`/api/teams/${teamId}/invite`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const label = inviteTab === 'search' ? memberName(selectedUser) : inviteForm.email;
      setInviteSuccess(`Invitation sent to ${label}`);
      setInviteForm({ email: '', role: 'member', title: '' });
      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
      await refreshTeam();
    } catch (err) {
      setInviteError(err.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  // Join code handlers
  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/join-code`, { method: 'POST', body: JSON.stringify({}) });
      setJoinCode(data.joinCode);
      setJoinCodeEnabled(true);
      await refreshTeam();
    } catch (err) {
      alert(err.message || 'Failed to generate join code');
    } finally { setGeneratingCode(false); }
  };

  const handleDisableCode = async () => {
    try {
      await apiRequest(`/api/teams/${teamId}/join-code`, { method: 'DELETE' });
      setJoinCodeEnabled(false);
      await refreshTeam();
    } catch (err) {
      alert(err.message || 'Failed to disable join code');
    }
  };

  const copyJoinLink = () => {
    const url = `${window.location.origin}/teams/join/${joinCode}`;
    navigator.clipboard.writeText(url);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleRoleChange = async (memberId, userId, newRole) => {
    setChangingRole(memberId);
    try {
      await apiRequest(`/api/teams/${teamId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      await refreshTeam();
    } catch (err) {
      alert(err.message || 'Failed to change role');
    } finally {
      setChangingRole(null);
    }
  };

  const handleRemove = async (userId) => {
    setRemoving(true);
    try {
      await apiRequest(`/api/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
      });
      setConfirmRemove(null);
      await refreshTeam();
    } catch (err) {
      alert(err.message || 'Failed to remove member');
    } finally {
      setRemoving(false);
    }
  };

  const handleRevoke = async (userId) => {
    try {
      await apiRequest(`/api/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
      });
      await refreshTeam();
    } catch (err) {
      alert(err.message || 'Failed to revoke invitation');
    }
  };

  return (
    <div className="tmp-root">
      {/* Header */}
      <div className="tmp-header">
        <h2 className="tmp-title">Members ({activeMembers.length})</h2>
        {canManage && (
          <button className="tmp-btn tmp-btn--primary" onClick={() => setShowInvite(true)}>
            Invite Member
          </button>
        )}
      </div>

      {/* Active members table */}
      <div className="tmp-table-wrap">
        <table className="tmp-table">
          <thead>
            <tr>
              <th className="tmp-th">Member</th>
              <th className="tmp-th">Role</th>
              <th className="tmp-th tmp-hide-mobile">Title</th>
              <th className="tmp-th tmp-hide-mobile">Joined</th>
              {canManage && <th className="tmp-th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {activeMembers.map(m => {
              const u = m.user || {};
              const userId = String(u._id || u.id || m.user);
              const isOwner = m.role === 'owner';
              const isSelf = userId === currentUserId;

              return (
                <tr key={m._id} className="tmp-row">
                  <td className="tmp-td">
                    <div className="tmp-member-cell">
                      {u.profileImage ? (
                        <img src={u.profileImage} alt="" className="tmp-avatar" />
                      ) : (
                        <span className="tmp-avatar tmp-avatar--placeholder">{memberInitials(u)}</span>
                      )}
                      <div className="tmp-member-info">
                        <span className="tmp-name">{memberName(u)}</span>
                        <span className="tmp-email">{u.email || ''}</span>
                      </div>
                    </div>
                  </td>
                  <td className="tmp-td">
                    {canManage && !isOwner && !isSelf ? (
                      <select
                        className="tmp-role-select"
                        value={m.role}
                        disabled={changingRole === m._id}
                        onChange={e => handleRoleChange(m._id, userId, e.target.value)}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`tmp-role-badge tmp-role-badge--${m.role}`}>{m.role}</span>
                    )}
                  </td>
                  <td className="tmp-td tmp-hide-mobile">
                    <span className="tmp-title-text">{m.title || '—'}</span>
                  </td>
                  <td className="tmp-td tmp-hide-mobile">{formatDate(m.joinedAt)}</td>
                  {canManage && (
                    <td className="tmp-td">
                      {!isOwner && !isSelf && (
                        <button
                          className="tmp-btn tmp-btn--danger-ghost"
                          onClick={() => setConfirmRemove({ userId, name: memberName(u) })}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <section className="tmp-section">
          <h3 className="tmp-section-title">Pending Invitations ({pendingInvites.length})</h3>
          <div className="tmp-pending-list">
            {pendingInvites.map(m => {
              const u = m.user || {};
              return (
                <div key={m._id} className="tmp-pending-item">
                  <div className="tmp-member-cell">
                    <span className="tmp-avatar tmp-avatar--placeholder">{memberInitials(u)}</span>
                    <div className="tmp-member-info">
                      <span className="tmp-name">{memberName(u)}</span>
                      <span className="tmp-email">Invited {formatDate(m.invitedAt)}</span>
                    </div>
                  </div>
                  <span className={`tmp-role-badge tmp-role-badge--${m.role}`}>{m.role}</span>
                  {canManage && (
                    <button
                      className="tmp-btn tmp-btn--danger-ghost"
                      onClick={() => handleRevoke(String(u._id || u.id || m.user))}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Join Code Section */}
      {canManage && (
        <section className="tmp-section">
          <h3 className="tmp-section-title">🔗 Join Link</h3>
          <p className="tmp-section-desc">Share a link so anyone with a FetchWork account can join your team.</p>
          {joinCodeEnabled && joinCode ? (
            <div className="tmp-join-code-row">
              <code className="tmp-join-code">{`${window.location.origin}/teams/join/${joinCode}`}</code>
              <button className="tmp-btn tmp-btn--secondary" onClick={copyJoinLink}>
                {codeCopied ? '✓ Copied' : 'Copy'}
              </button>
              <button className="tmp-btn tmp-btn--danger-ghost" onClick={handleDisableCode}>Disable</button>
              <button className="tmp-btn tmp-btn--secondary" onClick={handleGenerateCode} disabled={generatingCode}>
                {generatingCode ? '…' : 'Regenerate'}
              </button>
            </div>
          ) : (
            <button className="tmp-btn tmp-btn--primary" onClick={handleGenerateCode} disabled={generatingCode}>
              {generatingCode ? 'Generating…' : 'Generate Join Link'}
            </button>
          )}
        </section>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="tmp-modal-backdrop" onClick={() => setShowInvite(false)}>
          <div className="tmp-modal" onClick={e => e.stopPropagation()}>
            <h3 className="tmp-modal-title">Invite Member</h3>

            {/* Tab bar */}
            <div className="tmp-invite-tabs">
              <button
                className={`tmp-invite-tab ${inviteTab === 'search' ? 'active' : ''}`}
                onClick={() => { setInviteTab('search'); setInviteError(''); setInviteSuccess(''); }}
              >
                🔍 Search Users
              </button>
              <button
                className={`tmp-invite-tab ${inviteTab === 'email' ? 'active' : ''}`}
                onClick={() => { setInviteTab('email'); setInviteError(''); setInviteSuccess(''); }}
              >
                ✉️ By Email
              </button>
            </div>

            <form onSubmit={handleInvite}>
              {inviteTab === 'search' ? (
                <div className="tmp-field">
                  <label className="tmp-label">Search by name or username</label>
                  <input
                    className="tmp-input"
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder="Type a name or username…"
                    autoFocus
                  />
                  {searching && <p className="tmp-search-status">Searching…</p>}
                  {searchResults.length > 0 && (
                    <div className="tmp-search-results">
                      {searchResults.map(u => (
                        <div
                          key={u._id || u.id}
                          className={`tmp-search-item ${selectedUser && (selectedUser._id || selectedUser.id) === (u._id || u.id) ? 'selected' : ''}`}
                          onClick={() => setSelectedUser(u)}
                        >
                          <div className="tmp-member-cell">
                            {u.profileImage ? (
                              <img src={u.profileImage} alt="" className="tmp-avatar tmp-avatar--sm" />
                            ) : (
                              <span className="tmp-avatar tmp-avatar--sm tmp-avatar--placeholder">{memberInitials(u)}</span>
                            )}
                            <div className="tmp-member-info">
                              <span className="tmp-name">{memberName(u)}</span>
                              <span className="tmp-email">{u.username ? `@${u.username}` : u.email || ''}</span>
                            </div>
                          </div>
                          {selectedUser && (selectedUser._id || selectedUser.id) === (u._id || u.id) && (
                            <span className="tmp-check">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                    <p className="tmp-search-status">No users found. Try inviting by email instead.</p>
                  )}
                </div>
              ) : (
                <div className="tmp-field">
                  <label className="tmp-label">Email Address</label>
                  <input
                    className="tmp-input"
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="colleague@example.com"
                    autoFocus
                  />
                </div>
              )}

              <div className="tmp-field">
                <label className="tmp-label">Role</label>
                <select
                  className="tmp-input"
                  value={inviteForm.role}
                  onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="member">Member</option>
                </select>
              </div>
              <div className="tmp-field">
                <label className="tmp-label">Title (optional)</label>
                <input
                  className="tmp-input"
                  type="text"
                  maxLength={100}
                  value={inviteForm.title}
                  onChange={e => setInviteForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Lead Developer"
                />
              </div>
              {inviteError && <p className="tmp-form-error">{inviteError}</p>}
              {inviteSuccess && <p className="tmp-form-success">{inviteSuccess}</p>}
              <div className="tmp-modal-actions">
                <button type="button" className="tmp-btn tmp-btn--secondary" onClick={() => { setShowInvite(false); setInviteError(''); setInviteSuccess(''); setSelectedUser(null); setSearchQuery(''); setSearchResults([]); }}>
                  Cancel
                </button>
                <button type="submit" className="tmp-btn tmp-btn--primary" disabled={inviting || (inviteTab === 'search' && !selectedUser)}>
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove confirm modal */}
      {confirmRemove && (
        <div className="tmp-modal-backdrop" onClick={() => setConfirmRemove(null)}>
          <div className="tmp-modal" onClick={e => e.stopPropagation()}>
            <h3 className="tmp-modal-title">Remove Member</h3>
            <p className="tmp-confirm-text">
              Are you sure you want to remove <strong>{confirmRemove.name}</strong> from the team?
              This action cannot be undone.
            </p>
            <div className="tmp-modal-actions">
              <button className="tmp-btn tmp-btn--secondary" onClick={() => setConfirmRemove(null)}>Cancel</button>
              <button className="tmp-btn tmp-btn--danger" disabled={removing} onClick={() => handleRemove(confirmRemove.userId)}>
                {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
