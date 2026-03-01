import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';

const ALL_FEATURES = [
  { slug: 'recurring_services',  label: 'Recurring Services' },
  { slug: 'bundle_creation',     label: 'Session Bundles' },
  { slug: 'bundle_expiration',   label: 'Bundle Expiration Rules' },
  { slug: 'booking_calendar',    label: 'Booking Calendar' },
  { slug: 'intake_forms',        label: 'Intake Forms' },
  { slug: 'deposits',            label: 'Deposits' },
  { slug: 'travel_fees',         label: 'Travel Fees' },
  { slug: 'repeat_client_tools', label: 'Repeat Client Tools' },
  { slug: 'capacity_controls',   label: 'Capacity Controls' },
  { slug: 'faster_payout',       label: 'Faster Payout' },
  { slug: 'advanced_analytics',  label: 'Advanced Analytics' },
  { slug: 'csv_export',          label: 'CSV Export' },
  { slug: 'saved_providers',     label: 'Saved Providers' },
  { slug: 'job_templates',       label: 'Job Templates' },
  { slug: 'proposal_comparison', label: 'Proposal Comparison' },
  { slug: 'spend_dashboard',     label: 'Spend Dashboard' },
  { slug: 'team_accounts',       label: 'Team Accounts' },
  { slug: 'beta_access',         label: 'Beta Access' },
  { slug: 'unlimited_services',  label: 'Unlimited Services' },
  { slug: 'unlimited_jobs',      label: 'Unlimited Job Posts' },
];

