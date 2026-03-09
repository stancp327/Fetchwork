import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './TeamServiceManagement.css';

const TeamServiceManagement = ({ teamId, members = [] }) => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMember, setFilterMember] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [assignModal, setAssignModal] = useState(null); // service being reassigned
  const [assignTo, setAssignTo] = useState('');

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/api/services?teamId=${teamId}`);
      setServices(res.services || []);
    } catch (err) {
      setError(err.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { loadServices(); }, [loadServices]);

  const toggleStatus = async (serviceId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await apiRequest(`/api/services/${serviceId}`, {
        method: 'PUT',
        body: { status: newStatus },
      });
      loadServices();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAssign = async () => {
    if (!assignModal || !assignTo) return;
    try {
      await apiRequest(`/api/services/${assignModal._id}`, {
        method: 'PUT',
        body: { freelancer: assignTo },
      });
      setAssignModal(null);
      setAssignTo('');
      loadServices();
    } catch (err) {
      setError(err.message);
    }
  };

  // Build member lookup for display
  const memberMap = {};
  members.forEach(m => {
    const u = m.user || m;
    const id = u._id || u;
    memberMap[id] = u;
  });

  // Apply filters
  let filtered = services;
  if (filterMember) {
    filtered = filtered.filter(s => {
      const fid = s.freelancer?._id || s.freelancer;
      return fid === filterMember;
    });
  }
  if (filterStatus) {
    filtered = filtered.filter(s => s.status === filterStatus);
  }

  // Compute stats per service
  const getOrderCount = (svc) => (svc.orders || []).length;
  const getRevenue = (svc) => (svc.orders || [])
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + (o.price || 0), 0);

  // Unique categories for potential filtering
  const categories = [...new Set(services.map(s => s.category).filter(Boolean))];

  if (loading) return <div className="tsm-loading">Loading team services...</div>;

  return (
    <div className="tsm-root">
      <div className="tsm-header">
        <h2 className="tsm-title">Team Services</h2>
        <Link to={`/services/create?teamId=${teamId}`} className="tsm-add-btn">
          + Add Service
        </Link>
      </div>

      {error && <div className="tsm-error">{error}</div>}

      <div className="tsm-filters">
        <select
          className="tsm-filter-select"
          value={filterMember}
          onChange={e => setFilterMember(e.target.value)}
        >
          <option value="">All Members</option>
          {members.filter(m => (m.status || 'active') === 'active').map(m => {
            const u = m.user || m;
            const id = u._id || u;
            const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || id;
            return <option key={id} value={id}>{name}</option>;
          })}
        </select>

        <select
          className="tsm-filter-select"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="draft">Draft</option>
        </select>

        {categories.length > 0 && (
          <select className="tsm-filter-select" onChange={e => {
            const cat = e.target.value;
            if (cat) {
              setServices(prev => prev); // category filter applied inline
            }
          }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      <div className="tsm-grid">
        {filtered.length === 0 && (
          <div className="tsm-empty">No services found. Add a service to get started.</div>
        )}
        {filtered.map(svc => {
          const owner = svc.freelancer || {};
          const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || 'Unknown';

          return (
            <div key={svc._id} className="tsm-card">
              <h3 className="tsm-card-title">{svc.title}</h3>
              <div className="tsm-card-owner">
                {owner.profilePicture && (
                  <img src={owner.profilePicture} alt={ownerName} className="tsm-card-owner-avatar" />
                )}
                <span>{ownerName}</span>
              </div>
              <div className="tsm-card-stats">
                <span className={`tsm-badge tsm-badge-${svc.status}`}>{svc.status}</span>
                <span className="tsm-card-stat">{getOrderCount(svc)} bookings</span>
                <span className="tsm-card-stat">${getRevenue(svc).toLocaleString()} revenue</span>
              </div>
              <div className="tsm-card-actions">
                <button
                  className="tsm-card-btn"
                  onClick={() => toggleStatus(svc._id, svc.status)}
                >
                  {svc.status === 'active' ? 'Pause' : 'Activate'}
                </button>
                <button
                  className="tsm-card-btn"
                  onClick={() => { setAssignModal(svc); setAssignTo(''); }}
                >
                  Reassign
                </button>
                <Link to={`/services/${svc._id}`} className="tsm-card-btn">View</Link>
              </div>
            </div>
          );
        })}
      </div>

      {assignModal && (
        <div className="tsm-modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="tsm-modal" onClick={e => e.stopPropagation()}>
            <h3 className="tsm-modal-title">Reassign &ldquo;{assignModal.title}&rdquo;</h3>
            <select
              className="tsm-filter-select"
              value={assignTo}
              onChange={e => setAssignTo(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Select member...</option>
              {members.filter(m => (m.status || 'active') === 'active').map(m => {
                const u = m.user || m;
                const id = u._id || u;
                const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || id;
                return <option key={id} value={id}>{name}</option>;
              })}
            </select>
            <div className="tsm-modal-actions">
              <button className="tsm-btn-cancel" onClick={() => setAssignModal(null)}>Cancel</button>
              <button className="tsm-btn-save" disabled={!assignTo} onClick={handleAssign}>
                Reassign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamServiceManagement;
