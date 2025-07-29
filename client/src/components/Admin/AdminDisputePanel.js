import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import './AdminDisputePanel.css';

const AdminDisputePanel = () => {
  const { user } = useAuth();
  const [disputesData, setDisputesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDisputesData = useCallback(async (page = 1, status = 'all') => {
    try {
      setLoading(true);
      
      const response = await apiRequest('/api/disputes/admin', {
        params: { page, status }
      });
      setDisputesData(response);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch disputes data:', error);
      if (error.response?.status === 401) {
        setError('Authentication failed - please log in again');
      } else {
        setError(error.response?.data?.error || 'Failed to load disputes data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isAdmin) {
      fetchDisputesData();
    }
  }, [user?.isAdmin, fetchDisputesData]);

  const updateDisputeStatus = async (disputeId, status, resolution = null, resolutionAmount = 0, adminNotes = '') => {
    try {
      await apiRequest(`/api/disputes/${disputeId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          resolution,
          resolutionAmount,
          adminNotes
        })
      });
      fetchDisputesData();
    } catch (error) {
      console.error('Failed to update dispute:', error);
      alert('Failed to update dispute. Please try again.');
    }
  };

  const handleResolveDispute = (dispute) => {
    const resolution = prompt('Resolution (client_favor, freelancer_favor, partial_refund, no_action):');
    if (!resolution) return;
    
    let resolutionAmount = 0;
    if (resolution === 'partial_refund') {
      const amount = prompt('Refund amount:');
      resolutionAmount = parseFloat(amount) || 0;
    }
    
    const adminNotes = prompt('Admin notes (optional):') || '';
    
    updateDisputeStatus(dispute._id, 'resolved', resolution, resolutionAmount, adminNotes);
  };

  if (loading) {
    return (
      <div className="admin-panel-table">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading disputes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-panel-table">
        <div className="error-container">
          <h3>Error Loading Disputes</h3>
          <p>{error}</p>
          <button onClick={() => fetchDisputesData()} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="disputes-management">
      <div className="disputes-controls">
        <select
          className="status-filter"
          onChange={(e) => fetchDisputesData(1, e.target.value)}
        >
          <option value="all">All Disputes</option>
          <option value="open">Open</option>
          <option value="under_review">Under Review</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      
      <div className="admin-panel-table">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Filed By</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Filed Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {disputesData?.disputes?.length > 0 ? disputesData.disputes.map((dispute) => (
              <tr key={dispute._id}>
                <td>
                  <div className="job-info">
                    <div className="job-title">{dispute.job?.title || 'N/A'}</div>
                    <div className="job-budget">${dispute.job?.budget || 0}</div>
                  </div>
                </td>
                <td>
                  <div className="user-info">
                    <div className="user-name">
                      {dispute.filedBy ? `${dispute.filedBy.firstName} ${dispute.filedBy.lastName}` : 'N/A'}
                    </div>
                    <div className="user-email">{dispute.filedBy?.email || 'N/A'}</div>
                  </div>
                </td>
                <td>
                  <span className="dispute-reason">
                    {dispute.reason?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </td>
                <td>
                  <span className={`status ${dispute.status}`}>
                    {dispute.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </td>
                <td>{new Date(dispute.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="dispute-actions">
                    {dispute.status === 'open' && (
                      <button
                        className="action-btn review"
                        onClick={() => updateDisputeStatus(dispute._id, 'under_review')}
                      >
                        Review
                      </button>
                    )}
                    {dispute.status === 'under_review' && (
                      <button
                        className="action-btn resolve"
                        onClick={() => handleResolveDispute(dispute)}
                      >
                        Resolve
                      </button>
                    )}
                    <button
                      className="action-btn view"
                      onClick={() => {
                        alert(`Dispute Details:\n\nReason: ${dispute.reason}\nDescription: ${dispute.description}\nStatus: ${dispute.status}`);
                      }}
                    >
                      View Details
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" className="no-data">No disputes found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {disputesData?.pagination && (
        <div className="pagination">
          <span>Page {disputesData.pagination.current} of {disputesData.pagination.pages}</span>
          <span>Total: {disputesData.pagination.total} disputes</span>
        </div>
      )}
    </div>
  );
};

export default AdminDisputePanel;
