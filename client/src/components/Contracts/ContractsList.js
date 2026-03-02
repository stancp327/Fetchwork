import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import SEO from '../common/SEO';
import './Contracts.css';

const STATUS_META = {
  draft:     { label: 'Draft',     color: '#6b7280', bg: '#f3f4f6', icon: '📝' },
  pending:   { label: 'Pending',   color: '#f59e0b', bg: '#fef3c7', icon: '⏳' },
  active:    { label: 'Active',    color: '#10b981', bg: '#d1fae5', icon: '✅' },
  completed: { label: 'Completed', color: '#2563eb', bg: '#dbeafe', icon: '🏁' },
  cancelled: { label: 'Cancelled', color: '#ef4444', bg: '#fee2e2', icon: '❌' },
  expired:   { label: 'Expired',   color: '#9ca3af', bg: '#f3f4f6', icon: '⏰' },
};

const ContractsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const data = await apiRequest(`/api/contracts?status=${filter}`);
        setContracts(data.contracts || []);
      } catch (err) {
        console.error('Failed to load contracts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchContracts();
  }, [filter]);

  const userId = user?._id || user?.id;

  return (
    <div className="contracts-container">
      <SEO title="Contracts" path="/contracts" />
      <div className="contracts-header">
        <div>
          <h1>Contracts</h1>
          <p className="contracts-subtitle">Manage agreements, NDAs, and service contracts</p>
        </div>
        <Link to="/contracts/new" className="contract-new-btn">+ New Contract</Link>
      </div>

      <div className="contracts-filters">
        {['all', 'draft', 'pending', 'active', 'completed'].map(f => (
          <button key={f} className={`contract-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : STATUS_META[f]?.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="contracts-loading">Loading contracts...</div>
      ) : contracts.length === 0 ? (
        <div className="contracts-empty">
          <span className="contracts-empty-icon">📋</span>
          <h3>No contracts yet</h3>
          <p>Create a service agreement or NDA to protect both parties.</p>
          <Link to="/contracts/new" className="contract-new-btn">Create Your First Contract</Link>
        </div>
      ) : (
        <div className="contracts-list">
          {contracts.map(c => {
            const meta = STATUS_META[c.status] || STATUS_META.draft;
            const isCreator = c.createdBy === userId || c.client?._id === userId;
            const otherParty = isCreator ? c.freelancer : c.client;
            const mySigned = c.signatures?.some(s => s.user === userId || s.user?._id === userId);

            return (
              <div key={c._id} className="contract-card" onClick={() => navigate(`/contracts/${c._id}`)}>
                <div className="contract-card-header">
                  <div>
                    <h3 className="contract-card-title">{c.title}</h3>
                    <span className="contract-card-type">{c.template?.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="contract-status-badge" style={{ color: meta.color, background: meta.bg }}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
                <div className="contract-card-meta">
                  <span>With: {otherParty?.firstName} {otherParty?.lastName}</span>
                  {c.job && <span>Job: {c.job.title}</span>}
                  {c.terms?.compensation && <span>💰 ${c.terms.compensation}</span>}
                </div>
                <div className="contract-card-footer">
                  <span className="contract-card-date">
                    {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
                  </span>
                  {c.status === 'pending' && !mySigned && (
                    <span className="contract-sign-prompt">✍️ Your signature needed</span>
                  )}
                  {c.status === 'pending' && mySigned && (
                    <span className="contract-waiting">Waiting for other party</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContractsList;
