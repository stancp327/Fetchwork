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
  const [loadError, setLoadError] = useState('');

  // Organization state
  const [orgs, setOrgs] = useState([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [selectedOrgTeams, setSelectedOrgTeams] = useState([]);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [createOrgForm, setCreateOrgForm] = useState({ name: '', description: '' });
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [createOrgError, setCreateOrgError] = useState('');
  const [orgSettingsForm, setOrgSettingsForm] = useState(null);
  const [savingOrgSettings, setSavingOrgSettings] = useState(false);
  const [editingOrgName, setEditingOrgName] = useState(false);
  const [editOrgNameValue, setEditOrgNameValue] = useState('');
  const [editOrgDescValue, setEditOrgDescValue] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [addTeamToOrgId, setAddTeamToOrgId] = useState('');

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

  const fetchOrgs = useCallback(async () => {
    try {
      setOrgsLoading(true);
      const data = await apiRequest('/api/organizations/mine');
      setOrgs(data?.organizations || []);
    } catch (err) {
      console.error('Failed to load organizations:', err);
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeams(); fetchOrgs(); }, [fetchTeams, fetchOrgs]);

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

  // ── Organization actions ──

  const createOrg = async (e) => {
    e.preventDefault();
    if (!createOrgForm.name.trim()) return;
    setCreateOrgError('');
    setCreatingOrg(true);
    try {
      const data = await apiRequest('/api/organizations', {
        method: 'POST',
        body: JSON.stringify(createOrgForm),
      });
      if (data?.organization) {
        setOrgs(prev => [...prev, { ...data.organization, teams: [] }]);
        setShowCreateOrg(false);
        setCreateOrgForm({ name: '', description: '' });
      }
    } catch (err) {
      setCreateOrgError(err.message || 'Failed to create organization');
    } finally {
      setCreatingOrg(false);
    }
  };

  const openOrgDetail = async (org) => {
    try {
      const data = await apiRequest(`/api/organizations/${org._id}`);
      const orgData = data?.organization || org;
      setSelectedOrg(orgData);
      setSelectedOrgTeams(data?.teams || []);
      setEditOrgNameValue(orgData.name);
      setEditOrgDescValue(orgData.description || '');
      setOrgSettingsForm({
        spendControls: { ...orgData.settings?.spendControls },
        approvalThresholds: { ...orgData.settings?.approvalThresholds },
      });
      setEditingOrgName(false);
      setNewDeptName('');
      setAddTeamToOrgId('');
    } catch (err) {
      alert(err.message || 'Failed to load organization');
    }
  };

  const saveOrgName = async () => {
    if (!editOrgNameValue.trim() || !selectedOrg) return;
    try {
      const data = await apiRequest(`/api/organizations/${selectedOrg._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editOrgNameValue, description: editOrgDescValue }),
      });
      const updated = data?.organization || selectedOrg;
      setSelectedOrg(updated);
      setOrgs(prev => prev.map(o => o._id === updated._id ? { ...o, name: updated.name, slug: updated.slug, description: updated.description } : o));
      setEditingOrgName(false);
    } catch (err) {
      alert(err.message || 'Failed to update');
    }
  };

  const addDepartment = async () => {
    if (!newDeptName.trim() || !selectedOrg) return;
    try {
      const data = await apiRequest(`/api/organizations/${selectedOrg._id}/departments`, {
        method: 'POST',
        body: JSON.stringify({ name: newDeptName }),
      });
      setSelectedOrg(prev => ({ ...prev, departments: data?.departments || prev.departments }));
      setNewDeptName('');
    } catch (err) {
      alert(err.message || 'Failed to add department');
    }
  };

  const removeDepartment = async (deptId) => {
    if (!selectedOrg) return;
    try {
      const data = await apiRequest(`/api/organizations/${selectedOrg._id}/departments/${deptId}`, {
        method: 'DELETE',
      });
      setSelectedOrg(prev => ({ ...prev, departments: data?.departments || prev.departments }));
    } catch (err) {
      alert(err.message || 'Failed to remove department');
    }
  };

  const addTeamToOrg = async () => {
    if (!addTeamToOrgId || !selectedOrg) return;
    try {
      await apiRequest(`/api/organizations/${selectedOrg._id}/teams`, {
        method: 'POST',
        body: JSON.stringify({ teamId: addTeamToOrgId }),
      });
      setAddTeamToOrgId('');
      await openOrgDetail(selectedOrg);
      fetchOrgs();
    } catch (err) {
      alert(err.message || 'Failed to add team');
    }
  };

  const removeTeamFromOrg = async (teamId) => {
    if (!selectedOrg) return;
    try {
      await apiRequest(`/api/organizations/${selectedOrg._id}/teams/${teamId}`, {
        method: 'DELETE',
      });
      await openOrgDetail(selectedOrg);
      fetchOrgs();
    } catch (err) {
      alert(err.message || 'Failed to remove team');
    }
  };

  const saveOrgSettings = async () => {
    if (!selectedOrg || !orgSettingsForm) return;
    setSavingOrgSettings(true);
    try {
      const data = await apiRequest(`/api/organizations/${selectedOrg._id}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(orgSettingsForm),
      });
      setSelectedOrg(prev => ({ ...prev, settings: data?.settings || prev.settings }));
    } catch (err) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setSavingOrgSettings(false);
    }
  };

  const deleteOrg = async () => {
    if (!selectedOrg) return;
    if (!window.confirm(`Delete organization "${selectedOrg.name}"? Teams will be unlinked but not deleted.`)) return;
    try {
      await apiRequest(`/api/organizations/${selectedOrg._id}`, { method: 'DELETE' });
      setOrgs(prev => prev.filter(o => o._id !== selectedOrg._id));
      setSelectedOrg(null);
    } catch (err) {
      alert(err.message || 'Failed to delete');
    }
  };

  const roleIcons = { owner: '\u{1F451}', admin: '\u2B50', manager: '\u{1F4CB}', member: '\u{1F464}' };
  const currentUserId = String(user?._id || user?.id || '');

  // Teams not in any org (for the "add to org" dropdown)
  const orgTeamIds = new Set(selectedOrgTeams.map(t => String(t._id)));
  const availableTeams = teams.filter(t => {
    const ownerId = String(t.owner?._id || t.owner?.id || t.owner || '');
    return ownerId === currentUserId && !orgTeamIds.has(String(t._id));
  });

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
            {creating ? 'Creating\u2026' : 'Create Team'}
          </button>
        </form>
      )}

      {invitations.length > 0 && (
        <div className="teams-invitations">
          <h2>Pending Invitations</h2>
          {invitations.map(inv => (
            <div key={inv._id} className="invitation-card">
              <div className="invitation-info">
                <h4>{inv.name}</h4>
                <p>Invited by {inv.owner?.firstName} {inv.owner?.lastName}</p>
                <span className="team-type-badge">{inv.type === 'agency' ? '\u{1F3E2} Agency' : '\u{1F465} Client Team'}</span>
              </div>
              <div className="invitation-actions">
                <button className="btn btn-primary btn-sm" onClick={() => acceptInvite(inv._id)}>Accept</button>
                <button className="btn btn-ghost btn-sm" onClick={() => declineInvite(inv._id)}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="teams-loading">Loading teams\u2026</div>
      ) : loadError ? (
        <div className="teams-empty">
          <h3>Couldn't load teams</h3>
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
            const myMember = team.members?.find((m) => {
              const memberUserId = m.user?._id || m.user?.id || m.user;
              return String(memberUserId) === currentUserId;
            });
            const activeMembers = team.members?.filter(m => m.status === 'active') || [];
            const ownerId = String(team.owner?._id || team.owner?.id || team.owner || '');
            const myRole = team.currentUserRole || myMember?.role || (ownerId === currentUserId ? 'owner' : null);

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
                    <span className="team-type-badge">{team.type === 'agency' ? '\u{1F3E2} Agency' : '\u{1F465} Team'}</span>
                  </div>
                </div>
                {team.description && <p className="team-description">{team.description}</p>}
                <div className="team-card-footer">
                  <span className="team-members-count">{activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''}</span>
                  {myRole && <span className="team-my-role">{roleIcons[myRole]} {myRole}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Organizations Section ── */}
      <div className="orgs-section">
        <div className="teams-header">
          <div>
            <h2>Organizations</h2>
            <p className="teams-subtitle">Group teams under an organization for shared settings</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateOrg(!showCreateOrg)}>
            {showCreateOrg ? 'Cancel' : '+ Create Organization'}
          </button>
        </div>

        {showCreateOrg && (
          <form className="create-org-form" onSubmit={createOrg}>
            <h3>Create Organization</h3>
            <div className="form-group">
              <label>Organization Name</label>
              <input
                type="text" maxLength={100} required
                value={createOrgForm.name}
                onChange={e => setCreateOrgForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                maxLength={1000} rows={2}
                value={createOrgForm.description}
                onChange={e => setCreateOrgForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What is this organization for?"
              />
            </div>
            {createOrgError && <p style={{ color: '#dc2626', marginTop: '0.25rem' }}>{createOrgError}</p>}
            <button type="submit" className="btn btn-primary" disabled={creatingOrg}>
              {creatingOrg ? 'Creating\u2026' : 'Create Organization'}
            </button>
          </form>
        )}

        {orgsLoading ? (
          <div className="teams-loading">Loading organizations\u2026</div>
        ) : selectedOrg ? (
          /* ── Org Detail Panel ── */
          <div className="org-detail-panel">
            <div className="org-detail-header">
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingOrgName ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <input
                      type="text" maxLength={100} value={editOrgNameValue}
                      onChange={e => setEditOrgNameValue(e.target.value)}
                      style={{ fontWeight: 700, fontSize: '1.1rem' }}
                    />
                    <textarea
                      maxLength={1000} rows={2} value={editOrgDescValue}
                      onChange={e => setEditOrgDescValue(e.target.value)}
                      placeholder="Description"
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-primary btn-sm" type="button" onClick={saveOrgName}>Save</button>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditingOrgName(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 style={{ margin: 0 }}>{selectedOrg.name}</h3>
                    <span className="org-slug">@{selectedOrg.slug}</span>
                    {selectedOrg.description && <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>{selectedOrg.description}</p>}
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                {!editingOrgName && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingOrgName(true)}>Edit</button>
                )}
                <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={deleteOrg}>Delete</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrg(null)}>Close</button>
              </div>
            </div>

            {/* Departments */}
            <div style={{ marginTop: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.5rem' }}>Departments</h4>
              {selectedOrg.departments?.length > 0 ? (
                <div className="org-departments-list">
                  {selectedOrg.departments.map(dept => (
                    <div key={dept._id} className="org-department-row">
                      <span style={{ fontWeight: 600 }}>{dept.name}</span>
                      {dept.description && <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{dept.description}</span>}
                      <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626', marginLeft: 'auto' }} onClick={() => removeDepartment(dept._id)}>Remove</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No departments yet</p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input
                  type="text" maxLength={100} placeholder="Department name"
                  value={newDeptName} onChange={e => setNewDeptName(e.target.value)}
                  style={{ flex: 1, minHeight: '36px', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
                <button className="btn btn-primary btn-sm" type="button" onClick={addDepartment} disabled={!newDeptName.trim()}>Add</button>
              </div>
            </div>

            {/* Teams in Org */}
            <div style={{ marginTop: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.5rem' }}>Teams in Organization</h4>
              {selectedOrgTeams.length > 0 ? (
                <div className="org-departments-list">
                  {selectedOrgTeams.map(t => (
                    <div key={t._id} className="org-department-row">
                      <Link to={`/teams/${t._id}`} style={{ fontWeight: 600, color: '#3b82f6' }}>{t.name}</Link>
                      <span className="team-type-badge" style={{ fontSize: '0.7rem' }}>{t.type === 'agency' ? 'Agency' : 'Team'}</span>
                      <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{t.memberCount} member{t.memberCount !== 1 ? 's' : ''}</span>
                      {t.department && <span className="team-type-badge">{t.department}</span>}
                      <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626', marginLeft: 'auto' }} onClick={() => removeTeamFromOrg(t._id)}>Remove</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No teams in this organization</p>
              )}
              {availableTeams.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <select
                    value={addTeamToOrgId}
                    onChange={e => setAddTeamToOrgId(e.target.value)}
                    style={{ flex: 1, minHeight: '36px', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  >
                    <option value="">Select a team to add...</option>
                    {availableTeams.map(t => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary btn-sm" type="button" onClick={addTeamToOrg} disabled={!addTeamToOrgId}>Add</button>
                </div>
              )}
            </div>

            {/* Org Settings */}
            {orgSettingsForm && (
              <div className="org-settings-section">
                <h4 style={{ margin: '0 0 0.5rem' }}>Organization Settings</h4>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
                  These settings cascade to all teams that have "Inherit org settings" enabled.
                </p>
                <div className="team-controls-form">
                  <div className="team-controls-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={orgSettingsForm.spendControls?.monthlyCapEnabled || false}
                        onChange={e => setOrgSettingsForm(prev => ({
                          ...prev,
                          spendControls: { ...prev.spendControls, monthlyCapEnabled: e.target.checked },
                        }))}
                      />
                      Enable monthly spending cap
                    </label>
                  </div>
                  {orgSettingsForm.spendControls?.monthlyCapEnabled && (
                    <>
                      <div className="team-controls-row">
                        <label>Monthly cap ($)</label>
                        <input
                          type="number" min={0} step="0.01"
                          value={orgSettingsForm.spendControls?.monthlyCap || 0}
                          onChange={e => setOrgSettingsForm(prev => ({
                            ...prev,
                            spendControls: { ...prev.spendControls, monthlyCap: Number(e.target.value) },
                          }))}
                        />
                      </div>
                      <div className="team-controls-row">
                        <label>Alert threshold (0-1)</label>
                        <input
                          type="number" min={0} max={1} step="0.05"
                          value={orgSettingsForm.spendControls?.alertThreshold ?? 0.8}
                          onChange={e => setOrgSettingsForm(prev => ({
                            ...prev,
                            spendControls: { ...prev.spendControls, alertThreshold: Number(e.target.value) },
                          }))}
                        />
                      </div>
                    </>
                  )}
                  <div className="team-controls-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={orgSettingsForm.approvalThresholds?.payoutRequiresApproval || false}
                        onChange={e => setOrgSettingsForm(prev => ({
                          ...prev,
                          approvalThresholds: { ...prev.approvalThresholds, payoutRequiresApproval: e.target.checked },
                        }))}
                      />
                      Payouts require approval
                    </label>
                  </div>
                  {orgSettingsForm.approvalThresholds?.payoutRequiresApproval && (
                    <>
                      <div className="team-controls-row">
                        <label>Payout threshold ($)</label>
                        <input
                          type="number" min={0} step="0.01"
                          value={orgSettingsForm.approvalThresholds?.payoutThresholdAmount || 0}
                          onChange={e => setOrgSettingsForm(prev => ({
                            ...prev,
                            approvalThresholds: { ...prev.approvalThresholds, payoutThresholdAmount: Number(e.target.value) },
                          }))}
                        />
                      </div>
                      <div className="team-controls-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={orgSettingsForm.approvalThresholds?.requireDualControl || false}
                            onChange={e => setOrgSettingsForm(prev => ({
                              ...prev,
                              approvalThresholds: { ...prev.approvalThresholds, requireDualControl: e.target.checked },
                            }))}
                          />
                          Require dual control
                        </label>
                      </div>
                    </>
                  )}
                  <button className="btn btn-primary" onClick={saveOrgSettings} disabled={savingOrgSettings}>
                    {savingOrgSettings ? 'Saving\u2026' : 'Save Settings'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : orgs.length === 0 ? (
          !showCreateOrg && (
            <div className="teams-empty" style={{ paddingTop: '1.5rem' }}>
              <p>No organizations yet. Create one to group teams and share settings.</p>
            </div>
          )
        ) : (
          <div className="teams-grid">
            {orgs.map(org => {
              const teamCount = org.teams?.length || 0;
              const hasSettings = org.settings?.spendControls?.monthlyCapEnabled || org.settings?.approvalThresholds?.payoutRequiresApproval;
              return (
                <div key={org._id} className="org-card" onClick={() => openOrgDetail(org)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && openOrgDetail(org)}>
                  <div className="team-card-header">
                    <div className="team-logo-placeholder" style={{ background: '#8b5cf6' }}>{org.name[0]}</div>
                    <div>
                      <h3>{org.name}</h3>
                      <span className="org-slug">@{org.slug}</span>
                    </div>
                  </div>
                  <div className="org-card-meta">
                    <span className="team-type-badge">{teamCount} team{teamCount !== 1 ? 's' : ''}</span>
                    {hasSettings && <span className="team-type-badge" style={{ background: '#ede9fe', color: '#7c3aed' }}>Settings inherited by teams</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamsPage;
