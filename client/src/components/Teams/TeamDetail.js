import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './TeamsPage.css';
import './TeamDetail.css';

const TeamDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('members');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [transferTargetUserId, setTransferTargetUserId] = useState('');
  const [transferringOwner, setTransferringOwner] = useState(false);

  // Phase 2 state
  const [approvals, setApprovals] = useState([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalFilter, setApprovalFilter] = useState('');
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approvalForm, setApprovalForm] = useState({ action: 'payout', amount: '', metadata: '' });
  const [controls, setControls] = useState(null);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [controlsForm, setControlsForm] = useState({
    monthlyCapEnabled: false, monthlyCap: 0, alertThreshold: 80,
    payoutRequiresApproval: false, payoutThresholdAmount: 0, requireDualControl: false,
  });
  const [savingControls, setSavingControls] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  // Phase 3b state
  const [customRoles, setCustomRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState('');
  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] });
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientForm, setClientForm] = useState({ clientUserId: '', accessLevel: 'view_assigned', projectLabel: '' });

  const fetchTeam = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      setNotFound(false);
      const data = await apiRequest(`/api/teams/${id}`);
      setTeam(data.team);
      setEditForm({ name: data.team.name, description: data.team.description, approvalThreshold: data.team.approvalThreshold });
    } catch (err) {
      console.error('Failed to load team:', err);
      setTeam(null);
      setNotFound(err?.status === 404);
      setLoadError(err?.message || 'Failed to load team details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);


  const currentUserId = String(user?._id || user?.id || '');
  const myMember = team?.members?.find((m) => String(m.user?._id || m.user?.id || m.user || '') === currentUserId);
  const ownerId = String(team?.owner?._id || team?.owner?.id || team?.owner || '');
  const ownerEmail = String(team?.owner?.email || '').toLowerCase();
  const currentUserEmail = String(user?.email || '').toLowerCase();

  // Owner-first gating (explicit + deterministic for UI)
  const isOwnerById = Boolean(ownerId && currentUserId && ownerId === currentUserId);
  const isOwnerByEmail = Boolean(ownerEmail && currentUserEmail && ownerEmail === currentUserEmail);
  const isOwnerByMemberRole = myMember?.role === 'owner';
  const isOwnerByServerFlag = Boolean(team?.currentUserIsOwner || team?.currentUserCanDelete || team?.currentUserRole === 'owner');

  const isOwner = Boolean(isOwnerById || isOwnerByEmail || isOwnerByMemberRole || isOwnerByServerFlag);
  const isAdmin = myMember?.role === 'admin' || team?.currentUserRole === 'admin';
  const isOwnerOrAdmin = Boolean(isOwner || isAdmin);
  const canManageMembers = Boolean(isOwnerOrAdmin || team?.currentUserCanManageMembers);
  const activeMembers = team?.members?.filter(m => m.status === 'active') || [];

  const permissionOptions = [
    { value: 'manage_members', label: 'Manage Members' },
    { value: 'manage_billing', label: 'Manage Billing' },
    { value: 'approve_orders', label: 'Approve Orders' },
    { value: 'create_jobs', label: 'Post Jobs' },
    { value: 'manage_services', label: 'Manage Services' },
    { value: 'view_analytics', label: 'View Analytics' },
    { value: 'message_clients', label: 'Message Clients' },
    { value: 'assign_work', label: 'Assign Work' },
  ];

  const permissionLabel = (key) => permissionOptions.find((p) => p.value === key)?.label || key;

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

  const fetchAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      setAuditError('');
      const data = await apiRequest(`/api/teams/${id}/audit-logs?limit=50`);
      setAuditLogs(data.logs || []);
    } catch (err) {
      setAuditError(err?.message || 'Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  }, [id]);

  const fetchApprovals = useCallback(async (statusFilter) => {
    try {
      setApprovalsLoading(true);
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const data = await apiRequest(`/api/teams/${id}/approvals${qs}`);
      setApprovals(data.approvals || []);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setApprovalsLoading(false);
    }
  }, [id]);

  const fetchControls = useCallback(async () => {
    try {
      setControlsLoading(true);
      const data = await apiRequest(`/api/teams/${id}/spend-controls`);
      setControls(data);
      setControlsForm({
        monthlyCapEnabled: data.spendControls?.monthlyCapEnabled || false,
        monthlyCap: data.spendControls?.monthlyCap || 0,
        alertThreshold: Math.round((data.spendControls?.alertThreshold || 0.8) * 100),
        payoutRequiresApproval: data.approvalThresholds?.payoutRequiresApproval || false,
        payoutThresholdAmount: data.approvalThresholds?.payoutThresholdAmount || 0,
        requireDualControl: data.approvalThresholds?.requireDualControl || false,
      });
    } catch (err) {
      console.error('Failed to load controls:', err);
    } finally {
      setControlsLoading(false);
    }
  }, [id]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await apiRequest(`/api/teams/${id}/analytics`);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }, [id]);

  const fetchCustomRoles = useCallback(async () => {
    try {
      setRolesLoading(true);
      const data = await apiRequest(`/api/teams/${id}/custom-roles`);
      setCustomRoles(data.customRoles || []);
    } catch (err) {
      console.error('Failed to load custom roles:', err);
    } finally {
      setRolesLoading(false);
    }
  }, [id]);

  const fetchLinkedClients = useCallback(async () => {
    try {
      setClientsLoading(true);
      const data = await apiRequest(`/api/teams/${id}/clients`);
      setClients(data.clients || []);
    } catch (err) {
      console.error('Failed to load linked clients:', err);
    } finally {
      setClientsLoading(false);
    }
  }, [id]);

  const togglePermission = (permission) => {
    setRoleForm((prev) => {
      const has = prev.permissions.includes(permission);
      return {
        ...prev,
        permissions: has ? prev.permissions.filter((p) => p !== permission) : [...prev.permissions, permission],
      };
    });
  };

  const submitCustomRole = async (e) => {
    e.preventDefault();
    try {
      if (!roleForm.name.trim()) return;
      if (editingRoleId) {
        await apiRequest(`/api/teams/${id}/custom-roles/${editingRoleId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: roleForm.name.trim(), permissions: roleForm.permissions }),
        });
      } else {
        await apiRequest(`/api/teams/${id}/custom-roles`, {
          method: 'POST',
          body: JSON.stringify({ name: roleForm.name.trim(), permissions: roleForm.permissions }),
        });
      }
      setRoleForm({ name: '', permissions: [] });
      setEditingRoleId('');
      setShowAddRole(false);
      fetchCustomRoles();
      fetchTeam();
    } catch (err) {
      alert(err.message || 'Failed to save custom role');
    }
  };

  const startEditRole = (role) => {
    setShowAddRole(true);
    setEditingRoleId(role._id);
    setRoleForm({ name: role.name || '', permissions: role.permissions || [] });
  };

  const deleteCustomRole = async (role) => {
    const inUse = activeMembers.some((m) => m.customRoleName === role.name);
    if (inUse) return;
    if (!window.confirm(`Delete custom role \"${role.name}\"?`)) return;
    try {
      await apiRequest(`/api/teams/${id}/custom-roles/${role._id}`, { method: 'DELETE' });
      fetchCustomRoles();
      fetchTeam();
    } catch (err) {
      alert(err.message || 'Failed to delete role');
    }
  };

  const assignMemberCustomRole = async (memberUserId, customRoleName) => {
    try {
      await apiRequest(`/api/teams/${id}/members/${memberUserId}/custom-role`, {
        method: 'PATCH',
        body: JSON.stringify({ customRoleName }),
      });
      fetchTeam();
    } catch (err) {
      alert(err.message || 'Failed to assign custom role');
    }
  };

  const submitLinkedClient = async (e) => {
    e.preventDefault();
    try {
      if (!clientForm.clientUserId.trim()) return;
      await apiRequest(`/api/teams/${id}/clients`, {
        method: 'POST',
        body: JSON.stringify({
          clientUserId: clientForm.clientUserId.trim(),
          accessLevel: clientForm.accessLevel,
          projectLabel: clientForm.projectLabel,
        }),
      });
      setClientForm({ clientUserId: '', accessLevel: 'view_assigned', projectLabel: '' });
      setShowAddClient(false);
      fetchLinkedClients();
    } catch (err) {
      alert(err.message || 'Failed to add linked client');
    }
  };

  const removeLinkedClient = async (clientId) => {
    if (!window.confirm('Unlink this client from team?')) return;
    try {
      await apiRequest(`/api/teams/${id}/clients/${clientId}`, { method: 'DELETE' });
      fetchLinkedClients();
    } catch (err) {
      alert(err.message || 'Failed to unlink client');
    }
  };

  const createApproval = async (e) => {
    e.preventDefault();
    try {
      const body = { action: approvalForm.action };
      if (['payout', 'spend'].includes(approvalForm.action) && approvalForm.amount) {
        body.amount = Number(approvalForm.amount);
      }
      if (approvalForm.metadata) body.metadata = { note: approvalForm.metadata };
      await apiRequest(`/api/teams/${id}/approvals`, {
        method: 'POST', body: JSON.stringify(body),
      });
      setShowApprovalForm(false);
      setApprovalForm({ action: 'payout', amount: '', metadata: '' });
      fetchApprovals(approvalFilter);
    } catch (err) {
      alert(err.message || 'Failed to create approval request');
    }
  };

  const handleApprove = async (approvalId) => {
    try {
      await apiRequest(`/api/teams/${id}/approvals/${approvalId}/approve`, { method: 'POST', body: JSON.stringify({}) });
      fetchApprovals(approvalFilter);
    } catch (err) {
      alert(err.message || 'Failed to approve');
    }
  };

  const handleReject = async (approvalId) => {
    const reason = window.prompt('Reason for rejection (optional):');
    if (reason === null) return;
    try {
      await apiRequest(`/api/teams/${id}/approvals/${approvalId}/reject`, {
        method: 'POST', body: JSON.stringify({ reason }),
      });
      fetchApprovals(approvalFilter);
    } catch (err) {
      alert(err.message || 'Failed to reject');
    }
  };

  const handleCancelApproval = async (approvalId) => {
    if (!window.confirm('Cancel this approval request?')) return;
    try {
      await apiRequest(`/api/teams/${id}/approvals/${approvalId}`, { method: 'DELETE' });
      fetchApprovals(approvalFilter);
    } catch (err) {
      alert(err.message || 'Failed to cancel');
    }
  };

  const saveControls = async () => {
    setSavingControls(true);
    try {
      await apiRequest(`/api/teams/${id}/spend-controls`, {
        method: 'PATCH',
        body: JSON.stringify({
          spendControls: {
            monthlyCapEnabled: controlsForm.monthlyCapEnabled,
            monthlyCap: Number(controlsForm.monthlyCap),
            alertThreshold: Number(controlsForm.alertThreshold) / 100,
          },
          approvalThresholds: {
            payoutRequiresApproval: controlsForm.payoutRequiresApproval,
            payoutThresholdAmount: Number(controlsForm.payoutThresholdAmount),
            requireDualControl: controlsForm.requireDualControl,
          },
        }),
      });
      fetchControls();
    } catch (err) {
      alert(err.message || 'Failed to save controls');
    } finally {
      setSavingControls(false);
    }
  };

  const transferOwnership = async () => {
    if (!transferTargetUserId) return;
    if (!window.confirm('Transfer ownership? This will remove your owner privileges.')) return;

    try {
      setTransferringOwner(true);
      await apiRequest(`/api/teams/${id}/transfer-ownership`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId: transferTargetUserId }),
      });
      setTransferTargetUserId('');
      await Promise.all([fetchTeam(), fetchAuditLogs()]);
    } catch (err) {
      alert(err?.message || 'Failed to transfer ownership');
    } finally {
      setTransferringOwner(false);
    }
  };

  const roleIcons = { owner: '👑', admin: '★', manager: '📋', member: '👤' };
  const roleColors = { owner: '#f59e0b', admin: '#8b5cf6', manager: '#3b82f6', member: '#6b7280' };

  useEffect(() => {
    const interval = setInterval(() => {
      fetchTeam();
      if (activeTab === 'audit' && isOwnerOrAdmin) fetchAuditLogs();
    }, 15000);

    const onFocus = () => {
      fetchTeam();
      if (activeTab === 'audit' && isOwnerOrAdmin) fetchAuditLogs();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchTeam, fetchAuditLogs, activeTab, isOwnerOrAdmin]);

  if (loading) return <div className="teams-page"><div className="teams-loading">Loading team…</div></div>;
  if (!team && notFound) return <div className="teams-page"><div className="teams-empty"><h3>Team not found</h3><p>This team may have been deleted or your access changed.</p><button className="btn btn-ghost btn-sm" onClick={() => navigate('/teams')}>Back to Teams</button></div></div>;
  if (!team && loadError) {
    return (
      <div className="teams-page">
        <div className="teams-empty">
          <h3>Couldn’t load team</h3>
          <p className="td-error-msg">{loadError}</p>
          <div className="td-error-actions">
            <button className="btn btn-primary btn-sm" onClick={fetchTeam}>Retry</button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/teams')}>Back to Teams</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="teams-page">
      <button className="btn btn-ghost btn-sm td-back-btn" onClick={() => navigate('/teams')}>← Back to Teams</button>

      {/* Header */}
      <div className="team-detail-header">
        <div className="td-header-info">
          {team.logo ? (
            <img src={team.logo} alt="" className="team-logo td-header-logo" />
          ) : (
            <div className="team-logo-placeholder td-header-logo-placeholder">{team.name[0]}</div>
          )}
          <div>
            <h1 className="td-team-name">{team.name}</h1>
            <span className="team-type-badge td-type-badge-wrap">
              {team.type === 'agency' ? '🏢 Agency' : '👥 Client Team'} · {activeMembers.length} members
            </span>
            <div className="td-access-label">
              Access: {isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Member'}
            </div>
          </div>
        </div>
        <div className="td-header-actions">
          {canManageMembers && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel' : '⚙️ Settings'}
            </button>
          )}
          <button
            className="btn btn-danger btn-sm"
            onClick={deleteTeam}
            disabled={!isOwner}
            title={isOwner ? 'Delete this team' : 'Only the team owner can delete'}
          >
            Delete Team
          </button>
        </div>
      </div>

      {team.description && !editing && <p className="td-description">{team.description}</p>}

      {/* Settings */}
      {editing && isOwnerOrAdmin && (
        <div className="teams-create-form td-settings-wrap">
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
          <div className="td-header-actions">
            <button className="btn btn-primary btn-sm" onClick={saveSettings}>Save</button>
            {isOwner && (
              <button className="btn btn-danger btn-sm" onClick={deleteTeam}>Delete Team</button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="team-detail-tabs td-tabs">
        {['members', 'billing', 'assignments', 'activity', ...(isOwnerOrAdmin ? ['approvals'] : []), ...(isOwner ? ['controls'] : []), ...(isOwnerOrAdmin ? ['audit'] : [])].map(tab => (
          <button
            key={tab}
            className={`btn btn-ghost btn-sm ${activeTab === tab ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'audit') fetchAuditLogs();
              if (tab === 'approvals') fetchApprovals(approvalFilter);
              if (tab === 'controls') {
                fetchControls();
                fetchCustomRoles();
                fetchLinkedClients();
              }
              if (tab === 'billing') fetchAnalytics();
            }}
            style={{ fontWeight: activeTab === tab ? 700 : 400, borderBottom: activeTab === tab ? '2px solid #3b82f6' : 'none' }}
          >
            {{
              members: `Members (${activeMembers.length})`,
              billing: '💰 Billing',
              assignments: '📋 Assignments',
              activity: 'Activity',
              approvals: '✅ Approvals',
              controls: '⚙️ Controls',
              audit: '🧾 Audit',
            }[tab]}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {activeTab === 'members' && (
        <div className="td-tab-content">
          {/* Invite form */}
          {canManageMembers && (
            <form onSubmit={inviteMember} className="td-invite-form">
              <input
                type="email" required placeholder="Email address"
                value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                className="td-invite-input"
              />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="td-invite-select">
                <option value="member">Member</option>
                <option value="manager">Manager</option>
                {isOwner && <option value="admin">Admin</option>}
              </select>
              <button type="submit" className="btn btn-primary btn-sm" disabled={inviting}>
                {inviting ? 'Inviting…' : 'Invite'}
              </button>
            </form>
          )}

          {/* Ownership transfer */}
          {isOwner && activeMembers.filter(m => m.role !== 'owner').length > 0 && (
            <div className="td-transfer-box">
              <div className="td-transfer-title">Transfer Ownership</div>
              <p className="td-transfer-desc">
                Transfer owner privileges to another active member.
              </p>
              <div className="team-detail-transfer-actions td-transfer-actions">
                <select
                  value={transferTargetUserId}
                  onChange={(e) => setTransferTargetUserId(e.target.value)}
                  className="td-transfer-select"
                >
                  <option value="">Select new owner…</option>
                  {activeMembers
                    .filter((m) => m.role !== 'owner')
                    .map((m) => {
                      const uid = String(m.user?._id || m.user?.id || m.user || '');
                      const name = `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim() || m.user?.email || uid;
                      return <option key={uid} value={uid}>{name} ({m.role})</option>;
                    })}
                </select>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={transferOwnership}
                  disabled={!transferTargetUserId || transferringOwner}
                >
                  {transferringOwner ? 'Transferring…' : 'Transfer Ownership'}
                </button>
              </div>
            </div>
          )}

          {/* Member list */}
          <div className="td-member-list">
            {team.members.filter(m => m.status !== 'removed').map(m => {
              const u = m.user || {};
              return (
                <div key={m._id} className="team-detail-member-row td-member-row">
                  <div className="td-member-info">
                    <div className="td-member-avatar" style={{ background: roleColors[m.role] }}>
                      {u.profileImage ? <img src={u.profileImage} alt="" className="td-member-avatar-img" /> : (u.firstName?.[0] || '?')}
                    </div>
                    <div>
                      <div className="td-member-name">{u.firstName} {u.lastName}</div>
                      <div className="td-member-role-text">
                        {roleIcons[m.role]} {m.role}{m.title ? ` · ${m.title}` : ''}
                        {m.status === 'invited' && <span className="td-pending-badge">⏳ Pending</span>}
                      </div>
                    </div>
                  </div>
                  {canManageMembers && m.role !== 'owner' && m.status === 'active' && (
                    <div className="team-detail-member-actions td-member-actions">
                      <select
                        value={m.role}
                        onChange={e => updateRole(u._id, e.target.value)}
                        className="td-role-select"
                      >
                        <option value="member">Member</option>
                        <option value="manager">Manager</option>
                        {isOwner && <option value="admin">Admin</option>}
                      </select>
                      {customRoles.length > 0 && (
                        <select
                          value={m.customRoleName || ''}
                          onChange={e => assignMemberCustomRole(u._id, e.target.value)}
                          className="td-role-select"
                        >
                          <option value="">No custom role</option>
                          {customRoles.map((r) => (
                            <option key={r._id} value={r.name}>{r.name}</option>
                          ))}
                        </select>
                      )}
                      <button onClick={() => removeMember(u._id)} className="btn btn-danger btn-sm td-btn-remove">Remove</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Billing tab */}
      {activeTab === 'billing' && (
        <div className="td-tab-content">
          {isOwnerOrAdmin && analytics && (
            <div className="team-analytics-summary">
              <div className="team-analytics-card">
                <div className="team-analytics-label">Members</div>
                <div className="team-analytics-value">{analytics.memberCount}</div>
              </div>
              <div className="team-analytics-card">
                <div className="team-analytics-label">This Month Spend</div>
                <div className="team-analytics-value">${(analytics.totalSpend || 0).toFixed(2)}</div>
                {analytics.spendCapUtilization !== null && (
                  <div className="team-spend-bar">
                    <div
                      className="team-spend-bar-fill"
                      style={{ width: `${Math.min(analytics.spendCapUtilization * 100, 100)}%` }}
                      data-level={analytics.spendCapUtilization >= 0.9 ? 'red' : analytics.spendCapUtilization >= 0.7 ? 'amber' : 'green'}
                    />
                  </div>
                )}
              </div>
              <div className="team-analytics-card">
                <div className="team-analytics-label">Pending Approvals</div>
                <div className="team-analytics-value">{analytics.approvalStats?.pending || 0}</div>
              </div>
            </div>
          )}
          <BillingSection
            teamId={id}
            canManage={Boolean(isOwnerOrAdmin || myMember?.permissions?.includes('manage_billing'))}
          />
        </div>
      )}

      {/* Assignments tab */}
      {activeTab === 'assignments' && (
        <div className="td-tab-content">
          <AssignmentsSection
            teamId={id}
            canAssign={Boolean(isOwnerOrAdmin || myMember?.permissions?.includes('assign_work'))}
          />
        </div>
      )}

      {/* Activity tab */}
      {activeTab === 'activity' && (
        <div className="td-tab-content">
          <ActivitySection teamId={id} />
        </div>
      )}

      {/* Approvals tab */}
      {activeTab === 'approvals' && isOwnerOrAdmin && (
        <div className="td-tab-content">
          <div className="td-section-header">
            <h3 className="td-heading-flush">Approval Requests</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowApprovalForm(!showApprovalForm)}>
              {showApprovalForm ? 'Cancel' : '+ Request Approval'}
            </button>
          </div>

          {showApprovalForm && (
            <form onSubmit={createApproval} className="team-controls-form td-approval-form-wrap">
              <div className="team-controls-row">
                <label>Action</label>
                <select value={approvalForm.action} onChange={e => setApprovalForm({ ...approvalForm, action: e.target.value })}>
                  <option value="payout">Payout</option>
                  <option value="spend">Spend</option>
                  <option value="role_change">Role Change</option>
                  <option value="member_remove">Member Remove</option>
                </select>
              </div>
              {['payout', 'spend'].includes(approvalForm.action) && (
                <div className="team-controls-row">
                  <label>Amount ($)</label>
                  <input type="number" min="0" step="0.01" value={approvalForm.amount} onChange={e => setApprovalForm({ ...approvalForm, amount: e.target.value })} placeholder="0.00" />
                </div>
              )}
              <div className="team-controls-row">
                <label>Note (optional)</label>
                <input value={approvalForm.metadata} onChange={e => setApprovalForm({ ...approvalForm, metadata: e.target.value })} placeholder="Details about this request" />
              </div>
              <button type="submit" className="btn btn-primary btn-sm">Submit Request</button>
            </form>
          )}

          <div className="td-filter-bar">
            {['', 'pending', 'approved', 'rejected'].map(s => (
              <button
                key={s}
                className={`btn btn-ghost btn-sm ${approvalFilter === s ? 'active' : ''}`}
                style={{ fontWeight: approvalFilter === s ? 700 : 400, borderBottom: approvalFilter === s ? '2px solid #3b82f6' : 'none' }}
                onClick={() => { setApprovalFilter(s); fetchApprovals(s); }}
              >
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {approvalsLoading ? <p>Loading approvals...</p> : (
            <div className="team-approvals-list">
              {approvals.length === 0 ? (
                <div className="td-empty-state">No approval requests found.</div>
              ) : approvals.map(a => {
                const requesterId = String(a.requestedBy?._id || a.requestedBy);
                const isMyRequest = requesterId === currentUserId;
                const statusColors = { pending: '#f59e0b', approved: '#16a34a', rejected: '#dc2626', expired: '#6b7280', cancelled: '#9ca3af' };
                return (
                  <div key={a._id} className="team-approval-card">
                    <div className="td-approval-header">
                      <div>
                        <div className="td-approval-action">{(a.action || '').replace('_', ' ')}</div>
                        <div className="td-text-secondary-sm">
                          By {a.requestedBy?.firstName || 'User'} {a.requestedBy?.lastName || ''}
                          {a.amount ? ` · $${Number(a.amount).toFixed(2)}` : ''}
                        </div>
                      </div>
                      <span className="td-approval-status" style={{ background: `${statusColors[a.status]}20`, color: statusColors[a.status] }}>
                        {a.status}
                      </span>
                    </div>
                    {a.status === 'pending' && a.expiresAt && (
                      <div className="td-expires-label">
                        Expires: {new Date(a.expiresAt).toLocaleString()}
                      </div>
                    )}
                    {a.status === 'pending' && (
                      <div className="team-approval-actions">
                        {!isMyRequest && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => handleApprove(a._id)}>Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleReject(a._id)}>Reject</button>
                          </>
                        )}
                        {(isMyRequest || isOwner) && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleCancelApproval(a._id)}>Cancel</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Controls tab */}
      {activeTab === 'controls' && isOwner && (
        <div className="td-tab-content">
          {controlsLoading ? <p>Loading controls...</p> : (
            <div>
              <div className="team-controls-section">
                <h3>Spend Controls</h3>
                <div className="team-controls-form">
                  <div className="team-controls-row">
                    <label>
                      <input type="checkbox" checked={controlsForm.monthlyCapEnabled} onChange={e => setControlsForm({ ...controlsForm, monthlyCapEnabled: e.target.checked })} />
                      {' '}Enable Monthly Spend Cap
                    </label>
                  </div>
                  {controlsForm.monthlyCapEnabled && (
                    <>
                      <div className="team-controls-row">
                        <label>Monthly Cap ($)</label>
                        <input type="number" min="0" value={controlsForm.monthlyCap} onChange={e => setControlsForm({ ...controlsForm, monthlyCap: e.target.value })} />
                      </div>
                      <div className="team-controls-row">
                        <label>Alert Threshold (%)</label>
                        <input type="number" min="0" max="100" value={controlsForm.alertThreshold} onChange={e => setControlsForm({ ...controlsForm, alertThreshold: e.target.value })} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="team-controls-section td-section-gap">
                <h3>Approval Thresholds</h3>
                <div className="team-controls-form">
                  <div className="team-controls-row">
                    <label>
                      <input type="checkbox" checked={controlsForm.payoutRequiresApproval} onChange={e => setControlsForm({ ...controlsForm, payoutRequiresApproval: e.target.checked })} />
                      {' '}Require Approval for Payouts
                    </label>
                  </div>
                  {controlsForm.payoutRequiresApproval && (
                    <div className="team-controls-row">
                      <label>Payout Threshold ($)</label>
                      <input type="number" min="0" value={controlsForm.payoutThresholdAmount} onChange={e => setControlsForm({ ...controlsForm, payoutThresholdAmount: e.target.value })} />
                    </div>
                  )}
                  <div className="team-controls-row">
                    <label>
                      <input type="checkbox" checked={controlsForm.requireDualControl} onChange={e => setControlsForm({ ...controlsForm, requireDualControl: e.target.checked })} />
                      {' '}Require Dual Control (2 approvers)
                    </label>
                  </div>
                </div>
              </div>

              <div className="team-controls-section td-section-gap">
                <div className="td-section-header-compact">
                  <h3 className="td-heading-flush">Custom Roles</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddRole(!showAddRole); setEditingRoleId(''); setRoleForm({ name: '', permissions: [] }); }}>
                    {showAddRole ? 'Cancel' : '+ Add Role'}
                  </button>
                </div>

                {rolesLoading ? <p>Loading custom roles...</p> : (
                  <div className="custom-roles-list">
                    {customRoles.map((role) => {
                      const inUse = activeMembers.some((m) => m.customRoleName === role.name);
                      return (
                        <div key={role._id} className="custom-role-row">
                          <div>
                            <div className="td-fw-semibold">{role.name}</div>
                            <div className="td-permissions-list">
                              {(role.permissions || []).map((perm) => (
                                <span key={perm} className="permission-badge">{permissionLabel(perm)}</span>
                              ))}
                            </div>
                          </div>
                          <div className="td-role-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => startEditRole(role)}>Edit</button>
                            <button className="btn btn-danger btn-sm" disabled={inUse} title={inUse ? 'Role is assigned to active members' : ''} onClick={() => deleteCustomRole(role)}>Delete</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {showAddRole && (
                  <form onSubmit={submitCustomRole} className="custom-role-form td-custom-role-form-gap">
                    <div className="team-controls-row">
                      <label>Role Name</label>
                      <input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} placeholder="e.g. Finance Reviewer" required />
                    </div>
                    <div className="permission-checkbox-grid">
                      {permissionOptions.map((p) => (
                        <label key={p.value} className="td-permission-label">
                          <input
                            type="checkbox"
                            checked={roleForm.permissions.includes(p.value)}
                            onChange={() => togglePermission(p.value)}
                          />
                          <span>{p.label}</span>
                        </label>
                      ))}
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm td-submit-gap">
                      {editingRoleId ? 'Update Role' : 'Create Role'}
                    </button>
                  </form>
                )}
              </div>

              <div className="team-controls-section td-section-gap">
                <div className="td-section-header-compact">
                  <h3 className="td-heading-flush">Linked Clients</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAddClient(!showAddClient)}>
                    {showAddClient ? 'Cancel' : '+ Add Client'}
                  </button>
                </div>

                {showAddClient && (
                  <form onSubmit={submitLinkedClient} className="custom-role-form td-client-form-gap">
                    <div className="team-controls-row">
                      <label>Client User ID</label>
                      <input value={clientForm.clientUserId} onChange={(e) => setClientForm({ ...clientForm, clientUserId: e.target.value })} placeholder="Paste client user id" required />
                    </div>
                    <div className="team-controls-row">
                      <label>Access Level</label>
                      <select value={clientForm.accessLevel} onChange={(e) => setClientForm({ ...clientForm, accessLevel: e.target.value })}>
                        <option value="view_assigned">View Assigned</option>
                        <option value="view_all">View All</option>
                        <option value="collaborate">Collaborate</option>
                      </select>
                    </div>
                    <div className="team-controls-row">
                      <label>Project Label</label>
                      <input value={clientForm.projectLabel} onChange={(e) => setClientForm({ ...clientForm, projectLabel: e.target.value })} placeholder="Optional project name" />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm">Link Client</button>
                  </form>
                )}

                {clientsLoading ? <p>Loading linked clients...</p> : (
                  <div className="linked-clients-list">
                    {clients.length === 0 && <p className="td-text-secondary">No linked clients yet.</p>}
                    {clients.map((c) => {
                      const cid = String(c.client?._id || c.client || c._id);
                      const label = c.accessLevel || 'view_assigned';
                      return (
                        <div key={c._id || cid} className="linked-client-row">
                          <div>
                            <div className="td-fw-semibold">{`${c.client?.firstName || ''} ${c.client?.lastName || ''}`.trim() || c.client?.email || cid}</div>
                            <div className="td-text-secondary-sm">{c.client?.email || ''}</div>
                          </div>
                          <span className={`access-level-badge access-${label}`}>{label}</span>
                          <div className="td-project-label">{c.projectLabel || '—'}</div>
                          <button className="btn btn-danger btn-sm" onClick={() => removeLinkedClient(cid)}>Remove</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button className="btn btn-primary td-save-controls-btn" onClick={saveControls} disabled={savingControls}>
                {savingControls ? 'Saving...' : 'Save Controls'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Audit tab */}
      {activeTab === 'audit' && isOwnerOrAdmin && (
        <div className="td-tab-content">
          <AuditSection
            logs={auditLogs}
            loading={auditLoading}
            error={auditError}
            onRefresh={fetchAuditLogs}
          />
        </div>
      )}

      <div className="td-danger-zone">
        <h4 className="td-danger-title">Danger Zone</h4>
        <p className="td-danger-desc">
          Deleting a team is permanent and cannot be undone.
        </p>
        <button
          className="btn btn-danger btn-sm"
          onClick={deleteTeam}
          disabled={!isOwner}
          title={isOwner ? 'Delete this team' : 'Only the team owner can delete'}
        >
          Delete Team
        </button>
      </div>
    </div>
  );
};

// Billing sub-component
const BillingSection = ({ teamId, canManage }) => {
  const [billing, setBilling] = useState(null);
  const [addAmount, setAddAmount] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest(`/api/teams/${teamId}/billing`)
      .then(setBilling)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teamId]);

  const addFunds = async () => {
    const amt = parseFloat(addAmount);
    if (!amt || amt < 5) return alert('Minimum $5');
    try {
      const data = await apiRequest(`/api/teams/${teamId}/billing/add-funds`, {
        method: 'POST', body: JSON.stringify({ amount: amt }),
      });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      alert(err.message || 'Failed');
    }
  };

  if (loading) return <p>Loading billing…</p>;

  return (
    <div>
      <div className="td-wallet-card">
        <div className="td-wallet-label">Team Wallet Balance</div>
        <div className="td-wallet-balance">${billing?.balance?.toFixed(2) || '0.00'}</div>
      </div>
      {canManage && (
        <div className="td-add-funds-row">
          <input type="number" min="5" max="500" step="5" placeholder="Amount ($5–$500)" value={addAmount}
            onChange={e => setAddAmount(e.target.value)}
            className="td-funds-input" />
          <button className="btn btn-primary btn-sm" onClick={addFunds}>Add Funds</button>
        </div>
      )}
      {billing?.credits?.length > 0 && (
        <div>
          <h4>Transaction History</h4>
          {billing.credits.slice(0, 20).map((c, i) => (
            <div key={i} className="td-transaction-row">
              <span>{c.reason || 'Credit'}</span>
              <span className="td-transaction-amount" style={{ color: c.remaining > 0 ? '#16a34a' : '#6b7280' }}>${c.amount?.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Assignments sub-component
const AssignmentsSection = ({ teamId, canAssign }) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest(`/api/teams/${teamId}/assignments`)
      .then(data => setAssignments(data.assignments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teamId]);

  if (loading) return <p>Loading assignments…</p>;

  return (
    <div>
      {assignments.length === 0 ? (
        <div className="td-empty-state-lg">
          <p>No active work assignments</p>
          {canAssign && <p className="td-empty-hint">Use the "Assign" feature on jobs to distribute work to team members.</p>}
        </div>
      ) : (
        <div className="td-card-list">
          {assignments.map(a => (
            <div key={a._id} className="td-card-row">
              <div>
                <div className="td-fw-semibold">{a.title}</div>
                <div className="td-text-secondary-sm">
                  Client: {a.client?.firstName} {a.client?.lastName} · {a.status}
                </div>
                {a.assignmentNote && <div className="td-assignment-note">📝 {a.assignmentNote}</div>}
              </div>
              <div className="td-text-right">
                <div className="td-assignee-name">{a.assignedTo?.firstName} {a.assignedTo?.lastName}</div>
                <div className="td-date-label">{a.assignedAt ? new Date(a.assignedAt).toLocaleDateString() : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ActivitySection = ({ teamId }) => {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest(`/api/teams/${teamId}/activity`)
      .then(data => setActivity(data.activity || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teamId]);

  if (loading) return <p>Loading activity…</p>;

  if (!activity.length) {
    return (
      <div className="td-empty-state">
        <p>No recent team activity yet</p>
      </div>
    );
  }

  return (
    <div className="td-card-list">
      {activity.map((item, idx) => (
        <div key={`${item.type}-${item.at}-${idx}`} className="td-card">
          <div className="td-card-title">{item.message}</div>
          <div className="td-timestamp">{new Date(item.at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
};

const AuditSection = ({ logs, loading, error, onRefresh }) => {
  if (loading) return <p>Loading audit logs…</p>;

  return (
    <div>
      <div className="td-section-header-compact">
        <h4 className="td-heading-flush">Audit Trail</h4>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}>Refresh</button>
      </div>
      {error && <p className="td-error-text">{error}</p>}
      {!logs?.length ? (
        <div className="td-empty-state">No audit events yet.</div>
      ) : (
        <div className="td-card-list">
          {logs.map((log) => (
            <div key={log._id} className="td-card">
              <div className="td-fw-semibold">{(log.action || '').replaceAll('_', ' ')}</div>
              <div className="td-audit-actor">
                By {log.actor?.firstName || 'User'} {log.actor?.lastName || ''} • {new Date(log.createdAt).toLocaleString()}
              </div>
              {log.targetUser && (
                <div className="td-audit-target">
                  Target: {log.targetUser?.firstName || ''} {log.targetUser?.lastName || ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamDetail;