export default function FeatureGroupsPanel() {
  const [groups,      setGroups]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [msg,         setMsg]         = useState('');
  const [saving,      setSaving]      = useState('');
  const [expandedId,  setExpandedId]  = useState(null);

  // New group form
  const [newName,       setNewName]       = useState('');
  const [newDesc,       setNewDesc]       = useState('');
  const [newFeatures,   setNewFeatures]   = useState([]);
  const [newExpiry,     setNewExpiry]     = useState('');
  const [showNewForm,   setShowNewForm]   = useState(false);

  // Add member form per group
  const [memberEmail,   setMemberEmail]   = useState('');
  const [memberSearch,  setMemberSearch]  = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/admin/feature-groups');
      setGroups(data.groups || []);
    } catch (err) {
      flash('Failed to load groups: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleFeature = (slug) => {
    setNewFeatures(prev =>
      prev.includes(slug) ? prev.filter(f => f !== slug) : [...prev, slug]
    );
  };

  const handleCreate = async () => {
    if (!newName.trim()) { flash('Group name is required'); return; }
    setSaving('create');
    try {
      await apiRequest('/api/admin/feature-groups', {
        method: 'POST',
        body: JSON.stringify({
          name:      newName.trim(),
          description: newDesc.trim(),
          features:  newFeatures,
          expiresAt: newExpiry || null,
        }),
      });
      flash(`✅ Group "${newName}" created`);
      setNewName(''); setNewDesc(''); setNewFeatures([]); setNewExpiry(''); setShowNewForm(false);
      load();
    } catch (err) {
      flash('❌ ' + err.message);
    } finally {
      setSaving('');
    }
  };

  const handleToggleActive = async (group) => {
    setSaving(group._id + '_toggle');
    try {
      await apiRequest(`/api/admin/feature-groups/${group._id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !group.active }),
      });
      flash(`Group "${group.name}" ${!group.active ? 'activated' : 'deactivated'}`);
      load();
    } catch (err) {
      flash('❌ ' + err.message);
    } finally {
      setSaving('');
    }
  };

  const handleDelete = async (group) => {
    if (!window.confirm(`Delete group "${group.name}"? This removes feature access for all ${group.members?.length || 0} members.`)) return;
    setSaving(group._id + '_delete');
    try {
      await apiRequest(`/api/admin/feature-groups/${group._id}`, { method: 'DELETE' });
      flash(`🗑 Group "${group.name}" deleted`);
      load();
    } catch (err) {
      flash('❌ ' + err.message);
    } finally {
      setSaving('');
    }
  };

  const handleSearchUser = async () => {
    if (!memberEmail.trim()) return;
    setSearchLoading(true);
    try {
      const data = await apiRequest(`/api/admin/users/search?q=${encodeURIComponent(memberEmail)}&limit=5`);
      setMemberSearch(data.users || []);
    } catch (err) {
      flash('Search failed: ' + err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddMember = async (groupId, userId, userName) => {
    setSaving(groupId + '_member');
    try {
      await apiRequest(`/api/admin/feature-groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userIds: [userId] }),
      });
      flash(`✅ ${userName} added to group`);
      setMemberEmail(''); setMemberSearch([]);
      load();
    } catch (err) {
      flash('❌ ' + err.message);
    } finally {
      setSaving('');
    }
  };

  const handleRemoveMember = async (groupId, userId) => {
    setSaving(groupId + '_rm_' + userId);
    try {
      await apiRequest(`/api/admin/feature-groups/${groupId}/members/${userId}`, { method: 'DELETE' });
      flash('Member removed');
      load();
    } catch (err) {
      flash('❌ ' + err.message);
    } finally {
      setSaving('');
    }
  };

  if (loading) return <div className="fgp-loading">Loading feature groups...</div>;

  return (
    <div className="fgp-root">
      <div className="fgp-header">
        <div>
          <h2 className="fgp-title">🏷 Feature Groups</h2>
          <p className="fgp-subtitle">Grant feature access to cohorts of users. Members inherit all group features on top of their plan.</p>
        </div>
        <button className="fgp-new-btn" onClick={() => setShowNewForm(v => !v)}>
          {showNewForm ? 'Cancel' : '+ New Group'}
        </button>
      </div>

      {msg && <div className="fgp-msg">{msg}</div>}

      {/* ── Create group form ──────────────────────────────── */}
      {showNewForm && (
        <div className="fgp-create-form">
          <h3>New Feature Group</h3>
          <div className="fgp-form-row">
            <input className="fgp-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Group name (e.g. Beta Testers, February Cohort)" />
            <input className="fgp-input-sm" type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} title="Optional expiry" />
          </div>
          <input className="fgp-input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" style={{ marginBottom: 12 }} />
          <p className="fgp-feat-label">Features to grant:</p>
          <div className="fgp-feat-grid">
            {ALL_FEATURES.map(f => (
              <label key={f.slug} className={`fgp-feat-chip ${newFeatures.includes(f.slug) ? 'selected' : ''}`}>
                <input type="checkbox" checked={newFeatures.includes(f.slug)} onChange={() => toggleFeature(f.slug)} hidden />
                {newFeatures.includes(f.slug) ? '✅ ' : ''}{f.label}
              </label>
            ))}
          </div>
          <button className="fgp-create-btn" onClick={handleCreate} disabled={saving === 'create'}>
            {saving === 'create' ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      )}

      {/* ── Group list ─────────────────────────────────────── */}
      {groups.length === 0 ? (
        <div className="fgp-empty">No feature groups yet. Create one to grant cohort-level feature access.</div>
      ) : (
        <div className="fgp-group-list">
          {groups.map(g => (
            <div key={g._id} className={`fgp-group-card ${!g.active ? 'inactive' : ''}`}>
              <div className="fgp-group-header" onClick={() => setExpandedId(expandedId === g._id ? null : g._id)}>
                <div className="fgp-group-meta">
                  <span className="fgp-group-name">{g.name}</span>
                  <span className={`fgp-status-badge ${g.active ? 'active' : 'inactive'}`}>{g.active ? 'Active' : 'Inactive'}</span>
                  {g.expiresAt && <span className="fgp-expiry-badge">⏱ {new Date(g.expiresAt).toLocaleDateString()}</span>}
                </div>
                <div className="fgp-group-counts">
                  <span>{g.members?.length || 0} members</span>
                  <span>{g.features?.length || 0} features</span>
                  <span className="fgp-expand-icon">{expandedId === g._id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expandedId === g._id && (
                <div className="fgp-group-body">
                  {g.description && <p className="fgp-group-desc">{g.description}</p>}

                  {/* Features */}
                  <div className="fgp-group-section">
                    <strong>Features granted:</strong>
                    <div className="fgp-feat-tags">
                      {g.features?.length > 0
                        ? g.features.map(f => <span key={f} className="fgp-feat-tag">{ALL_FEATURES.find(x => x.slug === f)?.label || f}</span>)
                        : <span className="fgp-none">None</span>}
                    </div>
                  </div>

                  {/* Members */}
                  <div className="fgp-group-section">
                    <strong>Members ({g.members?.length || 0}):</strong>
                    <div className="fgp-member-list">
                      {(g.members || []).slice(0, 10).map(m => (
                        <div key={m._id || m} className="fgp-member-row">
                          <span className="fgp-member-name">{m.firstName ? `${m.firstName} ${m.lastName}` : String(m)}</span>
                          {m.email && <span className="fgp-member-email">{m.email}</span>}
                          <button className="fgp-rm-member" onClick={() => handleRemoveMember(g._id, m._id || m)}
                            disabled={saving === `${g._id}_rm_${m._id || m}`}>✕</button>
                        </div>
                      ))}
                      {(g.members?.length || 0) > 10 && <p className="fgp-more">+{g.members.length - 10} more</p>}
                    </div>

                    {/* Add member search */}
                    <div className="fgp-add-member">
                      <input className="fgp-input" value={memberEmail}
                        onChange={e => setMemberEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearchUser()}
                        placeholder="Search user by email or name..." />
                      <button className="fgp-search-btn" onClick={handleSearchUser} disabled={searchLoading}>
                        {searchLoading ? '...' : 'Search'}
                      </button>
                    </div>
                    {memberSearch.length > 0 && (
                      <div className="fgp-search-results">
                        {memberSearch.map(u => (
                          <div key={u._id} className="fgp-search-row">
                            <span>{u.firstName} {u.lastName} — {u.email}</span>
                            <button className="fgp-add-member-btn"
                              onClick={() => handleAddMember(g._id, u._id, `${u.firstName} ${u.lastName}`)}
                              disabled={saving === `${g._id}_member`}>
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Group actions */}
                  <div className="fgp-group-actions">
                    <button className="fgp-action-btn" onClick={() => handleToggleActive(g)}
                      disabled={saving === `${g._id}_toggle`}>
                      {g.active ? '⏸ Deactivate' : '▶ Activate'}
                    </button>
                    <button className="fgp-action-btn danger" onClick={() => handleDelete(g)}
                      disabled={saving === `${g._id}_delete`}>
                      🗑 Delete Group
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
