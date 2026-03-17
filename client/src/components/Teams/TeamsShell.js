import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import TeamNav from './TeamNav';
import TeamJobs from './TeamJobs';
import TeamDashboard from './TeamDashboard';
import TeamMembersPanel from './TeamMembersPanel';
import TeamChannels from './TeamChannels';
import TeamMilestones from './TeamMilestones';
import PresentationBuilder from './PresentationBuilder';
import TeamSettings from './TeamSettings';
import TeamWallet from './TeamWallet';
import TeamActivityFeed from './TeamActivityFeed';
import TeamAnalytics from './TeamAnalytics';
import TeamNotes from './TeamNotes';
import TeamHiringPipeline from './TeamHiringPipeline';
import TeamApprovalQueue from './TeamApprovalQueue';
import OrgHierarchy from './OrgHierarchy';
import TeamContracts from './TeamContracts';
import './TeamsShell.css';

export default function TeamsShell() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Create-team form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', type: 'client_team', description: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Use ref to avoid re-creating fetchTeams when activeTeamId changes
  const activeTeamIdRef = useRef(activeTeamId);
  activeTeamIdRef.current = activeTeamId;

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest('/api/teams');
      const list = data?.teams || [];
      setTeams(list);
      if (!activeTeamIdRef.current && list.length) setActiveTeamId(list[0]._id);
    } catch (err) {
      setError(err.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleTeamUpdated = useCallback((updated) => {
    setTeams(prev => prev.map(t => t._id === updated._id ? updated : t));
  }, []);

  const handleTeamDeleted = useCallback((deletedId) => {
    setTeams(prev => prev.filter(t => t._id !== deletedId));
    setActiveTeamId(prev => prev === deletedId ? null : prev);
    setActiveTab('dashboard');
  }, []);

  // Quick action helpers — passed to dashboard
  const navigateToTab = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="tsh-loading">
        <div className="tsh-loading-skeleton">
          <div className="tsh-skeleton-sidebar">
            <div className="tsh-skeleton-bar" />
            <div className="tsh-skeleton-bar" />
            <div className="tsh-skeleton-bar" />
          </div>
          <div className="tsh-skeleton-main">
            <div className="tsh-skeleton-bar tsh-skeleton-bar--wide" />
            <div className="tsh-skeleton-bar tsh-skeleton-bar--wide" />
          </div>
        </div>
        <p className="tsh-loading-text">Loading teams...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="tsh-error">
        <div className="tsh-error-icon">!</div>
        <h3 className="tsh-error-title">Something went wrong</h3>
        <p className="tsh-error-msg">{error}</p>
        <button className="tsh-btn tsh-btn--primary" onClick={fetchTeams}>Try Again</button>
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
        </div>

        {/* Create modal */}
        {showCreate && (
          <CreateTeamModal
            createForm={createForm}
            setCreateForm={setCreateForm}
            createError={createError}
            creating={creating}
            onSubmit={handleCreate}
            onClose={() => setShowCreate(false)}
          />
        )}
      </div>
    );
  }

  // Main shell — sidebar + content
  return (
    <div className="tsh-shell">
      {/* Mobile hamburger */}
      <button
        className="tsh-hamburger"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Toggle sidebar"
      >
        <span className="tsh-hamburger-line" />
        <span className="tsh-hamburger-line" />
        <span className="tsh-hamburger-line" />
      </button>

      {/* Sidebar */}
      <aside className={`tsh-sidebar${sidebarOpen ? ' tsh-sidebar--open' : ''}`}>
        <div className="tsh-sidebar-header">
          <span className="tsh-sidebar-title">Your Teams</span>
          <button className="tsh-sidebar-add" onClick={() => setShowCreate(true)} title="Create team">+</button>
        </div>
        <ul className="tsh-team-list">
          {teams.map(team => (
            <li key={team._id}>
              <button
                className={`tsh-team-item${team._id === activeTeamId ? ' tsh-team-item--active' : ''}`}
                onClick={() => { setActiveTeamId(team._id); setActiveTab('dashboard'); setSidebarOpen(false); }}
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

      {/* Sidebar backdrop for mobile */}
      {sidebarOpen && <div className="tsh-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="tsh-main">
        {activeTeam && (
          <>
            <TeamNav activeTab={activeTab} setActiveTab={setActiveTab} />
            <div className="tsh-content">
              {activeTab === 'jobs' && activeTeamId && (
          <TeamJobs teamId={activeTeamId} teamMembers={activeTeam?.members || []} />
        )}
        {activeTab === 'dashboard' && (
                <TeamDashboard
                  teamId={activeTeam._id}
                  team={activeTeam}
                  onNavigateTab={navigateToTab}
                />
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
                <TeamWallet
                  teamId={activeTeam._id}
                  canManageBilling={activeTeam.currentUserRole === 'owner' || activeTeam.currentUserRole === 'admin'}
                />
              )}
              {activeTab === 'activity' && (
                <TeamActivityFeed teamId={activeTeam._id} />
              )}
              {activeTab === 'analytics' && (
                <TeamAnalytics teamId={activeTeam._id} />
              )}
              {activeTab === 'notes' && (
                <TeamNotes teamId={activeTeam._id} />
              )}
              {activeTab === 'pipeline' && (
                <TeamHiringPipeline teamId={activeTeam._id} />
              )}
              {activeTab === 'approvals' && (
                <TeamApprovalQueue teamId={activeTeam._id} />
              )}
              {activeTab === 'organization' && (
                <OrgHierarchy />
              )}
              {activeTab === 'contracts' && (
                <TeamContracts teamId={activeTeam._id} />
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
      {showCreate && (
        <CreateTeamModal
          createForm={createForm}
          setCreateForm={setCreateForm}
          createError={createError}
          creating={creating}
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

// Extracted to avoid duplicate modal JSX
function CreateTeamModal({ createForm, setCreateForm, createError, creating, onSubmit, onClose }) {
  return (
    <div className="tsh-modal-backdrop" onClick={onClose}>
      <div className="tsh-modal" onClick={e => e.stopPropagation()}>
        <h3 className="tsh-modal-title">Create a Team</h3>
        <form onSubmit={onSubmit}>
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
            <button type="button" className="tsh-btn tsh-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="tsh-btn tsh-btn--primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
