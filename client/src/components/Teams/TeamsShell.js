import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import TeamNav from './TeamNav';
import TeamDashboard from './TeamDashboard';
import TeamMembersPanel from './TeamMembersPanel';
import TeamChannels from './TeamChannels';
import TeamMilestones from './TeamMilestones';
import PresentationBuilder from './PresentationBuilder';
import TeamSettings from './TeamSettings';
import './TeamsShell.css';

export default function TeamsShell() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Create-team form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', type: 'client_team', description: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Join-team form
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest('/api/teams');
      const list = data?.teams || [];
      setTeams(list);
      if (!activeTeamId && list.length) setActiveTeamId(list[0]._id);
    } catch (err) {
      setError(err.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, [activeTeamId]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const activeTeam = teams.find(t => t._id === activeTeamId) || null;
  const activeMembers = activeTeam?.members?.filter(m => m.status === 'active') || [];

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim() || creating) return;
    setCreateError('');
    setCreating(true);
    try {
      const data = await apiRequest('/api/teams', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      const newTeam = data?.team;
      if (newTeam) {
        setTeams(prev => [newTeam, ...prev]);
        setActiveTeamId(newTeam._id);
        setShowCreate(false);
        setCreateForm({ name: '', type: 'client_team', description: '' });
      }
    } catch (err) {
      setCreateError(err.message || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim() || joining) return;
    setJoinError('');
    setJoining(true);
    try {
      await apiRequest('/api/teams/join', {
        method: 'POST',
        body: JSON.stringify({ code: joinCode.trim() }),
      });
      setShowJoin(false);
      setJoinCode('');
      await fetchTeams();
    } catch (err) {
      setJoinError(err.message || 'Failed to join team');
    } finally {
      setJoining(false);
    }
  };

  const handleTeamUpdated = useCallback((updated) => {
    setTeams(prev => prev.map(t => t._id === updated._id ? updated : t));
  }, []);

  const handleTeamDeleted = useCallback((deletedId) => {
    setTeams(prev => prev.filter(t => t._id !== deletedId));
    setActiveTeamId(prev => prev === deletedId ? null : prev);
    setActiveTab('dashboard');
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="tsh-loading">
        <div className="loading-spinner"></div>
        <p>Loading teams…</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="tsh-error">
        <p>{error}</p>
        <button className="tsh-btn tsh-btn--primary" onClick={fetchTeams}>Retry</button>
      </div>
    );
  }

  // Empty state — no teams
  if (!teams.length) {
    return (
      <div className="tsh-empty">
        <div className="tsh-empty-icon">👥</div>
        <h2 className="tsh-empty-title">Welcome to Teams</h2>
        <p className="tsh-empty-desc">
          Teams let you collaborate, share billing, and manage work together.
        </p>
        <div className="tsh-empty-actions">
          <button className="tsh-btn tsh-btn--primary" onClick={() => setShowCreate(true)}>
            Create your team
          </button>
          <button className="tsh-btn tsh-btn--secondary" onClick={() => setShowJoin(true)}>
            Join a team
          </button>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="tsh-modal-backdrop" onClick={() => setShowCreate(false)}>
            <div className="tsh-modal" onClick={e => e.stopPropagation()}>
              <h3 className="tsh-modal-title">Create a Team</h3>
              <form onSubmit={handleCreate}>
                <div className="tsh-field">
                  <label className="tsh-label">Team Name</label>
                  <input
                    className="tsh-input"
                    type="text"
                    maxLength={100}
                    required
                    value={createForm.name}
                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Acme Design Studio"
                  />
                </div>
                <div className="tsh-field">
                  <label className="tsh-label">Type</label>
                  <select
                    className="tsh-input"
                    value={createForm.type}
                    onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))}
                  >
                    <option value="client_team">Client Team</option>
                    <option value="agency">Freelancer Agency</option>
                  </select>
                </div>
                <div className="tsh-field">
                  <label className="tsh-label">Description (optional)</label>
                  <textarea
                    className="tsh-input"
                    maxLength={1000}
                    rows={3}
                    value={createForm.description}
                    onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="What does your team do?"
                  />
                </div>
                {createError && <p className="tsh-form-error">{createError}</p>}
                <div className="tsh-modal-actions">
                  <button type="button" className="tsh-btn tsh-btn--secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="tsh-btn tsh-btn--primary" disabled={creating}>
                    {creating ? 'Creating…' : 'Create Team'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Join modal */}
        {showJoin && (
          <div className="tsh-modal-backdrop" onClick={() => setShowJoin(false)}>
            <div className="tsh-modal" onClick={e => e.stopPropagation()}>
              <h3 className="tsh-modal-title">Join a Team</h3>
              <form onSubmit={handleJoin}>
                <div className="tsh-field">
                  <label className="tsh-label">Invite Code or Team ID</label>
                  <input
                    className="tsh-input"
                    type="text"
                    required
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    placeholder="Paste your invite code"
                  />
                </div>
                {joinError && <p className="tsh-form-error">{joinError}</p>}
                <div className="tsh-modal-actions">
                  <button type="button" className="tsh-btn tsh-btn--secondary" onClick={() => setShowJoin(false)}>Cancel</button>
                  <button type="submit" className="tsh-btn tsh-btn--primary" disabled={joining}>
                    {joining ? 'Joining…' : 'Join Team'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main shell — sidebar + content
  return (
    <div className="tsh-shell">
      {/* Sidebar */}
      <aside className="tsh-sidebar">
        <div className="tsh-sidebar-header">
          <span className="tsh-sidebar-title">Your Teams</span>
          <button className="tsh-sidebar-add" onClick={() => setShowCreate(true)} title="Create team">+</button>
        </div>
        <ul className="tsh-team-list">
          {teams.map(team => (
            <li key={team._id}>
              <button
                className={`tsh-team-item${team._id === activeTeamId ? ' tsh-team-item--active' : ''}`}
                onClick={() => { setActiveTeamId(team._id); setActiveTab('dashboard'); }}
              >
                {team.logo ? (
                  <img src={team.logo} alt="" className="tsh-team-avatar" />
                ) : (
                  <span className="tsh-team-avatar tsh-team-avatar--placeholder">
                    {team.name?.[0]?.toUpperCase() || '?'}
                  </span>
                )}
                <span className="tsh-team-name">{team.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main content */}
      <div className="tsh-main">
        {activeTeam && (
          <>
            <TeamNav activeTab={activeTab} setActiveTab={setActiveTab} />
            <div className="tsh-content">
              {activeTab === 'dashboard' && (
                <TeamDashboard teamId={activeTeam._id} team={activeTeam} />
              )}
              {activeTab === 'members' && (
                <TeamMembersPanel
                  teamId={activeTeam._id}
                  team={activeTeam}
                  onTeamUpdated={handleTeamUpdated}
                />
              )}
              {activeTab === 'channels' && (
                <TeamChannels teamId={activeTeam._id} teamMembers={activeMembers} />
              )}
              {activeTab === 'milestones' && (
                <TeamMilestones teamId={activeTeam._id} members={activeMembers} />
              )}
              {activeTab === 'presentations' && (
                <PresentationBuilder teamId={activeTeam._id} />
              )}
              {activeTab === 'wallet' && (
                <div className="tsh-placeholder">
                  <h3>Team Wallet</h3>
                  <p>Wallet management coming soon.</p>
                </div>
              )}
              {activeTab === 'settings' && (
                <TeamSettings
                  teamId={activeTeam._id}
                  team={activeTeam}
                  onTeamUpdated={handleTeamUpdated}
                  onTeamDeleted={handleTeamDeleted}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Create modal (when sidebar add button clicked) */}
      {showCreate && teams.length > 0 && (
        <div className="tsh-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="tsh-modal" onClick={e => e.stopPropagation()}>
            <h3 className="tsh-modal-title">Create a Team</h3>
            <form onSubmit={handleCreate}>
              <div className="tsh-field">
                <label className="tsh-label">Team Name</label>
                <input
                  className="tsh-input"
                  type="text"
                  maxLength={100}
                  required
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Acme Design Studio"
                />
              </div>
              <div className="tsh-field">
                <label className="tsh-label">Type</label>
                <select
                  className="tsh-input"
                  value={createForm.type}
                  onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="client_team">Client Team</option>
                  <option value="agency">Freelancer Agency</option>
                </select>
              </div>
              <div className="tsh-field">
                <label className="tsh-label">Description (optional)</label>
                <textarea
                  className="tsh-input"
                  maxLength={1000}
                  rows={3}
                  value={createForm.description}
                  onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What does your team do?"
                />
              </div>
              {createError && <p className="tsh-form-error">{createError}</p>}
              <div className="tsh-modal-actions">
                <button type="button" className="tsh-btn tsh-btn--secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="tsh-btn tsh-btn--primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
