import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';

const ROLE_OPTIONS = [
  { value: 'designer',  label: 'Designer',  color: 'var(--color-danger)' },
  { value: 'developer', label: 'Developer', color: 'var(--color-primary)' },
  { value: 'reviewer',  label: 'Reviewer',  color: 'var(--color-accent)' },
  { value: 'pm',        label: 'PM',        color: 'var(--color-warning)' },
  { value: 'writer',    label: 'Writer',    color: 'var(--color-success)' },
  { value: 'other',     label: 'Other',     color: 'var(--color-text-secondary)' },
];
const ROLE_MAP = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r]));

export default function RoleAssignment({ teamId, jobId, teamMembers = [] }) {
  const [roles, setRoles] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerId, setPickerId] = useState('');
  const [pickerRole, setPickerRole] = useState('developer');

  const load = useCallback(async () => {
    try {
      const res = await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/roles`);
      setRoles(res.roles || []);
    } catch { /* silent */ }
  }, [teamId, jobId]);

  useEffect(() => { load(); }, [load]);

  const saveRoles = async (newRoles) => {
    const payload = newRoles.map(r => ({
      userId: r.user?._id || r.user,
      role: r.role,
      customRole: r.customRole || '',
    }));
    try {
      const res = await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roles: payload }),
      });
      setRoles(res.roles || []);
    } catch (err) { alert(err.message || 'Failed to save roles'); }
  };

  const addRole = () => {
    if (!pickerId) return;
    const member = teamMembers.find(m => m._id === pickerId);
    if (!member) return;
    const updated = [...roles.filter(r => (r.user?._id || r.user) !== pickerId), { user: member, role: pickerRole }];
    saveRoles(updated);
    setShowPicker(false);
    setPickerId('');
  };

  const removeRole = (userId) => {
    const updated = roles.filter(r => (r.user?._id || r.user) !== userId);
    saveRoles(updated);
  };

  return (
    <div className="ra-panel">
      <div className="ra-row">
        <span className="ra-label">Roles:</span>
        <div className="ra-pills">
          {roles.map(r => {
            const info = ROLE_MAP[r.role] || ROLE_MAP.other;
            const name = r.user?.firstName || '?';
            return (
              <span key={r.user?._id || r._id} className="ra-pill" style={{ borderColor: info.color }}>
                <span className="ra-pill-name">{name}</span>
                <span className="ra-pill-role" style={{ background: info.color }}>{info.label}</span>
                <button className="ra-pill-x" onClick={() => removeRole(r.user?._id)} title="Remove">×</button>
              </span>
            );
          })}
          <button className="ra-add-btn" onClick={() => setShowPicker(!showPicker)}>+ Role</button>
        </div>
      </div>
      {showPicker && (
        <div className="ra-picker">
          <select value={pickerId} onChange={(e) => setPickerId(e.target.value)}>
            <option value="">Select member</option>
            {teamMembers.map(m => (
              <option key={m._id} value={m._id}>{m.firstName} {m.lastName}</option>
            ))}
          </select>
          <select value={pickerRole} onChange={(e) => setPickerRole(e.target.value)}>
            {ROLE_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button className="ra-picker-save" onClick={addRole}>Add</button>
        </div>
      )}
    </div>
  );
}
