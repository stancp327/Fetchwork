import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import './CustomRoleBuilder.css';

const ALL_PERMISSIONS = [
  { key: 'manage_members', label: 'Manage Members', desc: 'Invite, remove, and change member roles' },
  { key: 'manage_billing', label: 'Manage Billing', desc: 'Add funds, view billing, set spend controls' },
  { key: 'approve_orders', label: 'Approve Orders', desc: 'Approve orders above the threshold' },
  { key: 'create_jobs', label: 'Create Jobs', desc: 'Post jobs on behalf of the team' },
  { key: 'manage_services', label: 'Manage Services', desc: 'Create and edit team services' },
  { key: 'view_analytics', label: 'View Analytics', desc: 'Access team dashboard and reports' },
  { key: 'message_clients', label: 'Message Clients', desc: 'Message clients on behalf of the team' },
  { key: 'assign_work', label: 'Assign Work', desc: 'Assign jobs and orders to team members' },
];

export default function CustomRoleBuilder({ team, currentUserRole, onTeamUpdated }) {
  const [editingRole, setEditingRole] = useState(null); // null | 'new' | role index
  const [roleName, setRoleName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const isOwnerOrAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';
  const customRoles = team?.customRoles || [];

  const membersUsingRole = (roleName) =>
    (team?.members || []).filter(m => m.status === 'active' && m.customRoleName === roleName).length;

  const togglePerm = (key) => {
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const openCreate = () => {
    setEditingRole('new');
    setRoleName('');
    setSelectedPerms(new Set());
    setError('');
  };

  const openEdit = (idx) => {
    const role = customRoles[idx];
    setEditingRole(idx);
    setRoleName(role.name);
    setSelectedPerms(new Set(role.permissions || []));
    setError('');
  };

  const cancel = () => {
    setEditingRole(null);
    setRoleName('');
    setSelectedPerms(new Set());
    setError('');
  };

  const saveRole = async () => {
    if (!roleName.trim()) {
      setError('Role name is required');
      return;
    }
    if (selectedPerms.size === 0) {
      setError('Select at least one permission');
      return;
    }

    const updatedRoles = [...customRoles];
    const roleData = { name: roleName.trim(), permissions: [...selectedPerms] };

    if (editingRole === 'new') {
      // Check duplicate name
      if (updatedRoles.some(r => r.name.toLowerCase() === roleData.name.toLowerCase())) {
        setError('A role with this name already exists');
        return;
      }
      updatedRoles.push(roleData);
    } else {
      // Preserve createdAt
      roleData.createdAt = updatedRoles[editingRole]?.createdAt;
      updatedRoles[editingRole] = roleData;
    }

    setSaving(true);
    setError('');
    try {
      const res = await apiRequest(`/api/teams/${team._id}`, {
        method: 'PUT',
        body: JSON.stringify({ customRoles: updatedRoles }),
      });
      setSuccess(editingRole === 'new' ? 'Role created' : 'Role updated');
      setEditingRole(null);
      setRoleName('');
      setSelectedPerms(new Set());
      if (onTeamUpdated) onTeamUpdated(res.team || res);
    } catch (err) {
      setError(err.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (idx) => {
    const updatedRoles = customRoles.filter((_, i) => i !== idx);
    setSaving(true);
    setError('');
    try {
      const res = await apiRequest(`/api/teams/${team._id}`, {
        method: 'PUT',
        body: JSON.stringify({ customRoles: updatedRoles }),
      });
      setSuccess('Role deleted');
      setConfirmDelete(null);
      if (onTeamUpdated) onTeamUpdated(res.team || res);
    } catch (err) {
      setError(err.message || 'Failed to delete role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="crb-root">
      <div className="crb-header">
        <h3 className="crb-title">Custom Roles</h3>
        {isOwnerOrAdmin && editingRole === null && (
          <button className="crb-btn crb-btn--primary" onClick={openCreate}>Create Role</button>
        )}
      </div>

      {error && <div className="crb-error">{error}</div>}
      {success && <div className="crb-success">{success}</div>}

      {/* Editor */}
      {editingRole !== null && (
        <div className="crb-editor">
          <h4 className="crb-editor-title">{editingRole === 'new' ? 'New Role' : 'Edit Role'}</h4>
          <label className="crb-label">
            Role Name
            <input
              className="crb-input"
              value={roleName}
              onChange={e => setRoleName(e.target.value)}
              placeholder="e.g. Project Lead"
              maxLength={50}
            />
          </label>
          <div className="crb-perms-section">
            <p className="crb-perms-label">Permissions</p>
            <div className="crb-perms-grid">
              {ALL_PERMISSIONS.map(p => (
                <label key={p.key} className="crb-perm-item">
                  <input
                    type="checkbox"
                    className="crb-checkbox"
                    checked={selectedPerms.has(p.key)}
                    onChange={() => togglePerm(p.key)}
                  />
                  <div className="crb-perm-info">
                    <span className="crb-perm-name">{p.label}</span>
                    <span className="crb-perm-desc">{p.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="crb-editor-actions">
            <button className="crb-btn crb-btn--primary" onClick={saveRole} disabled={saving}>
              {saving ? 'Saving...' : 'Save Role'}
            </button>
            <button className="crb-btn crb-btn--secondary" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {/* Role list */}
      {customRoles.length === 0 && editingRole === null ? (
        <div className="crb-empty">No custom roles yet. Create one to define granular permissions for team members.</div>
      ) : (
        <ul className="crb-role-list">
          {customRoles.map((role, idx) => {
            const inUse = membersUsingRole(role.name);
            return (
              <li key={idx} className="crb-role-card">
                <div className="crb-role-header">
                  <h4 className="crb-role-name">{role.name}</h4>
                  {inUse > 0 && (
                    <span className="crb-in-use">{inUse} member{inUse !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="crb-chips">
                  {(role.permissions || []).map(p => (
                    <span key={p} className="crb-chip">{ALL_PERMISSIONS.find(ap => ap.key === p)?.label || p}</span>
                  ))}
                </div>
                {isOwnerOrAdmin && (
                  <div className="crb-role-actions">
                    <button className="crb-btn crb-btn--secondary crb-btn--sm" onClick={() => openEdit(idx)}>Edit</button>
                    {confirmDelete === idx ? (
                      <span className="crb-confirm-delete">
                        {inUse > 0 && <span className="crb-delete-warn">{inUse} member{inUse !== 1 ? 's' : ''} use this role!</span>}
                        <button className="crb-btn crb-btn--danger crb-btn--sm" onClick={() => deleteRole(idx)} disabled={saving}>Confirm</button>
                        <button className="crb-btn crb-btn--secondary crb-btn--sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </span>
                    ) : (
                      <button className="crb-btn crb-btn--danger-outline crb-btn--sm" onClick={() => setConfirmDelete(idx)}>Delete</button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
