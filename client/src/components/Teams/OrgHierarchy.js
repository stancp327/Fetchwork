import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './OrgHierarchy.css';

export default function OrgHierarchy({ team, currentUserRole }) {
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgTeams, setOrgTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingTeam, setAddingTeam] = useState(false);
  const [userTeams, setUserTeams] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({ name: '', description: '', logo: '', website: '', billingEmail: '' });

  const isOwnerOrAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await apiRequest('/api/organizations');
      setOrgs(res.organizations || []);
    } catch {
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrgDetail = useCallback(async (orgId) => {
    try {
      const res = await apiRequest(`/api/organizations/${orgId}`);
      setSelectedOrg(res.organization);
      setOrgTeams(res.teams || []);
    } catch {
      setError('Failed to load organization details');
    }
  }, []);

  const fetchUserTeams = useCallback(async () => {
    try {
      const res = await apiRequest('/api/teams');
      setUserTeams(res.teams || res || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest('/api/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, description: form.description, logo: form.logo, website: form.website }),
      });
      setSuccess('Organization created');
      setCreating(false);
      setForm({ name: '', description: '', logo: '', website: '', billingEmail: '' });
      fetchOrgs();
    } catch (err) {
      setError(err.message || 'Failed to create organization');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedOrg) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/api/organizations/${selectedOrg._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          logo: form.logo,
          website: form.website,
          billingEmail: form.billingEmail,
        }),
      });
      setSuccess('Organization updated');
      setEditing(false);
      fetchOrgDetail(selectedOrg._id);
      fetchOrgs();
    } catch (err) {
      setError(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTeam = async (teamId) => {
    if (!selectedOrg || !teamId) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/api/organizations/${selectedOrg._id}/teams`, {
        method: 'POST',
        body: JSON.stringify({ teamId }),
      });
      setSuccess('Team added to organization');
      setAddingTeam(false);
      fetchOrgDetail(selectedOrg._id);
      fetchOrgs();
    } catch (err) {
      setError(err.message || 'Failed to add team');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTeam = async (teamId) => {
    if (!selectedOrg || !window.confirm('Remove this team from the organization?')) return;
    setError('');
    try {
      await apiRequest(`/api/organizations/${selectedOrg._id}/teams/${teamId}`, { method: 'DELETE' });
      setSuccess('Team removed');
      fetchOrgDetail(selectedOrg._id);
      fetchOrgs();
    } catch (err) {
      setError(err.message || 'Failed to remove team');
    }
  };

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const openEdit = () => {
    if (!selectedOrg) return;
    setForm({
      name: selectedOrg.name || '',
      description: selectedOrg.description || '',
      logo: selectedOrg.logo || '',
      website: selectedOrg.website || '',
      billingEmail: selectedOrg.billing?.billingEmail || '',
    });
    setEditing(true);
  };

  const openOrgDetail = (org) => {
    setSelectedOrg(null);
    setOrgTeams([]);
    setEditing(false);
    setAddingTeam(false);
    fetchOrgDetail(org._id);
  };

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  if (loading) return <div className="oh-loading">Loading organizations...</div>;

  // Detail view
  if (selectedOrg) {
    return (
      <div className="oh-root">
        <button className="oh-back-btn" onClick={() => setSelectedOrg(null)}>&larr; All Organizations</button>

        {error && <div className="oh-error">{error}</div>}
        {success && <div className="oh-success">{success}</div>}

        {editing ? (
          <form className="oh-form" onSubmit={handleUpdate}>
            <h3 className="oh-form-title">Edit Organization</h3>
            <label className="oh-label">Name
              <input className="oh-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </label>
            <label className="oh-label">Description
              <textarea className="oh-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </label>
            <label className="oh-label">Logo URL
              <input className="oh-input" value={form.logo} onChange={e => setForm(f => ({ ...f, logo: e.target.value }))} />
            </label>
            <label className="oh-label">Website
              <input className="oh-input" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
            </label>
            <label className="oh-label">Billing Email
              <input className="oh-input" type="email" value={form.billingEmail} onChange={e => setForm(f => ({ ...f, billingEmail: e.target.value }))} />
            </label>
            <div className="oh-form-actions">
              <button type="submit" className="oh-btn oh-btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button type="button" className="oh-btn oh-btn--secondary" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="oh-detail">
            <div className="oh-detail-header">
              {selectedOrg.logo && <img src={selectedOrg.logo} alt="" className="oh-logo" />}
              <div>
                <h2 className="oh-org-name">{selectedOrg.name}</h2>
                {selectedOrg.description && <p className="oh-org-desc">{selectedOrg.description}</p>}
                {selectedOrg.website && <a href={selectedOrg.website} className="oh-link" target="_blank" rel="noopener noreferrer">{selectedOrg.website}</a>}
              </div>
            </div>
            {selectedOrg.billing?.billingEmail && (
              <p className="oh-meta">Billing: {selectedOrg.billing.billingEmail}</p>
            )}
            {isOwnerOrAdmin && (
              <button className="oh-btn oh-btn--secondary" onClick={openEdit}>Settings</button>
            )}
          </div>
        )}

        {/* Tree view */}
        <div className="oh-tree-section">
          <h3 className="oh-section-title">Teams</h3>
          {orgTeams.length === 0 ? (
            <p className="oh-empty-text">No teams in this organization yet.</p>
          ) : (
            <ul className="oh-tree">
              {orgTeams.map(t => (
                <li key={t._id} className="oh-tree-item">
                  <button className="oh-tree-toggle" onClick={() => toggleExpand(t._id)}>
                    <span className="oh-tree-arrow">{expanded[t._id] ? '\u25BC' : '\u25B6'}</span>
                    <span className="oh-tree-team-name">{t.name}</span>
                    <span className="oh-tree-count">{t.memberCount} member{t.memberCount !== 1 ? 's' : ''}</span>
                    {t.department && <span className="oh-badge">{t.department}</span>}
                  </button>
                  {expanded[t._id] && (
                    <ul className="oh-tree-members">
                      {(t.members || []).filter(m => m.status === 'active').map(m => (
                        <li key={m._id} className="oh-tree-member">
                          <span className="oh-member-role">{m.role}</span>
                          <span className="oh-member-title">{m.title || 'Member'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {isOwnerOrAdmin && (
                    <button className="oh-remove-btn" onClick={() => handleRemoveTeam(t._id)}>Remove</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {isOwnerOrAdmin && !addingTeam && (
            <button className="oh-btn oh-btn--primary" onClick={() => { setAddingTeam(true); fetchUserTeams(); }}>Add Team to Org</button>
          )}
          {addingTeam && (
            <div className="oh-add-team">
              <h4 className="oh-section-title">Select a team to add</h4>
              {userTeams.length === 0 ? (
                <p className="oh-empty-text">No teams available to add.</p>
              ) : (
                <ul className="oh-team-select-list">
                  {userTeams
                    .filter(ut => !orgTeams.some(ot => String(ot._id) === String(ut._id)))
                    .map(ut => (
                      <li key={ut._id} className="oh-team-select-item">
                        <span>{ut.name}</span>
                        <button className="oh-btn oh-btn--primary oh-btn--sm" disabled={saving} onClick={() => handleAddTeam(ut._id)}>Add</button>
                      </li>
                    ))
                  }
                </ul>
              )}
              <button className="oh-btn oh-btn--secondary" onClick={() => setAddingTeam(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="oh-root">
      <div className="oh-header">
        <h2 className="oh-title">Organizations</h2>
        {isOwnerOrAdmin && !creating && (
          <button className="oh-btn oh-btn--primary" onClick={() => setCreating(true)}>Create Organization</button>
        )}
      </div>

      {error && <div className="oh-error">{error}</div>}
      {success && <div className="oh-success">{success}</div>}

      {creating && (
        <form className="oh-form" onSubmit={handleCreate}>
          <h3 className="oh-form-title">New Organization</h3>
          <label className="oh-label">Name
            <input className="oh-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </label>
          <label className="oh-label">Description
            <textarea className="oh-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
          </label>
          <label className="oh-label">Logo URL
            <input className="oh-input" value={form.logo} onChange={e => setForm(f => ({ ...f, logo: e.target.value }))} />
          </label>
          <label className="oh-label">Website
            <input className="oh-input" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
          </label>
          <div className="oh-form-actions">
            <button type="submit" className="oh-btn oh-btn--primary" disabled={saving}>{saving ? 'Creating...' : 'Create'}</button>
            <button type="button" className="oh-btn oh-btn--secondary" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      )}

      {orgs.length === 0 && !creating ? (
        <div className="oh-empty">No organizations yet. Create one to group your teams under a single entity.</div>
      ) : (
        <ul className="oh-org-list">
          {orgs.map(org => (
            <li key={org._id} className="oh-org-card" onClick={() => openOrgDetail(org)}>
              <div className="oh-org-card-header">
                {org.logo && <img src={org.logo} alt="" className="oh-logo-sm" />}
                <div>
                  <h3 className="oh-org-card-name">{org.name}</h3>
                  {org.description && <p className="oh-org-card-desc">{org.description}</p>}
                </div>
              </div>
              <div className="oh-org-card-footer">
                <span className="oh-team-count">{(org.teams || []).length} team{(org.teams || []).length !== 1 ? 's' : ''}</span>
                {org.isOwner && <span className="oh-badge">Owner</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
