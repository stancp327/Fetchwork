import React, { useState, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './TeamSettings.css';

export default function TeamSettings({ teamId, team, onTeamUpdated, onTeamDeleted }) {
  const { user } = useAuth();
  const currentUserId = String(user?._id || user?.id || '');
  const currentUserRole = team?.currentUserRole;
  const isOwner = currentUserRole === 'owner';
  const canEdit = ['owner', 'admin'].includes(currentUserRole);

  // Edit form
  const [form, setForm] = useState({
    name: team?.name || '',
    description: team?.description || '',
    logo: team?.logo || '',
    website: team?.website || '',
    billingEmail: team?.billingEmail || '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Spend controls
  const [spendControls, setSpendControls] = useState({
    monthlyCapEnabled: team?.spendControls?.monthlyCapEnabled || false,
    monthlyCap: team?.spendControls?.monthlyCap || 0,
    alertThreshold: team?.spendControls?.alertThreshold ?? 0.8,
  });

  // Approval threshold
  const [approvalEnabled, setApprovalEnabled] = useState((team?.approvalThreshold || 0) > 0);
  const [approvalAmount, setApprovalAmount] = useState(team?.approvalThreshold || 0);

  // Transfer ownership
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Delete
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!canEdit || saving) return;
    setSaveError('');
    setSaveSuccess('');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        logo: form.logo.trim(),
        website: form.website.trim(),
        billingEmail: form.billingEmail.trim(),
        spendControls: {
          monthlyCapEnabled: spendControls.monthlyCapEnabled,
          monthlyCap: spendControls.monthlyCap,
          alertThreshold: spendControls.alertThreshold,
        },
        approvalThreshold: approvalEnabled ? approvalAmount : 0,
      };
      const data = await apiRequest(`/api/teams/${teamId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (data?.team && onTeamUpdated) onTeamUpdated(data.team);
      setSaveSuccess('Settings saved.');
    } catch (err) {
      setSaveError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferTarget || transferring) return;
    setTransferring(true);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId: transferTarget }),
      });
      if (data?.team && onTeamUpdated) onTeamUpdated(data.team);
      setShowTransfer(false);
      setTransferTarget('');
    } catch (err) {
      alert(err.message || 'Failed to transfer ownership');
    } finally {
      setTransferring(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmName !== team?.name || deleting) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/teams/${teamId}`, { method: 'DELETE' });
      if (onTeamDeleted) onTeamDeleted(teamId);
    } catch (err) {
      alert(err.message || 'Failed to delete team');
    } finally {
      setDeleting(false);
    }
  };

  const activeMembers = (team?.members || []).filter(m => m.status === 'active' && m.role !== 'owner');

  return (
    <div className="ts-root">
      {/* Profile section */}
      <section className="ts-section">
        <h2 className="ts-section-title">Team Profile</h2>

        <div className="ts-field">
          <label className="ts-label">Team Name</label>
          <input
            className="ts-input"
            type="text"
            maxLength={100}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            disabled={!canEdit}
          />
        </div>

        <div className="ts-field">
          <label className="ts-label">Description</label>
          <textarea
            className="ts-input"
            maxLength={1000}
            rows={3}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            disabled={!canEdit}
          />
        </div>

        <div className="ts-field">
          <label className="ts-label">Logo URL</label>
          <input
            className="ts-input"
            type="url"
            value={form.logo}
            onChange={e => setForm(f => ({ ...f, logo: e.target.value }))}
            disabled={!canEdit}
            placeholder="https://example.com/logo.png"
          />
          {form.logo && (
            <img src={form.logo} alt="Logo preview" className="ts-logo-preview" />
          )}
        </div>

        <div className="ts-field">
          <label className="ts-label">Website</label>
          <input
            className="ts-input"
            type="url"
            value={form.website}
            onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
            disabled={!canEdit}
            placeholder="https://yourteam.com"
          />
        </div>

        <div className="ts-field">
          <label className="ts-label">Billing Email</label>
          <input
            className="ts-input"
            type="email"
            value={form.billingEmail}
            onChange={e => setForm(f => ({ ...f, billingEmail: e.target.value }))}
            disabled={!canEdit}
          />
        </div>

        <div className="ts-field">
          <label className="ts-label">Team Type</label>
          <span className="ts-type-display">
            {team?.type === 'agency' ? 'Freelancer Agency' : 'Client Team'}
          </span>
        </div>
      </section>

      {/* Spend Controls */}
      <section className="ts-section">
        <h2 className="ts-section-title">Spend Controls</h2>

        <div className="ts-toggle-row">
          <label className="ts-toggle-label">
            <input
              type="checkbox"
              checked={spendControls.monthlyCapEnabled}
              onChange={e => setSpendControls(s => ({ ...s, monthlyCapEnabled: e.target.checked }))}
              disabled={!canEdit}
            />
            Enable monthly spending cap
          </label>
        </div>

        {spendControls.monthlyCapEnabled && (
          <>
            <div className="ts-field">
              <label className="ts-label">Monthly Cap ($)</label>
              <input
                className="ts-input"
                type="number"
                min={0}
                step="0.01"
                value={spendControls.monthlyCap}
                onChange={e => setSpendControls(s => ({ ...s, monthlyCap: Number(e.target.value) }))}
                disabled={!canEdit}
              />
            </div>
            <div className="ts-field">
              <label className="ts-label">Alert Threshold (%)</label>
              <input
                className="ts-input"
                type="number"
                min={0}
                max={100}
                step={5}
                value={Math.round(spendControls.alertThreshold * 100)}
                onChange={e => setSpendControls(s => ({ ...s, alertThreshold: Number(e.target.value) / 100 }))}
                disabled={!canEdit}
              />
            </div>
          </>
        )}
      </section>

      {/* Approval Threshold */}
      <section className="ts-section">
        <h2 className="ts-section-title">Approval Threshold</h2>

        <div className="ts-toggle-row">
          <label className="ts-toggle-label">
            <input
              type="checkbox"
              checked={approvalEnabled}
              onChange={e => setApprovalEnabled(e.target.checked)}
              disabled={!canEdit}
            />
            Require sign-off for orders above a threshold
          </label>
        </div>

        {approvalEnabled && (
          <div className="ts-field">
            <label className="ts-label">Amount ($)</label>
            <input
              className="ts-input"
              type="number"
              min={0}
              step="0.01"
              value={approvalAmount}
              onChange={e => setApprovalAmount(Number(e.target.value))}
              disabled={!canEdit}
            />
          </div>
        )}
      </section>

      {/* Save button */}
      {canEdit && (
        <div className="ts-save-row">
          {saveError && <p className="ts-error">{saveError}</p>}
          {saveSuccess && <p className="ts-success">{saveSuccess}</p>}
          <button className="ts-btn ts-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Danger Zone */}
      {isOwner && (
        <section className="ts-section ts-danger-zone">
          <h2 className="ts-section-title ts-danger-title">Danger Zone</h2>

          <div className="ts-danger-action">
            <div>
              <strong>Transfer Ownership</strong>
              <p className="ts-danger-desc">Transfer this team to another member.</p>
            </div>
            <button className="ts-btn ts-btn--danger-outline" onClick={() => setShowTransfer(true)}>
              Transfer
            </button>
          </div>

          <div className="ts-danger-action">
            <div>
              <strong>Delete Team</strong>
              <p className="ts-danger-desc">Permanently delete this team and all its data.</p>
            </div>
            <button className="ts-btn ts-btn--danger" onClick={() => setShowDelete(true)}>
              Delete
            </button>
          </div>
        </section>
      )}

      {/* Transfer modal */}
      {showTransfer && (
        <div className="ts-modal-backdrop" onClick={() => setShowTransfer(false)}>
          <div className="ts-modal" onClick={e => e.stopPropagation()}>
            <h3 className="ts-modal-title">Transfer Ownership</h3>
            <p className="ts-modal-desc">
              Select a team member to become the new owner. You will be demoted to admin.
            </p>
            <div className="ts-field">
              <label className="ts-label">New Owner</label>
              <select
                className="ts-input"
                value={transferTarget}
                onChange={e => setTransferTarget(e.target.value)}
              >
                <option value="">Select a member…</option>
                {activeMembers.map(m => {
                  const u = m.user || {};
                  const uid = String(u._id || u.id || m.user);
                  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Member';
                  return <option key={uid} value={uid}>{name} ({m.role})</option>;
                })}
              </select>
            </div>
            <div className="ts-modal-actions">
              <button className="ts-btn ts-btn--secondary" onClick={() => setShowTransfer(false)}>Cancel</button>
              <button className="ts-btn ts-btn--danger" disabled={!transferTarget || transferring} onClick={handleTransfer}>
                {transferring ? 'Transferring…' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDelete && (
        <div className="ts-modal-backdrop" onClick={() => setShowDelete(false)}>
          <div className="ts-modal" onClick={e => e.stopPropagation()}>
            <h3 className="ts-modal-title">Delete Team</h3>
            <p className="ts-modal-desc">
              This action is permanent. Type <strong>{team?.name}</strong> to confirm.
            </p>
            <div className="ts-field">
              <input
                className="ts-input"
                type="text"
                value={deleteConfirmName}
                onChange={e => setDeleteConfirmName(e.target.value)}
                placeholder="Type team name to confirm"
              />
            </div>
            <div className="ts-modal-actions">
              <button className="ts-btn ts-btn--secondary" onClick={() => { setShowDelete(false); setDeleteConfirmName(''); }}>Cancel</button>
              <button
                className="ts-btn ts-btn--danger"
                disabled={deleteConfirmName !== team?.name || deleting}
                onClick={handleDelete}
              >
                {deleting ? 'Deleting…' : 'Delete Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
