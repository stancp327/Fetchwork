import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import { formatBudget } from '../../utils/formatters';
import './AdminDisputeDetail.css';

const STATUS_LABELS = {
  opened: 'Open', needs_info: 'Info Needed', under_review: 'Under Review',
  escalated: 'Escalated', proposed_resolution: 'Resolution Proposed',
  resolved: 'Resolved', closed: 'Closed'
};

const REASON_LABELS = {
  non_delivery: 'Non-Delivery', quality_issues: 'Quality Issues',
  missed_deadline: 'Missed Deadline', payment_fraud: 'Payment Fraud',
  scope_creep: 'Scope Creep', abusive_communication: 'Abusive Communication', other: 'Other'
};

const VALID_TRANSITIONS = {
  'opened': ['needs_info', 'under_review', 'escalated', 'closed'],
  'needs_info': ['under_review', 'escalated', 'closed'],
  'under_review': ['needs_info', 'escalated', 'proposed_resolution', 'resolved', 'closed'],
  'escalated': ['under_review', 'proposed_resolution', 'resolved', 'closed'],
  'proposed_resolution': ['under_review', 'resolved', 'closed'],
  'resolved': ['closed'],
  'closed': []
};

const timeAgo = (date) => {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── Tab: Overview ───────────────────────────────────────────────
const OverviewTab = ({ dispute, onStatusChange, onHoldToggle }) => {
  const nextStatuses = VALID_TRANSITIONS[dispute.status] || [];

  return (
    <div className="tab-content">
      <div className="detail-grid">
        <div className="detail-card">
          <h4>Dispute Info</h4>
          <div className="info-rows">
            <div className="info-row"><span className="label">ID</span><span className="value">{dispute._id}</span></div>
            <div className="info-row"><span className="label">Status</span><span className={`status-pill status-${dispute.status}`}>{STATUS_LABELS[dispute.status]}</span></div>
            <div className="info-row"><span className="label">Reason</span><span className="value">{REASON_LABELS[dispute.reason]}</span></div>
            <div className="info-row"><span className="label">Filed</span><span className="value">{timeAgo(dispute.createdAt)}</span></div>
            <div className="info-row"><span className="label">Payout Hold</span><span className={`hold-badge ${dispute.payoutHold ? 'held' : 'released'}`}>{dispute.payoutHold ? '🔒 Held' : '✅ Released'}</span></div>
            <div className="info-row"><span className="label">Escrow</span><span className="value">${dispute.escrowAmount || 0}</span></div>
            {dispute.deadline && <div className="info-row"><span className="label">Deadline</span><span className="value">{new Date(dispute.deadline).toLocaleDateString()}</span></div>}
          </div>
        </div>

        <div className="detail-card">
          <h4>Parties</h4>
          <div className="party-section">
            <div className="party">
              <span className="party-role">Client</span>
              <span className="party-name">{dispute.client?.firstName} {dispute.client?.lastName}</span>
              <span className="party-email">{dispute.client?.email}</span>
              {dispute.filedBy?._id === dispute.client?._id && <span className="filed-badge">Filed dispute</span>}
            </div>
            <div className="party">
              <span className="party-role">Freelancer</span>
              <span className="party-name">{dispute.freelancer?.firstName} {dispute.freelancer?.lastName}</span>
              <span className="party-email">{dispute.freelancer?.email}</span>
              {dispute.filedBy?._id === dispute.freelancer?._id && <span className="filed-badge">Filed dispute</span>}
            </div>
          </div>
        </div>

        <div className="detail-card full-width">
          <h4>Job</h4>
          <div className="info-rows">
            <div className="info-row"><span className="label">Title</span><span className="value">{dispute.job?.title}</span></div>
            <div className="info-row"><span className="label">Budget</span><span className="value">{formatBudget(dispute.job?.budget)}</span></div>
            <div className="info-row"><span className="label">Status</span><span className="value">{dispute.job?.status}</span></div>
          </div>
        </div>

        <div className="detail-card full-width">
          <h4>Description</h4>
          <p className="description-text">{dispute.description}</p>
        </div>
      </div>

      {dispute.resolution?.type && (
        <div className="detail-card full-width resolution-card">
          <h4>Resolution</h4>
          <div className="info-rows">
            <div className="info-row"><span className="label">Type</span><span className="value">{dispute.resolution.type.replace(/_/g, ' ')}</span></div>
            {dispute.resolution.amounts?.toFreelancer > 0 && <div className="info-row"><span className="label">To Freelancer</span><span className="value">${dispute.resolution.amounts.toFreelancer}</span></div>}
            {dispute.resolution.amounts?.toClient > 0 && <div className="info-row"><span className="label">To Client</span><span className="value">${dispute.resolution.amounts.toClient}</span></div>}
            {dispute.resolution.summary && <div className="info-row full"><span className="label">Summary</span><p className="value">{dispute.resolution.summary}</p></div>}
          </div>
        </div>
      )}

      <div className="actions-bar">
        <div className="status-actions">
          <span className="actions-label">Move to:</span>
          {nextStatuses.map(s => (
            <button key={s} className={`status-action-btn status-${s}`} onClick={() => onStatusChange(s)}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <button className={`hold-toggle-btn ${dispute.payoutHold ? 'release' : 'hold'}`} onClick={() => onHoldToggle(!dispute.payoutHold)}>
          {dispute.payoutHold ? '🔓 Release Hold' : '🔒 Enable Hold'}
        </button>
      </div>
    </div>
  );
};

// ── Tab: Messages ───────────────────────────────────────────────
const MessagesTab = ({ dispute, onSendMessage }) => {
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState('all');

  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message, visibility);
    setMessage('');
  };

  return (
    <div className="tab-content">
      <div className="messages-thread">
        {(dispute.messages || []).map((msg, idx) => (
          <div key={idx} className={`message-bubble ${msg.senderRole}`}>
            <div className="message-header">
              <span className="sender-name">{msg.sender?.firstName} {msg.sender?.lastName}</span>
              <span className={`role-badge ${msg.senderRole}`}>{msg.senderRole}</span>
              {msg.visibility !== 'all' && <span className="visibility-badge">{msg.visibility.replace('_', ' ')}</span>}
              {msg.isInternal && <span className="internal-badge">Internal</span>}
              <span className="message-time">{timeAgo(msg.createdAt)}</span>
            </div>
            <div className="message-body">{msg.message}</div>
          </div>
        ))}
      </div>

      <div className="message-composer">
        <div className="composer-controls">
          <select value={visibility} onChange={e => setVisibility(e.target.value)} className="visibility-select">
            <option value="all">To Both Parties</option>
            <option value="client_only">To Client Only</option>
            <option value="freelancer_only">To Freelancer Only</option>
            <option value="admin_only">Internal Note</option>
          </select>
        </div>
        <div className="composer-input">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your message..."
            rows={3}
          />
          <button className="send-btn" onClick={handleSend} disabled={!message.trim()}>Send</button>
        </div>
      </div>
    </div>
  );
};

// ── Tab: Files / Evidence ───────────────────────────────────────
const FilesTab = ({ dispute }) => (
  <div className="tab-content">
    {(dispute.evidence || []).length === 0 ? (
      <div className="empty-tab"><p>No evidence files uploaded yet.</p></div>
    ) : (
      <div className="files-grid">
        {dispute.evidence.map((file, idx) => (
          <div key={idx} className="file-card">
            <div className="file-icon">{file.mimeType?.startsWith('image/') ? '🖼️' : file.mimeType === 'application/pdf' ? '📄' : '📎'}</div>
            <div className="file-info">
              <div className="file-name">{file.filename}</div>
              <div className="file-meta">
                Uploaded by {file.uploadedBy?.firstName} {file.uploadedBy?.lastName} • {timeAgo(file.createdAt)}
                {file.watermarked && <span className="watermark-badge">Watermarked</span>}
                {file.isFinalDeliverable && <span className="final-badge">Final Deliverable</span>}
              </div>
            </div>
            <div className="file-actions">
              {file.watermarkedUrl && <a href={file.watermarkedUrl} target="_blank" rel="noopener noreferrer" className="file-btn">View</a>}
              {file.originalUrl && <a href={file.originalUrl} target="_blank" rel="noopener noreferrer" className="file-btn original">Original</a>}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── Tab: Financials ─────────────────────────────────────────────
const FinancialsTab = ({ dispute }) => (
  <div className="tab-content">
    <div className="financial-summary">
      <div className="fin-stat"><span className="fin-label">Escrow Amount</span><span className="fin-value">${dispute.escrowAmount || 0}</span></div>
      <div className="fin-stat"><span className="fin-label">Payout Hold</span><span className={`fin-value ${dispute.payoutHold ? 'held' : 'released'}`}>{dispute.payoutHold ? 'Active' : 'Released'}</span></div>
      {dispute.resolution?.amounts && (
        <>
          <div className="fin-stat"><span className="fin-label">To Freelancer</span><span className="fin-value">${dispute.resolution.amounts.toFreelancer || 0}</span></div>
          <div className="fin-stat"><span className="fin-label">To Client</span><span className="fin-value">${dispute.resolution.amounts.toClient || 0}</span></div>
          <div className="fin-stat"><span className="fin-label">Admin Fee</span><span className="fin-value">${dispute.resolution.amounts.adminFee || 0}</span></div>
        </>
      )}
    </div>

    <h4>Financial Actions</h4>
    {(dispute.financialActions || []).length === 0 ? (
      <div className="empty-tab"><p>No financial actions recorded yet.</p></div>
    ) : (
      <div className="financial-timeline">
        {dispute.financialActions.map((action, idx) => (
          <div key={idx} className={`fin-action ${action.status}`}>
            <div className="fin-action-header">
              <span className="fin-action-type">{action.type.replace(/_/g, ' ')}</span>
              <span className={`fin-action-status ${action.status}`}>{action.status}</span>
              <span className="fin-action-time">{timeAgo(action.createdAt)}</span>
            </div>
            <div className="fin-action-details">
              {action.amountToFreelancer > 0 && <span>→ Freelancer: ${action.amountToFreelancer}</span>}
              {action.amountToClient > 0 && <span>→ Client: ${action.amountToClient}</span>}
              {action.notes && <p className="fin-action-notes">{action.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── Tab: Audit Log ──────────────────────────────────────────────
const AuditTab = ({ auditLog }) => (
  <div className="tab-content">
    {(auditLog || []).length === 0 ? (
      <div className="empty-tab"><p>No audit entries yet.</p></div>
    ) : (
      <div className="audit-timeline">
        {auditLog.map((entry, idx) => (
          <div key={idx} className="audit-entry">
            <div className="audit-dot" />
            <div className="audit-content">
              <div className="audit-header">
                <span className="audit-action">{entry.action.replace(/_/g, ' ')}</span>
                <span className="audit-actor">{entry.actor?.firstName} {entry.actor?.lastName} ({entry.actorRole})</span>
                <span className="audit-time">{timeAgo(entry.createdAt)}</span>
              </div>
              {entry.metadata?.fromStatus && (
                <div className="audit-detail">Status: {entry.metadata.fromStatus} → {entry.metadata.toStatus}</div>
              )}
              {entry.metadata?.notes && <div className="audit-detail">{entry.metadata.notes}</div>}
              {entry.metadata?.amount && <div className="audit-detail">Amount: ${entry.metadata.amount}</div>}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── Tab: Admin Notes ────────────────────────────────────────────
const NotesTab = ({ dispute, onAddNote }) => {
  const [note, setNote] = useState('');

  const handleAdd = () => {
    if (!note.trim()) return;
    onAddNote(note);
    setNote('');
  };

  return (
    <div className="tab-content">
      <div className="notes-list">
        {(dispute.adminNotes || []).map((n, idx) => (
          <div key={idx} className="note-card">
            <div className="note-header">
              <span className="note-author">{n.author?.firstName} {n.author?.lastName}</span>
              <span className="note-time">{timeAgo(n.createdAt)}</span>
            </div>
            <div className="note-body">{n.content}</div>
          </div>
        ))}
      </div>
      <div className="note-composer">
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add internal note..." rows={3} />
        <button onClick={handleAdd} disabled={!note.trim()}>Add Note</button>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════
const AdminDisputeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dispute, setDispute] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchDispute = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/disputes/admin/${id}`);
      setDispute(data.dispute);
      setAuditLog(data.auditLog || []);
    } catch (err) {
      setError(err.message || 'Failed to load dispute');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDispute(); }, [fetchDispute]);

  const handleStatusChange = async (newStatus) => {
    try {
      await apiRequest(`/api/disputes/admin/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      fetchDispute();
    } catch (err) {
      alert('Failed to change status: ' + err.message);
    }
  };

  const handleHoldToggle = async (hold) => {
    try {
      await apiRequest(`/api/disputes/admin/${id}/hold`, {
        method: 'PATCH',
        body: JSON.stringify({ hold })
      });
      fetchDispute();
    } catch (err) {
      alert('Failed to toggle hold: ' + err.message);
    }
  };

  const handleSendMessage = async (message, visibility) => {
    try {
      await apiRequest(`/api/disputes/admin/${id}/message`, {
        method: 'POST',
        body: JSON.stringify({ message, visibility, isInternal: visibility === 'admin_only' })
      });
      fetchDispute();
    } catch (err) {
      alert('Failed to send message: ' + err.message);
    }
  };

  const handleAddNote = async (content) => {
    try {
      await apiRequest(`/api/disputes/admin/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      fetchDispute();
    } catch (err) {
      alert('Failed to add note: ' + err.message);
    }
  };

  if (loading) return <div className="add-loading"><div className="spinner" /><p>Loading dispute...</p></div>;
  if (error) return <div className="add-error"><h2>Error</h2><p>{error}</p><button onClick={() => navigate('/admin')}>Back to Admin</button></div>;
  if (!dispute) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'messages', label: 'Messages', icon: '💬', count: dispute.messages?.length },
    { id: 'files', label: 'Files', icon: '📁', count: dispute.evidence?.length },
    { id: 'financials', label: 'Financials', icon: '💰' },
    { id: 'audit', label: 'Audit Log', icon: '📜', count: auditLog?.length },
    { id: 'notes', label: 'Admin Notes', icon: '📝', count: dispute.adminNotes?.length }
  ];

  return (
    <div className="add-page">
      <div className="add-header">
        <button className="add-back" onClick={() => navigate('/admin')}>← Back to Admin</button>
        <div className="add-title-row">
          <h1>Dispute: {dispute.job?.title || 'Unknown Job'}</h1>
          <span className={`status-pill large status-${dispute.status}`}>{STATUS_LABELS[dispute.status]}</span>
        </div>
        <div className="add-meta">
          <span>{REASON_LABELS[dispute.reason]}</span>
          <span>•</span>
          <span>Filed {timeAgo(dispute.createdAt)}</span>
          <span>•</span>
          <span>{dispute.payoutHold ? '🔒 Hold Active' : '✅ No Hold'}</span>
          <span>•</span>
          <span>Escrow: ${dispute.escrowAmount || 0}</span>
        </div>
      </div>

      <div className="add-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`add-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
            {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="add-body">
        {activeTab === 'overview' && <OverviewTab dispute={dispute} onStatusChange={handleStatusChange} onHoldToggle={handleHoldToggle} />}
        {activeTab === 'messages' && <MessagesTab dispute={dispute} onSendMessage={handleSendMessage} />}
        {activeTab === 'files' && <FilesTab dispute={dispute} />}
        {activeTab === 'financials' && <FinancialsTab dispute={dispute} />}
        {activeTab === 'audit' && <AuditTab auditLog={auditLog} />}
        {activeTab === 'notes' && <NotesTab dispute={dispute} onAddNote={handleAddNote} />}
      </div>
    </div>
  );
};

export default AdminDisputeDetail;
