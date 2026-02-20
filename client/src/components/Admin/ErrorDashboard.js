import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './ErrorDashboard.css';

const severityColors = {
  low: '#4CAF50', medium: '#FF9800', high: '#f44336', critical: '#9C27B0'
};
const sourceIcons = {
  server: '🖥️', client: '🌐', unhandledRejection: '💥', uncaughtException: '🔥'
};

const StatCard = ({ label, value, color }) => (
  <div className="error-stat-card" style={{ borderTopColor: color }}>
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
);

const ErrorRow = ({ error, selected, onSelect, onResolve, onClick }) => {
  const timeAgo = (date) => {
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  return (
    <div className={`error-row ${error.resolved ? 'resolved' : ''} severity-${error.severity}`} onClick={() => onClick(error)}>
      <div className="error-row-check" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={() => onSelect(error._id)} />
      </div>
      <div className="error-row-content">
        <div className="error-row-header">
          <span className="error-source">{sourceIcons[error.source]} {error.source}</span>
          <span className={`error-severity severity-${error.severity}`}>{error.severity}</span>
          {error.occurrences > 1 && <span className="error-count">×{error.occurrences}</span>}
          <span className="error-time">{timeAgo(error.lastSeenAt || error.createdAt)}</span>
        </div>
        <div className="error-message">{error.message}</div>
        <div className="error-meta">
          {error.request?.method && <span>{error.request.method} {error.request.url}</span>}
          {error.client?.url && <span>{error.client.url}</span>}
          {error.userId && <span>User: {error.userId.firstName || error.userEmail || 'unknown'}</span>}
        </div>
      </div>
      <div className="error-row-actions" onClick={e => e.stopPropagation()}>
        <button
          className={`resolve-btn ${error.resolved ? 'unresolve' : ''}`}
          onClick={() => onResolve(error._id, !error.resolved)}
          title={error.resolved ? 'Reopen' : 'Resolve'}
        >
          {error.resolved ? '↩️' : '✅'}
        </button>
      </div>
    </div>
  );
};

const ErrorDetailModal = ({ error, onClose, onResolve }) => {
  if (!error) return null;

  return (
    <div className="error-modal-overlay" onClick={onClose}>
      <div className="error-modal" onClick={e => e.stopPropagation()}>
        <div className="error-modal-header">
          <h3>{sourceIcons[error.source]} {error.name || 'Error'}</h3>
          <button onClick={onClose}>×</button>
        </div>
        <div className="error-modal-body">
          <div className="error-detail-meta">
            <span className={`error-severity severity-${error.severity}`}>{error.severity}</span>
            <span>Occurrences: {error.occurrences}</span>
            <span>First: {new Date(error.createdAt).toLocaleString()}</span>
            <span>Last: {new Date(error.lastSeenAt || error.createdAt).toLocaleString()}</span>
          </div>

          <div className="error-detail-section">
            <h4>Message</h4>
            <p className="error-detail-message">{error.message}</p>
          </div>

          {error.stack && (
            <div className="error-detail-section">
              <h4>Stack Trace</h4>
              <pre className="error-stack">{error.stack}</pre>
            </div>
          )}

          {error.request?.url && (
            <div className="error-detail-section">
              <h4>Request</h4>
              <div className="error-detail-grid">
                <span>Method:</span><span>{error.request.method}</span>
                <span>URL:</span><span>{error.request.url}</span>
                {error.request.ip && <><span>IP:</span><span>{error.request.ip}</span></>}
                {error.request.userAgent && <><span>UA:</span><span className="ua-text">{error.request.userAgent}</span></>}
              </div>
              {error.request.body && Object.keys(error.request.body).length > 0 && (
                <>
                  <h5>Body</h5>
                  <pre className="error-json">{JSON.stringify(error.request.body, null, 2)}</pre>
                </>
              )}
            </div>
          )}

          {error.client?.url && (
            <div className="error-detail-section">
              <h4>Client Context</h4>
              <div className="error-detail-grid">
                <span>Page:</span><span>{error.client.url}</span>
                {error.client.component && <><span>Component:</span><span>{error.client.component}</span></>}
                {error.client.viewport && <><span>Viewport:</span><span>{error.client.viewport}</span></>}
              </div>
            </div>
          )}

          {error.notes && (
            <div className="error-detail-section">
              <h4>Notes</h4>
              <p>{error.notes}</p>
            </div>
          )}
        </div>
        <div className="error-modal-footer">
          <button
            className={`btn-resolve ${error.resolved ? 'btn-reopen' : ''}`}
            onClick={() => onResolve(error._id, !error.resolved)}
          >
            {error.resolved ? 'Reopen' : 'Mark Resolved'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ErrorDashboard = () => {
  const [stats, setStats] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [detailError, setDetailError] = useState(null);

  // Filters
  const [source, setSource] = useState('');
  const [severity, setSeverity] = useState('');
  const [resolved, setResolved] = useState('false');
  const [search, setSearch] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiRequest('/api/errors/admin/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch error stats:', err);
    }
  }, []);

  const fetchErrors = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 25 });
      if (source) params.set('source', source);
      if (severity) params.set('severity', severity);
      if (resolved) params.set('resolved', resolved);
      if (search) params.set('search', search);

      const data = await apiRequest(`/api/errors/admin?${params}`);
      setErrors(data.errors);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch errors:', err);
    } finally {
      setLoading(false);
    }
  }, [page, source, severity, resolved, search]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchErrors(); }, [fetchErrors]);

  const handleResolve = async (id, resolve) => {
    try {
      await apiRequest(`/api/errors/admin/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolved: resolve })
      });
      fetchErrors();
      fetchStats();
      if (detailError?._id === id) {
        setDetailError(prev => ({ ...prev, resolved: resolve }));
      }
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  };

  const handleBulkResolve = async () => {
    if (selectedIds.size === 0) return;
    try {
      await apiRequest('/api/errors/admin/bulk-resolve', {
        method: 'POST',
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      setSelectedIds(new Set());
      fetchErrors();
      fetchStats();
    } catch (err) {
      alert('Failed to bulk resolve: ' + err.message);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === errors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(errors.map(e => e._id)));
    }
  };

  return (
    <div className="error-dashboard">
      <h2>Error Monitoring</h2>

      {/* Stats */}
      {stats && (
        <div className="error-stats-grid">
          <StatCard label="Unresolved" value={stats.unresolved} color="#f44336" />
          <StatCard label="Critical" value={stats.critical} color="#9C27B0" />
          <StatCard label="Today" value={stats.today} color="#FF9800" />
          <StatCard label="Total" value={stats.total} color="#2196f3" />
        </div>
      )}

      {/* Filters */}
      <div className="error-filters">
        <input
          type="text"
          placeholder="Search errors..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="error-search"
        />
        <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }}>
          <option value="">All Sources</option>
          <option value="server">Server</option>
          <option value="client">Client</option>
          <option value="unhandledRejection">Unhandled Rejection</option>
          <option value="uncaughtException">Uncaught Exception</option>
        </select>
        <select value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}>
          <option value="">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={resolved} onChange={e => { setResolved(e.target.value); setPage(1); }}>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
          <option value="">All</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="error-bulk-bar">
          <span>{selectedIds.size} selected</span>
          <button onClick={handleBulkResolve}>✅ Resolve Selected</button>
          <button onClick={() => setSelectedIds(new Set())}>Clear Selection</button>
        </div>
      )}

      {/* Error List */}
      {loading ? (
        <div className="error-loading"><div className="spinner"></div></div>
      ) : errors.length === 0 ? (
        <div className="error-empty">
          <p>🎉 No errors found{resolved === 'false' ? ' — everything looks good!' : '.'}</p>
        </div>
      ) : (
        <>
          <div className="error-list-header">
            <input type="checkbox" onChange={selectAll} checked={selectedIds.size === errors.length && errors.length > 0} />
            <span>{pagination.total} errors</span>
          </div>
          <div className="error-list">
            {errors.map(err => (
              <ErrorRow
                key={err._id}
                error={err}
                selected={selectedIds.has(err._id)}
                onSelect={toggleSelect}
                onResolve={handleResolve}
                onClick={setDetailError}
              />
            ))}
          </div>
          {pagination.pages > 1 && (
            <div className="error-pagination">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span>Page {page} of {pagination.pages}</span>
              <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      <ErrorDetailModal
        error={detailError}
        onClose={() => setDetailError(null)}
        onResolve={handleResolve}
      />
    </div>
  );
};

export default ErrorDashboard;
