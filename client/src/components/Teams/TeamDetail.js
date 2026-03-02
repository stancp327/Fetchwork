import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './TeamsPage.css';

const TeamDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('members');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  const fetchTeam = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/teams/${id}`);
      setTeam(data.team);
      setEditForm({ name: data.team.name, description: data.team.description, approvalThreshold: data.team.approvalThreshold });
    } catch (err) {
      console.error('Failed to load team:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const myMember = team?.members?.find(m => (m.user?._id || m.user) === user?._id);
  const isOwnerOrAdmin = myMember && (myMember.role === 'owner' || myMember.role === 'admin');
  const activeMembers = team?.members?.filter(m => m.status === 'active') || [];

  const inviteMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await apiRequest(`/api/teams/${id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setInviteEmail('');
      fetchTeam();
    } catch (err) {
      alert(err.message || 'Failed to invite');
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (userId) => {
    if (!window.confirm('Remove this member from the team?')) return;
    try {
      await apiRequest(`/api/teams/${id}/members/${userId}`, { method: 'DELETE' });
      fetchTeam();
    } catch (err) {
      alert(err.message || 'Failed to remove');
    }
  };

  const updateRole = async (userId, newRole) => {
    try {
      await apiRequest(`/api/teams/${id}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      fetchTeam();
    } catch (err) {
      alert(err.message || 'Failed to update role');
    }
  };

  const saveSettings = async () => {
    try {
      await apiRequest(`/api/teams/${id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      setEditing(false);
      fetchTeam();
    } catch (err) {
      alert(err.message || 'Failed to save');
    }
  };

  const deleteTeam = async () => {
    if (!window.confirm('Delete this team? This cannot be undone.')) return;
    try {
      await apiRequest(`/api/teams/${id}`, { method: 'DELETE' });
      navigate('/teams');
    } catch (err) {
      alert(err.message || 'Failed to delete');
    }
  };

  const roleIcons = { owner: '👑', admin: '⭐', manager: '📋', member: '👤' };
  const roleColors = { owner: '#f59e0b', admin: '#8b5cf6', manager: '#3b82f6', member: '#6b7280' };

  if (loading) return <div className="teams-page"><div className="teams-loading">Loading team…</div></div>;
  if (!team) return <div className="teams-page"><div className="teams-empty"><h3>Team not found</h3></div></div>;

  return (
    <div className="teams-page">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/teams')} style={{ marginBottom: '1rem' }}>← Back to Teams</button>

      {/* Header */}
      <div className="team-detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {team.logo ? (
            <img src={team.logo} alt="" className="team-logo" style={{ width: 64, height: 64 }} />
          ) : (
            <div className="team-logo-placeholder" style={{ width: 64, height: 64, fontSize: '2rem' }}>{team.name[0]}</div>
          )}
          <div>
            <h1 style={{ margin: 0 }}>{team.name}</h1>
            <span className="team-type-badge" style={{ marginTop: '0.25rem', display: 'inline-block' }}>
              {team.type === 'agency' ? '🏢 Agency' : '👥 Client Team'} · {activeMembers.length} members
            </span>
          </div>
        </div>
        {isOwnerOrAdmin && (
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(!editing)}>
            {editing ? 'Cancel' : '⚙️ Settings'}
          </button>
        )}
      </div>

      {team.description && !editing && <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>{team.description}</p>}

      {/* Settings */}
      {editing && isOwnerOrAdmin && (
        <div className="teams-create-form" style={{ marginTop: '1rem' }}>
          <h3>Team Settings</h3>
          <div className="form-group">
            <label>Team Name</label>
            <input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea rows={3} value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Approval Threshold ($) — orders above this need manager approval (0 = no approval)</label>
            <input type="number" min="0" value={editForm.approvalThreshold || 0} onChange={e => setEditForm({ ...editForm, approvalThreshold: Number(e.target.value) })} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary btn-sm" onClick={saveSettings}>Save</button>
            {myMember?.role === 'owner' && (
              <button className="btn btn-danger btn-sm" onClick={deleteTeam}>Delete Team</button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        {['members', 'activity'].map(tab => (
          <button
            key={tab}
            className={`btn btn-ghost btn-sm ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={{ fontWeight: activeTab === tab ? 700 : 400, borderBottom: activeTab === tab ? '2px solid #3b82f6' : 'none' }}
          >
            {tab === 'members' ? `Members (${activeMembers.length})` : 'Activity'}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {activeTab === 'members' && (
        <div style={{ marginTop: '1rem' }}>
          {/* Invite form */}
          {isOwnerOrAdmin && (
            <form onSubmit={inviteMember} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <input
                type="email" required placeholder="Email address"
                value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                style={{ flex: 1, minWidth: '200px', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
              />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                <option value="member">Member</option>
                <option value="manager">Manager</option>
                {myMember?.role === 'owner' && <option value="admin">Admin</option>}
              </select>
              <button type="submit" className="btn btn-primary btn-sm" disabled={inviting}>
                {inviting ? 'Inviting…' : 'Invite'}
              </button>
            </form>
          )}

          {/* Member list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {team.members.filter(m => m.status !== 'removed').map(m => {
              const u = m.user || {};
              return (
                <div key={m._id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', background: roleColors[m.role],
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700
                    }}>
                      {u.profileImage ? <img src={u.profileImage} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (u.firstName?.[0] || '?')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        {roleIcons[m.role]} {m.role}{m.title ? ` · ${m.title}` : ''}
                        {m.status === 'invited' && <span style={{ marginLeft: '0.5rem', color: '#f59e0b' }}>⏳ Pending</span>}
                      </div>
                    </div>
                  </div>
                  {isOwnerOrAdmin && m.role !== 'owner' && m.status === 'active' && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select
                        value={m.role}
                        onChange={e => updateRole(u._id, e.target.value)}
                        style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.8rem' }}
                      >
                        <option value="member">Member</option>
                        <option value="manager">Manager</option>
                        {myMember?.role === 'owner' && <option value="admin">Admin</option>}
                      </select>
                      <button onClick={() => removeMember(u._id)} className="btn btn-danger btn-sm" style={{ fontSize: '0.75rem' }}>Remove</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity tab placeholder */}
      {activeTab === 'activity' && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          <p>Team activity feed coming soon</p>
        </div>
      )}
    </div>
  );
};

export default TeamDetail;
