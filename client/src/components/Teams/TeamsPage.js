import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './TeamsPage.css';

const TeamsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', type: 'client_team', description: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deletingTeamId, setDeletingTeamId] = useState('');
  const [loadError, setLoadError] = useState('');

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');

      const [teamsResult, invitesResult] = await Promise.allSettled([
        apiRequest('/api/teams'),
        apiRequest('/api/teams/invitations/pending'),
      ]);

      if (teamsResult.status === 'fulfilled') {
        setTeams(teamsResult.value?.teams || []);
      } else {
        setTeams([]);
        setLoadError(teamsResult.reason?.message || 'Failed to load teams');
      }

      if (invitesResult.status === 'fulfilled') {
        setInvitations(invitesResult.value?.invitations || []);
      } else {
        setInvitations([]);
      }
    } catch (err) {
      console.error('Failed to load teams:', err);
      setLoadError(err?.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const createTeam = async (e) => {
    e.preventDefault();
    if (!newTeam.name.trim()) return;
    setCreateError('');
    setCreating(true);
    try {
      const data = await apiRequest('/api/teams', {
        method: 'POST',
        body: JSON.stringify(newTeam),
      });

      const teamId = data?.team?._id;
      if (!teamId) {
        throw new Error('Team created, but no team ID was returned. Please refresh and open from your Teams list.');
      }

      navigate(`/teams/${teamId}`);
    } catch (err) {
      setCreateError(err.message || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const acceptInvite = async (teamId) => {
    try {
      await apiRequest(`/api/teams/${teamId}/accept`, { method: 'POST' });
      fetchTeams();
    } catch (err) {
      alert(err.message || 'Failed to accept');
    }
  };

  const declineInvite = async (teamId) => {
    try {
      await apiRequest(`/api/teams/${teamId}/decline`, { method: 'POST' });
      fetchTeams();
    } catch (err) {
      alert(err.message || 'Failed to decline');
    }
  };

  const deleteTeamFromList = async (teamId) => {
    if (!window.confirm('Delete this team? This cannot be undone.')) return;
    setDeletingTeamId(teamId);
    try {
      await apiRequest(`/api/teams/${teamId}`, { method: 'DELETE' });
      await fetchTeams();
    } catch (err) {
      alert(err.message || 'Failed to delete team');
    } finally {
      setDeletingTeamId('');
    }
  };

  const roleIcons = { owner: '👑', admin: '⭐', manager: '📋', member: '👤' };

  return (
    <div className="teams-page">
      <div className="teams-header">
        <div>
          <h1>Teams</h1>
          <p className="teams-subtitle">Manage your teams and agency accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ Create Team'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form className="teams-create-form" onSubmit={createTeam}>
          <h3>Create a New Team</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Team Name</label>
              <input
                type="text" maxLength={100} required
                value={newTeam.name} onChange={e => setNewTeam({ ...newTeam, name: e.target.value })}
                placeholder="e.g. Acme Design Studio"
              />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={newTeam.type} onChange={e => setNewTeam({ ...newTeam, type: e.target.value })}>
                <option value="client_team">Client Team</option>
                <option value="agency">Freelancer Agency</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <textarea
              maxLength={1000} rows={3}
              value={newTeam.description} onChange={e => setNewTeam({ ...newTeam, description: e.target.value })}
              placeholder="What does your team do?"
            />
          </div>
          {createError && <p style={{ color: '#dc2626', marginTop: '0.25rem' }}>{createError}</p>}
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create Team'}
          </button>
        </form>
      )}

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="teams-invitations">
          <h2>Pending Invitations</h2>
          {invitations.map(inv => (
            <div key={inv._id} className="invitation-card">
              <div className="invitation-info">
                <h4>{inv.name}</h4>
                <p>Invited by {inv.owner?.firstName} {inv.owner?.lastName}</p>
                <span className="team-type-badge">{inv.type === 'agency' ? '🏢 Agency' : '👥 Client Team'}</span>
              </div>
              <div className="invitation-actions">
                <button className="btn btn-primary btn-sm" onClick={() => acceptInvite(inv._id)}>Accept</button>
                <button className="btn btn-ghost btn-sm" onClick={() => declineInvite(inv._id)}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Teams list */}
      {loading ? (
        <div className="teams-loading">Loading teams…</div>
      ) : loadError ? (
        <div className="teams-empty">
          <h3>Couldn’t load teams</h3>
          <p style={{ marginBottom: '0.75rem' }}>{loadError}</p>
          <button className="btn btn-primary btn-sm" onClick={fetchTeams}>Retry</button>
        </div>
      ) : teams.length === 0 ? (
        <div className="teams-empty">
          <h3>No teams yet</h3>
          <p>Create a team to collaborate with others, share billing, and manage work together.</p>
        </div>
      ) : (
        <div className="teams-grid">
          {teams.map(team => {
            const currentUserId = String(user?._id || user?.id || '');
            const myMember = team.members?.find((m) => {
              const memberUserId = m.user?._id || m.user?.id || m.user;
              return String(memberUserId) === currentUserId;
            });
            const activeMembers = team.members?.filter(m => m.status === 'active') || [];
            const ownerId = String(team.owner?._id || team.owner?.id || team.owner || '');
            const myRole = team.currentUserRole || myMember?.role || (ownerId === currentUserId ? 'owner' : null);
            const isOwner = Boolean(team.currentUserIsOwner || myRole === 'owner' || ownerId === currentUserId);
            return (
              <Link to={`/teams/${team._id}`} key={team._id} className="team-card">
                <div className="team-card-header">
                  {team.logo ? (
                    <img src={team.logo} alt="" className="team-logo" />
                  ) : (
                    <div className="team-logo-placeholder">{team.name[0]}</div>
                  )}
                  <div>
                    <h3>{team.name}</h3>
                    <span className="team-type-badge">{team.type === 'agency' ? '🏢 Agency' : '👥 Team'}</span>
                  </div>
                </div>
                {team.description && <p className="team-description">{team.description}</p>}
                <div className="team-card-footer">
                  <span className="team-members-count">{activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''}</span>
                  {myRole && <span className="team-my-role">{roleIcons[myRole]} {myRole}</span>}
                </div>
                {isOwner && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={deletingTeamId === team._id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteTeamFromList(team._id);
                      }}
                    >
                      {deletingTeamId === team._id ? 'Deleting…' : 'Delete Team'}
                    </button>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeamsPage;
