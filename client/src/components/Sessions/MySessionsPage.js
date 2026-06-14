import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { formatDate, formatTimeRange } from '../../utils/sessionFormatters';
import SEO from '../common/SEO';
import './MySessionsPage.css';

// ── Status lookup ────────────────────────────────────────────────────────────

const STATUS_INFO = {
  scheduled:       { label: 'Scheduled',   cls: 'scheduled' },
  full:            { label: 'Full',         cls: 'full' },
  cancelled:       { label: 'Cancelled',    cls: 'cancelled' },
  completed:       { label: 'Completed',    cls: 'completed' },
  confirmed:       { label: 'Confirmed',    cls: 'confirmed' },
  pending_payment: { label: 'Pending Pay',  cls: 'pending_payment' },
  waitlisted:      { label: 'Waitlisted',   cls: 'waitlisted' },
};

function statusInfo(s) {
  return STATUS_INFO[s] || { label: s || 'Unknown', cls: 'scheduled' };
}

function recurrenceDesc(template) {
  if (!template.recurrenceRule) return null;
  if (template.scheduleType === 'FIXED_ONE_TIME') {
    const r = template.recurrenceRule;
    const dateStr = r.date
      ? new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    return `One-time${dateStr ? ` · ${dateStr}` : ''}`;
  }
  const days = template.recurrenceRule.days;
  if (Array.isArray(days) && days.length > 0) return `Every ${days.join(', ')}`;
  return 'Recurring';
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonCards = () => (
  <div className="ms-skeleton-list">
    {[1, 2, 3].map(i => (
      <div key={i} className="ms-skeleton-card">
        <div className="ms-skeleton-row">
          <div className="ms-skeleton-line ms-w40" />
          <div className="ms-skeleton-line ms-w20" />
        </div>
        <div className="ms-skeleton-line ms-w60" />
      </div>
    ))}
  </div>
);

// ── Deactivate Modal ─────────────────────────────────────────────────────────

const DeactivateModal = ({ template, onConfirm, onClose, loading }) => (
  <div className="ms-modal-overlay" onClick={onClose}>
    <div className="ms-modal" onClick={e => e.stopPropagation()}>
      <h3 className="ms-modal-title">Deactivate Template?</h3>
      <p className="ms-modal-body">
        Deactivating <strong>"{template.title || 'this template'}"</strong> will stop future session
        generation. Unbooked future sessions will be cancelled automatically.
      </p>
      <div className="ms-modal-actions">
        <button className="ms-modal-btn ms-modal-btn-secondary" onClick={onClose}>
          Keep Active
        </button>
        <button
          className="ms-modal-btn ms-modal-btn-danger"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Deactivating…' : 'Deactivate'}
        </button>
      </div>
    </div>
  </div>
);

// ── Cancel Session Modal ─────────────────────────────────────────────────────

const CancelSessionModal = ({ occurrence, reason, onReasonChange, onConfirm, onClose, loading }) => (
  <div className="ms-modal-overlay" onClick={onClose}>
    <div className="ms-modal" onClick={e => e.stopPropagation()}>
      <h3 className="ms-modal-title">Cancel Session?</h3>
      <p className="ms-modal-body">
        {occurrence && occurrence.bookedCount > 0
          ? `This session currently has ${occurrence.bookedCount} booked attendee(s). Cancelling will mark the session as cancelled and may affect those attendees.`
          : 'This session currently has no booked attendees.'}
        {' '}This cannot be undone.
      </p>
      <textarea
        className="ms-modal-reason"
        placeholder="Reason for cancellation (optional)"
        value={reason}
        onChange={e => onReasonChange(e.target.value)}
        rows={3}
      />
      <div className="ms-modal-actions">
        <button className="ms-modal-btn ms-modal-btn-secondary" onClick={onClose}>
          Keep Session
        </button>
        <button
          className="ms-modal-btn ms-modal-btn-danger"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Cancelling…' : 'Cancel Session'}
        </button>
      </div>
    </div>
  </div>
);

// ── Occurrence Card ───────────────────────────────────────────────────────────

const OccurrenceCard = ({
  occurrence: o,
  isExpanded,
  attendees,
  attendeesLoading,
  onToggleAttendees,
  onCancel,
}) => {
  const si = statusInfo(o.status);
  const isPast = new Date(o.startTime) <= new Date();
  const isCancelled = o.status === 'cancelled';
  const canCancel = !!onCancel && (o.status === 'scheduled' || o.status === 'full') && !isPast;
  const spotsLeft = o.maxCapacity - o.bookedCount;

  return (
    <div className={`ms-occ-card ${isCancelled ? 'ms-occ-cancelled' : ''}`} data-status={o.status}>
      <div className="ms-occ-top">
        <div className="ms-occ-date">
          <span className="ms-occ-day">{formatDate(o.startTime)}</span>
          <span className="ms-occ-time">{formatTimeRange(o.startTime, o.endTime)}</span>
        </div>
        <div className="ms-occ-info">
          {o.template?.title && <span className="ms-occ-title">{o.template.title}</span>}
          <div className="ms-occ-capacity">
            <span>{o.bookedCount} / {o.maxCapacity} booked</span>
            {!isCancelled && spotsLeft > 0 && (
              <span className="ms-occ-spots">{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left</span>
            )}
          </div>
        </div>
        <span className={`ms-badge ms-badge-${si.cls}`}>{si.label}</span>
      </div>

      <div className="ms-occ-actions">
        <button className="ms-action-btn ms-action-btn-attendees" onClick={onToggleAttendees}>
          {isExpanded ? 'Hide Attendees' : `Attendees (${o.bookedCount})`}
        </button>
        {canCancel && (
          <button className="ms-action-btn ms-action-btn-cancel" onClick={onCancel}>
            Cancel Session
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="ms-attendees">
          {attendeesLoading ? (
            <div className="ms-attendees-loading">Loading attendees…</div>
          ) : !attendees || attendees.length === 0 ? (
            <div className="ms-attendees-empty">No bookings for this session.</div>
          ) : (
            <div className="ms-attendees-list">
              {attendees.map((b, idx) => {
                const bs = statusInfo(b.status);
                return (
                  <div key={b.id} className="ms-attendee-row">
                    <span className="ms-attendee-num">Attendee #{idx + 1}</span>
                    <span className="ms-attendee-seats">{b.seats} seat{b.seats !== 1 ? 's' : ''}</span>
                    <span className={`ms-badge ms-badge-${bs.cls}`}>{bs.label}</span>
                    <span className="ms-attendee-time">
                      {new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const MySessionsPage = () => {
  const [searchParams] = useSearchParams();

  const [templates, setTemplates]   = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [services, setServices]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const [templatesExpanded, setTemplatesExpanded] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState(searchParams.get('serviceId') || '');

  const [deactivateModal, setDeactivateModal] = useState(null); // template object
  const [cancelModal, setCancelModal]         = useState(null); // occurrence object
  const [cancelReason, setCancelReason]       = useState('');
  const [actionLoading, setActionLoading]     = useState('');
  const [msg, setMsg]                         = useState({ text: '', ok: true });

  const [attendees, setAttendees]             = useState({});
  const [attendeesLoading, setAttendeesLoading] = useState({});
  const [expanded, setExpanded]               = useState({});

  const flash = (text, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg({ text: '', ok: true }), 4500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tmplRes, occRes, svcRes] = await Promise.allSettled([
        apiRequest('/api/sessions/templates?activeOnly=false'),
        apiRequest('/api/sessions/occurrences/mine'),
        apiRequest('/api/services/me'),
      ]);

      setTemplates(tmplRes.status === 'fulfilled' ? (tmplRes.value || []) : []);
      setOccurrences(occRes.status === 'fulfilled' ? (occRes.value || []) : []);
      setServices(svcRes.status === 'fulfilled' ? (svcRes.value?.services || []) : []);

      if (tmplRes.status === 'rejected' && occRes.status === 'rejected') {
        setError('Failed to load sessions. Please try again.');
      }
    } catch (err) {
      setError('Failed to load sessions: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Service name lookup map
  const serviceNameMap = services.reduce((acc, s) => {
    acc[s._id] = s.title;
    return acc;
  }, {});

  const uniqueServiceIds = [...new Set(templates.map(t => t.mongoServiceId).filter(Boolean))];
  const showFilter = uniqueServiceIds.length > 1;

  // Filtering
  const filteredTemplates = selectedServiceId
    ? templates.filter(t => t.mongoServiceId === selectedServiceId)
    : templates;

  const filteredOccurrences = selectedServiceId
    ? occurrences.filter(o => o.template?.mongoServiceId === selectedServiceId)
    : occurrences;

  const activeOccurrences    = filteredOccurrences.filter(o => o.status !== 'cancelled');
  const cancelledOccurrences = filteredOccurrences.filter(o => o.status === 'cancelled');

  // Toggle attendees (lazy fetch on first open)
  const toggleAttendees = async (occurrenceId) => {
    const isOpen = !!expanded[occurrenceId];
    setExpanded(prev => ({ ...prev, [occurrenceId]: !isOpen }));

    if (!isOpen && !attendees[occurrenceId]) {
      setAttendeesLoading(prev => ({ ...prev, [occurrenceId]: true }));
      try {
        const data = await apiRequest(`/api/sessions/occurrences/${occurrenceId}/bookings`);
        setAttendees(prev => ({ ...prev, [occurrenceId]: data || [] }));
      } catch {
        setAttendees(prev => ({ ...prev, [occurrenceId]: [] }));
      } finally {
        setAttendeesLoading(prev => ({ ...prev, [occurrenceId]: false }));
      }
    }
  };

  // Deactivate template
  const doDeactivate = async () => {
    if (!deactivateModal) return;
    const id = deactivateModal.id;
    setActionLoading(`deactivate_${id}`);
    try {
      await apiRequest(`/api/sessions/templates/${id}/deactivate`, { method: 'POST' });
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, isActive: false } : t));
      flash('Template deactivated.');
      setDeactivateModal(null);
    } catch (err) {
      flash('Failed to deactivate: ' + err.message, false);
    } finally {
      setActionLoading('');
    }
  };

  // Cancel occurrence
  const doCancel = async () => {
    if (!cancelModal) return;
    const id = cancelModal.id;
    setActionLoading(`cancel_${id}`);
    try {
      await apiRequest(`/api/sessions/occurrences/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      });
      setOccurrences(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o));
      flash('Session cancelled.');
      setCancelModal(null);
      setCancelReason('');
    } catch (err) {
      flash('Failed to cancel session: ' + err.message, false);
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="ms-page">
      <SEO title="My Sessions | Fetchwork" path="/my-sessions" noIndex={true} />

      <div className="ms-header">
        <h1 className="ms-title">My Sessions</h1>
        <Link to="/bookings" className="ms-back-link">← My Bookings</Link>
      </div>

      {showFilter && (
        <div className="ms-filter-bar">
          <select
            className="ms-service-select"
            value={selectedServiceId}
            onChange={e => setSelectedServiceId(e.target.value)}
          >
            <option value="">All Services</option>
            {uniqueServiceIds.map(sid => (
              <option key={sid} value={sid}>
                {serviceNameMap[sid] || sid}
              </option>
            ))}
          </select>
        </div>
      )}

      {msg.text && (
        <div className={`ms-msg ${msg.ok ? 'ms-msg-ok' : 'ms-msg-err'}`}>{msg.text}</div>
      )}

      {error && (
        <div className="ms-error-state">
          <p>{error}</p>
          <button className="ms-retry-btn" onClick={load}>Retry</button>
        </div>
      )}

      {loading ? (
        <SkeletonCards />
      ) : !error && templates.length === 0 && occurrences.length === 0 ? (
        <div className="ms-empty">
          <div className="ms-empty-icon">📅</div>
          <h3>No sessions yet</h3>
          <p>Create a service with session scheduling to get started.</p>
          <Link to="/create-service" className="ms-empty-cta">Create Service →</Link>
        </div>
      ) : !error && (
        <>
          {/* Templates section (collapsible) */}
          <div className="ms-section">
            <button
              className="ms-section-header"
              onClick={() => setTemplatesExpanded(v => !v)}
              aria-expanded={templatesExpanded}
            >
              <span className="ms-section-title">
                Templates
                <span className="ms-section-count">{filteredTemplates.length}</span>
              </span>
              <span className="ms-section-chevron">{templatesExpanded ? '▲' : '▼'}</span>
            </button>

            {templatesExpanded && (
              <div className="ms-template-list">
                {filteredTemplates.length === 0 ? (
                  <div className="ms-template-empty">No templates for this service.</div>
                ) : filteredTemplates.map(t => (
                  <div
                    key={t.id}
                    className={`ms-template-row ${!t.isActive ? 'ms-template-inactive' : ''}`}
                  >
                    <div className="ms-template-info">
                      <span className="ms-template-title">{t.title || 'Untitled Template'}</span>
                      {recurrenceDesc(t) && (
                        <span className="ms-template-recurrence">{recurrenceDesc(t)}</span>
                      )}
                      {t.durationMinutes && (
                        <span className="ms-template-meta">⏱ {t.durationMinutes} min</span>
                      )}
                    </div>
                    <div className="ms-template-actions">
                      <span className={`ms-badge ms-badge-${t.isActive ? 'active' : 'inactive'}`}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {t.isActive && (
                        <button
                          className="ms-action-btn ms-action-btn-deactivate"
                          onClick={() => setDeactivateModal(t)}
                          disabled={actionLoading === `deactivate_${t.id}`}
                        >
                          {actionLoading === `deactivate_${t.id}` ? '…' : 'Deactivate'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active occurrences section */}
          <div className="ms-section">
            <div className="ms-section-header ms-section-header-static">
              <span className="ms-section-title">
                Upcoming Sessions
                <span className="ms-section-count">{activeOccurrences.length}</span>
              </span>
            </div>

            {activeOccurrences.length === 0 ? (
              <div className="ms-occ-empty">No upcoming sessions.</div>
            ) : (
              <div className="ms-occ-list">
                {activeOccurrences.map(o => (
                  <OccurrenceCard
                    key={o.id}
                    occurrence={o}
                    isExpanded={!!expanded[o.id]}
                    attendees={attendees[o.id]}
                    attendeesLoading={!!attendeesLoading[o.id]}
                    onToggleAttendees={() => toggleAttendees(o.id)}
                    onCancel={() => setCancelModal(o)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Cancelled occurrences section */}
          {cancelledOccurrences.length > 0 && (
            <div className="ms-section ms-section-cancelled">
              <div className="ms-section-header ms-section-header-static">
                <span className="ms-section-title ms-section-title-muted">
                  Cancelled
                  <span className="ms-section-count">{cancelledOccurrences.length}</span>
                </span>
              </div>
              <div className="ms-occ-list">
                {cancelledOccurrences.map(o => (
                  <OccurrenceCard
                    key={o.id}
                    occurrence={o}
                    isExpanded={!!expanded[o.id]}
                    attendees={attendees[o.id]}
                    attendeesLoading={!!attendeesLoading[o.id]}
                    onToggleAttendees={() => toggleAttendees(o.id)}
                    onCancel={null}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {deactivateModal && (
        <DeactivateModal
          template={deactivateModal}
          onConfirm={doDeactivate}
          onClose={() => setDeactivateModal(null)}
          loading={actionLoading === `deactivate_${deactivateModal.id}`}
        />
      )}

      {cancelModal && (
        <CancelSessionModal
          occurrence={cancelModal}
          reason={cancelReason}
          onReasonChange={setCancelReason}
          onConfirm={doCancel}
          onClose={() => { setCancelModal(null); setCancelReason(''); }}
          loading={actionLoading === `cancel_${cancelModal.id}`}
        />
      )}
    </div>
  );
};

export default MySessionsPage;
