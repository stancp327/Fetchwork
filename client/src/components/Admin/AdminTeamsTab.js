import React, { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './AdminTeamsTab.css';

const FILTERS = ['all', 'active', 'suspended', 'flagged'];
const TABS = ['Overview', 'Members', 'Tasks', 'Payouts'];

const AdminTeamsTab = () => {
  // ── List state ──
  const [teams, setTeams] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // ── Detail state ──
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [detailTab, setDetailTab] = useState('Overview');
  const [detailData, setDetailData] = useState(null);
  const [tasks, setTasks] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [payouts, setPayouts] = useState({ items: [], total: 0, page: 1, pages: 1 });

  // ── Modal state ──
  const [modal, setModal] = useState(null); // 'suspend' | 'transfer' | 'delete' | null
  const [modalReason, setModalReason] = useState('');
  const [modalNewOwner, setModalNewOwner] = useState('');
  const [modalDeleteConfirm, setModalDeleteConfirm] = useState('');
  const [modalBusy, setModalBusy] = useState(false);

  // ── Fetch teams list ──
  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: perPage };
      if (search) params.search = search;
      if (filter !== 'all') params.filter = filter;
      const data = await apiRequest('/api/admin/teams', { params });
      setTeams(data.teams || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, filter]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  // ── Debounced search ──
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Fetch team detail ──
  const fetchDetail = useCallback(async (teamId) => {
    try {
      const data = await apiRequest(`/api/admin/teams/${teamId}`);
      setDetailData(data);
    } catch (err) {
      console.error('Failed to load team detail:', err);
    }
  }, []);

  const fetchTasks = useCallback(async (teamId, pg = 1) => {
    try {
      const data = await apiRequest(`/api/admin/teams/${teamId}/tasks`, { params: { page: pg, limit: 20 } });
      setTasks({ items: data.tasks || [], total: data.total || 0, page: data.page || 1, pages: data.pages || 1 });
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }, []);

  const fetchPayouts = useCallback(async (teamId, pg = 1) => {
    try {
      const data = await apiRequest(`/api/admin/teams/${teamId}/payouts`, { params: { page: pg, limit: 20 } });
      setPayouts({ items: data.payouts || [], total: data.total || 0, page: data.page || 1, pages: data.pages || 1 });
    } catch (err) {
      console.error('Failed to load payouts:', err);
    }
  }, []);

  const openDetail = (team) => {
    setSelectedTeam(team);
    setDetailTab('Overview');
    fetchDetail(team._id);
    fetchTasks(team._id);
    fetchPayouts(team._id);
  };

  // ── Actions ──
  const handleSuspend = async () => {
    if (!selectedTeam) return;
    setModalBusy(true);
    try {
      await apiRequest(`/api/admin/teams/${selectedTeam._id}/suspend`, {
        method: 'PUT', body: JSON.stringify({ reason: modalReason }),
        headers: { 'Content-Type': 'application/json' },
      });
      setModal(null); setModalReason('');
      fetchDetail(selectedTeam._id);
      fetchTeams();
    } catch (err) { alert('Failed to suspend: ' + err.message); }
    finally { setModalBusy(false); }
  };

  const handleReinstate = async () => {
    if (!selectedTeam || !window.confirm('Reinstate this team?')) return;
    try {
      await apiRequest(`/api/admin/teams/${selectedTeam._id}/reinstate`, { method: 'PUT' });
      fetchDetail(selectedTeam._id);
      fetchTeams();
    } catch (err) { alert('Failed to reinstate: ' + err.message); }
  };

  const handleFlag = async () => {
    if (!selectedTeam) return;
    const isFlagging = !detailData?.team?.flagged;
    const reason = isFlagging ? prompt('Flag reason (optional):') || '' : '';
    try {
      await apiRequest(`/api/admin/teams/${selectedTeam._id}/flag`, {
        method: 'PUT', body: JSON.stringify({ flagReason: reason }),
        headers: { 'Content-Type': 'application/json' },
      });
      fetchDetail(selectedTeam._id);
      fetchTeams();
    } catch (err) { alert('Failed to toggle flag: ' + err.message); }
  };

  const handleTransfer = async () => {
    if (!modalNewOwner) return;
    setModalBusy(true);
    try {
      await apiRequest(`/api/admin/teams/${selectedTeam._id}/transfer`, {
        method: 'PUT', body: JSON.stringify({ newOwnerId: modalNewOwner }),
        headers: { 'Content-Type': 'application/json' },
      });
      setModal(null); setModalNewOwner('');
      fetchDetail(selectedTeam._id);
      fetchTeams();
    } catch (err) { alert('Failed to transfer: ' + err.message); }
    finally { setModalBusy(false); }
  };

  const handleDelete = async () => {
    setModalBusy(true);
    try {
      await apiRequest(`/api/admin/teams/${selectedTeam._id}`, {
        method: 'DELETE', body: JSON.stringify({ confirm: true }),
        headers: { 'Content-Type': 'application/json' },
      });
      setModal(null); setModalDeleteConfirm('');
      setSelectedTeam(null); setDetailData(null);
      fetchTeams();
    } catch (err) { alert('Failed to delete: ' + err.message); }
    finally { setModalBusy(false); }
  };

  const handleRemoveMember = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from this team?`)) return;
    try {
      await apiRequest(`/api/admin/teams/${selectedTeam._id}/members/${userId}`, { method: 'DELETE' });
      fetchDetail(selectedTeam._id);
    } catch (err) { alert('Failed to remove: ' + err.message); }
  };

  // ── Render helpers ──
  const teamStatus = (t) => {
    if (!t.isActive) return 'suspended';
    if (t.flagged) return 'flagged';
    return 'active';
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';
  const fmtMoney = (n) => `$${(n || 0).toFixed(2)}`;

  // ════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ════════════════════════════════════════════════════════════════
  if (selectedTeam && detailData) {
    const t = detailData.team;
    const activeMembers = (t.members || []).filter(m => m.status === 'active');

    return (
      <div className="att-detail">
        {/* Header */}
        <div className="att-detail-header">
          <button className="att-back-btn" onClick={() => { setSelectedTeam(null); setDetailData(null); }}>
            ← Back to teams
          </button>
          <div className="att-detail-title">
            <h2>{t.name}</h2>
            <span className="att-badge" data-type={t.type}>{t.type === 'agency' ? 'Agency' : 'Client Team'}</span>
            <span className="att-badge" data-status={teamStatus(t)}>
              {teamStatus(t) === 'suspended' ? '⏸️ Suspended' : teamStatus(t) === 'flagged' ? '🚩 Flagged' : '✅ Active'}
            </span>
          </div>
          <div className="att-actions">
            {t.isActive ? (
              <button className="att-action-btn" onClick={() => { setModal('suspend'); setModalReason(''); }}>⏸️ Suspend</button>
            ) : (
              <button className="att-action-btn" onClick={handleReinstate}>▶️ Reinstate</button>
            )}
            <button className="att-action-btn" onClick={handleFlag}>
              {t.flagged ? '🏳️ Unflag' : '🚩 Flag'}
            </button>
            <button className="att-action-btn" onClick={() => { setModal('transfer'); setModalNewOwner(''); }}>🔄 Transfer</button>
            <button className="att-action-btn danger" onClick={() => { setModal('delete'); setModalDeleteConfirm(''); }}>🗑️ Delete</button>
          </div>
        </div>

        {/* Stats row */}
        <div className="att-stats-grid" style={{ marginBottom: 'var(--space-md)' }}>
          <div className="att-stat-card">
            <div className="att-stat-value">{activeMembers.length}</div>
            <div className="att-stat-label">Members</div>
          </div>
          <div className="att-stat-card">
            <div className="att-stat-value">{detailData.taskCount}</div>
            <div className="att-stat-label">Tasks</div>
          </div>
          <div className="att-stat-card">
            <div className="att-stat-value">{fmtMoney(detailData.payoutTotal)}</div>
            <div className="att-stat-label">Total Payouts</div>
          </div>
          <div className="att-stat-card">
            <div className="att-stat-value">{fmtMoney(detailData.walletBalance)}</div>
            <div className="att-stat-label">Wallet</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="att-tabs">
          {TABS.map(tab => (
            <button key={tab} className={`att-tab${detailTab === tab ? ' active' : ''}`} onClick={() => setDetailTab(tab)}>
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {detailTab === 'Overview' && (
          <div className="att-overview">
            <div className="att-overview-section">
              <h3>Details</h3>
              <div className="att-field-row"><span className="att-field-label">Owner</span><span className="att-field-value">{t.owner?.firstName} {t.owner?.lastName}</span></div>
              <div className="att-field-row"><span className="att-field-label">Email</span><span className="att-field-value">{t.owner?.email}</span></div>
              <div className="att-field-row"><span className="att-field-label">Created</span><span className="att-field-value">{fmtDate(t.createdAt)}</span></div>
              <div className="att-field-row"><span className="att-field-label">Slug</span><span className="att-field-value">{t.slug}</span></div>
              {t.description && <div className="att-field-row"><span className="att-field-label">Description</span><span className="att-field-value">{t.description}</span></div>}
              {t.website && <div className="att-field-row"><span className="att-field-label">Website</span><span className="att-field-value">{t.website}</span></div>}
            </div>
            <div className="att-overview-section">
              <h3>Settings</h3>
              <div className="att-field-row"><span className="att-field-label">Public</span><span className="att-field-value">{t.isPublic ? 'Yes' : 'No'}</span></div>
              <div className="att-field-row"><span className="att-field-label">Outsourcing</span><span className="att-field-value">{t.outsourcingEnabled ? 'Enabled' : 'Disabled'}</span></div>
              <div className="att-field-row"><span className="att-field-label">Approval Threshold</span><span className="att-field-value">{t.approvalThreshold > 0 ? fmtMoney(t.approvalThreshold) : 'None'}</span></div>
              <div className="att-field-row"><span className="att-field-label">Monthly Cap</span><span className="att-field-value">{t.spendControls?.monthlyCapEnabled ? fmtMoney(t.spendControls.monthlyCap) : 'None'}</span></div>
              <div className="att-field-row"><span className="att-field-label">Join Code</span><span className="att-field-value">{t.joinCodeEnabled ? t.joinCode || 'Enabled' : 'Disabled'}</span></div>
              {t.suspendReason && <div className="att-field-row"><span className="att-field-label">Suspend Reason</span><span className="att-field-value">{t.suspendReason}</span></div>}
              {t.flagReason && <div className="att-field-row"><span className="att-field-label">Flag Reason</span><span className="att-field-value">{t.flagReason}</span></div>}
            </div>
          </div>
        )}

        {detailTab === 'Members' && (
          <div className="att-members-list">
            {(t.members || []).filter(m => m.status !== 'removed').map(m => (
              <div className="att-member-card" key={m._id}>
                <div className="att-member-info">
                  <span className="att-member-name">{m.user?.firstName} {m.user?.lastName}</span>
                  <span className="att-member-email">{m.user?.email}</span>
                  <span className="att-member-meta">
                    {m.title && `${m.title} · `}Joined {fmtDate(m.joinedAt || m.invitedAt)}
                  </span>
                </div>
                <div className="att-member-actions">
                  <span className="att-badge" data-role={m.role}>{m.role}</span>
                  {m.status === 'invited' && <span className="att-badge" data-member-status="invited">Invited</span>}
                  {m.role !== 'owner' && m.status === 'active' && (
                    <button className="att-remove-btn" onClick={() => handleRemoveMember(m.user?._id, `${m.user?.firstName} ${m.user?.lastName}`)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            {(t.members || []).filter(m => m.status !== 'removed').length === 0 && (
              <div className="admin-empty">No members</div>
            )}
          </div>
        )}

        {detailTab === 'Tasks' && (
          <>
            <div className="att-table-wrap">
              <table className="att-table">
                <thead><tr>
                  <th>Title</th><th>Assignee</th><th>Status</th><th>Type</th><th>Amount</th>
                </tr></thead>
                <tbody>
                  {tasks.items.map(task => (
                    <tr key={task._id}>
                      <td data-label="Title">{task.title}</td>
                      <td data-label="Assignee">{task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : '—'}</td>
                      <td data-label="Status"><span className="att-badge" data-task-status={task.status}>{task.status.replace('_', ' ')}</span></td>
                      <td data-label="Type">{task.payoutType === 'none' ? '—' : task.payoutType.replace('_', '/')}</td>
                      <td data-label="Amount">{task.payoutType === 'per_job' ? fmtMoney(task.payoutAmount) : task.payoutType === 'per_hour' ? `${fmtMoney(task.hourlyRate)}/hr` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tasks.items.length === 0 && <div className="admin-empty">No tasks</div>}
            </div>
            {tasks.pages > 1 && (
              <div className="att-pagination">
                <button disabled={tasks.page <= 1} onClick={() => fetchTasks(selectedTeam._id, tasks.page - 1)}>← Prev</button>
                <span>Page {tasks.page} of {tasks.pages}</span>
                <button disabled={tasks.page >= tasks.pages} onClick={() => fetchTasks(selectedTeam._id, tasks.page + 1)}>Next →</button>
              </div>
            )}
          </>
        )}

        {detailTab === 'Payouts' && (
          <>
            <div className="att-table-wrap">
              <table className="att-table">
                <thead><tr>
                  <th>Date</th><th>Recipient</th><th>Amount</th><th>Type</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {payouts.items.map(p => (
                    <tr key={p._id}>
                      <td data-label="Date">{fmtDate(p.createdAt)}</td>
                      <td data-label="Recipient">
                        {p.recipientUser ? `${p.recipientUser.firstName} ${p.recipientUser.lastName}` : p.recipientTeam?.name || '—'}
                      </td>
                      <td data-label="Amount">{fmtMoney(p.amount)}</td>
                      <td data-label="Type"><span className="att-badge" data-type={p.type}>{p.type.replace(/_/g, ' ')}</span></td>
                      <td data-label="Status"><span className="att-badge" data-payout-status={p.status}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payouts.items.length === 0 && <div className="admin-empty">No payouts</div>}
            </div>
            {payouts.pages > 1 && (
              <div className="att-pagination">
                <button disabled={payouts.page <= 1} onClick={() => fetchPayouts(selectedTeam._id, payouts.page - 1)}>← Prev</button>
                <span>Page {payouts.page} of {payouts.pages}</span>
                <button disabled={payouts.page >= payouts.pages} onClick={() => fetchPayouts(selectedTeam._id, payouts.page + 1)}>Next →</button>
              </div>
            )}
          </>
        )}

        {/* ── Modals ── */}
        {modal === 'suspend' && (
          <div className="att-modal-backdrop" onClick={() => setModal(null)}>
            <div className="att-modal" onClick={e => e.stopPropagation()}>
              <h3>Suspend Team</h3>
              <p>Suspending "{t.name}" will hide it from public view and notify the owner.</p>
              <div className="att-modal-field">
                <label>Reason (optional)</label>
                <textarea value={modalReason} onChange={e => setModalReason(e.target.value)} placeholder="Why is this team being suspended?" />
              </div>
              <div className="att-modal-actions">
                <button className="att-modal-btn cancel" onClick={() => setModal(null)}>Cancel</button>
                <button className="att-modal-btn danger" onClick={handleSuspend} disabled={modalBusy}>
                  {modalBusy ? 'Suspending…' : 'Suspend Team'}
                </button>
              </div>
            </div>
          </div>
        )}

        {modal === 'transfer' && (
          <div className="att-modal-backdrop" onClick={() => setModal(null)}>
            <div className="att-modal" onClick={e => e.stopPropagation()}>
              <h3>Transfer Ownership</h3>
              <p>Transfer ownership of "{t.name}" to another active member. The current owner will become an admin.</p>
              <div className="att-modal-field">
                <label>New Owner</label>
                <select value={modalNewOwner} onChange={e => setModalNewOwner(e.target.value)}>
                  <option value="">Select a member…</option>
                  {activeMembers.filter(m => m.role !== 'owner').map(m => (
                    <option key={m.user?._id} value={m.user?._id}>
                      {m.user?.firstName} {m.user?.lastName} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="att-modal-actions">
                <button className="att-modal-btn cancel" onClick={() => setModal(null)}>Cancel</button>
                <button className="att-modal-btn confirm" onClick={handleTransfer} disabled={!modalNewOwner || modalBusy}>
                  {modalBusy ? 'Transferring…' : 'Transfer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {modal === 'delete' && (
          <div className="att-modal-backdrop" onClick={() => setModal(null)}>
            <div className="att-modal" onClick={e => e.stopPropagation()}>
              <h3>Delete Team</h3>
              <p>This will permanently delete "{t.name}" and all associated data. This cannot be undone.</p>
              <div className="att-modal-field">
                <label>Type the team name to confirm</label>
                <input type="text" value={modalDeleteConfirm} onChange={e => setModalDeleteConfirm(e.target.value)} placeholder={t.name} />
              </div>
              {modalDeleteConfirm && modalDeleteConfirm !== t.name && (
                <div className="att-warning">Team name doesn't match</div>
              )}
              <div className="att-modal-actions">
                <button className="att-modal-btn cancel" onClick={() => setModal(null)}>Cancel</button>
                <button className="att-modal-btn danger" onClick={handleDelete} disabled={modalDeleteConfirm !== t.name || modalBusy}>
                  {modalBusy ? 'Deleting…' : 'Delete Forever'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="admin-tab-content">
      <div className="admin-tab-header">
        <h2>Teams</h2>
        <span className="admin-count-badge">{total}</span>
      </div>

      <div className="att-filters">
        <input
          type="text"
          className="att-search"
          placeholder="Search teams…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
        <div className="att-filter-chips">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`att-chip${filter === f ? ' active' : ''}`}
              onClick={() => { setFilter(f); setPage(1); }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="admin-loading">Loading teams…</div>
      ) : teams.length === 0 ? (
        <div className="admin-empty">No teams found.</div>
      ) : (
        <div className="att-list">
          {teams.map(t => (
            <div key={t._id} className="att-card" onClick={() => openDetail(t)}>
              <div className="att-card-header">
                <h3 className="att-card-name">{t.name}</h3>
                <div className="att-card-badges">
                  <span className="att-badge" data-type={t.type}>{t.type === 'agency' ? 'Agency' : 'Team'}</span>
                  {!t.isActive && <span className="att-badge" data-status="suspended">⏸️</span>}
                  {t.flagged && <span className="att-badge" data-status="flagged">🚩</span>}
                </div>
              </div>
              <div className="att-card-meta">
                <span>Owner: {t.owner?.firstName} {t.owner?.lastName}</span>
                <span>{t.activeMembers} member{t.activeMembers !== 1 ? 's' : ''}</span>
                <span>Created {fmtDate(t.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="att-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span>Page {page} of {pages}</span>
          <div className="att-per-page">
            <span>Per page:</span>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
};

export default AdminTeamsTab;
