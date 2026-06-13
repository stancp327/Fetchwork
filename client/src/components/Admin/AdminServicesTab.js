import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import TracingErrorBoundary from '../common/TracingErrorBoundary';

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const AdminServicesTab = ({ servicesData, fetchServicesData }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [perPage, setPerPage] = useState(10);

  const currentPage = servicesData?.pagination?.current || 1;
  const totalPages = servicesData?.pagination?.pages || 1;
  const total = servicesData?.pagination?.total || 0;

  const load = (page, status = statusFilter, limit = perPage) => {
    fetchServicesData(page, status, limit);
  };

  return (
    <TracingErrorBoundary componentName="ServicesTab">
      <div className="jobs-tab">
        <h2>Service Management</h2>
        {servicesData ? (
          <div className="jobs-management">
            <div className="jobs-controls">
              <select className="status-filter" value={statusFilter} onChange={(e) => {
                setStatusFilter(e.target.value);
                load(1, e.target.value);
              }}>
                <option value="all">All Services</option>
                <option value="active">Active</option>
                <option value="paused">Suspended</option>
                <option value="draft">Draft</option>
                <option value="under_review">Under Review</option>
              </select>
              <select className="status-filter" value={perPage} onChange={(e) => {
                const pp = parseInt(e.target.value);
                setPerPage(pp);
                load(1, statusFilter, pp);
              }}>
                {PER_PAGE_OPTIONS.map(n => (
                  <option key={n} value={n}>Show {n}</option>
                ))}
              </select>
            </div>

            <div style={{ padding: '0.5rem 0', fontSize: '0.85rem', color: '#6b7280' }}>
              Showing {servicesData.services?.length || 0} of {total} services
            </div>

            <div className="jobs-table">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Freelancer</th>
                    <th>Category</th>
                    <th>Price (Basic)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(servicesData?.services) && servicesData.services.length > 0 ? servicesData.services.map((service) => (
                    <tr key={service._id}>
                      <td>
                        <a href={`/services/${service._id}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                          {service.title}
                        </a>
                      </td>
                      <td>{service.freelancer ? `${service.freelancer.firstName} ${service.freelancer.lastName}` : 'N/A'}</td>
                      <td><span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{(service.category || '').replace(/_/g, ' ')}</span></td>
                      <td>${service.pricing?.basic?.price || 'N/A'}</td>
                      <td><span className={`status ${service.status}`}>
                        {service.status === 'paused' ? 'Suspended' : service.status?.replace(/_/g, ' ')}
                      </span></td>
                      <td>
                        <div className="action-buttons">
                          {service.status === 'active' && (
                            <button className="action-btn cancel" onClick={async () => {
                              const reason = prompt('Reason for suspending this service:');
                              if (!reason) return;
                              try {
                                await apiRequest(`/api/admin/services/${service._id}/suspend`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ reason }),
                                });
                                alert('Service suspended — hidden from public.');
                                load(currentPage);
                              } catch (err) {
                                alert('Failed to suspend: ' + (err.message || ''));
                              }
                            }}>Suspend</button>
                          )}
                          {service.status === 'paused' && (
                            <button className="action-btn" style={{ background: '#16a34a', color: 'white' }} onClick={async () => {
                              try {
                                await apiRequest(`/api/admin/services/${service._id}/reinstate`, {
                                  method: 'PUT',
                                });
                                alert('Service reinstated.');
                                load(currentPage);
                              } catch (err) {
                                alert('Failed to reinstate: ' + (err.message || ''));
                              }
                            }}>Reinstate</button>
                          )}
                          <button className="action-btn delete" onClick={async () => {
                            if (!window.confirm(`Permanently remove "${service.title}"? This cannot be undone.`)) return;
                            const reason = prompt('Reason for removal:');
                            if (!reason) return;
                            try {
                              await apiRequest(`/api/admin/services/${service._id}`, {
                                method: 'DELETE',
                                body: JSON.stringify({ reason }),
                              });
                              alert('Service removed.');
                              load(currentPage);
                            } catch (err) {
                              alert('Failed to remove: ' + (err.message || ''));
                            }
                          }}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" className="no-data">No services found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button disabled={currentPage <= 1} onClick={() => load(currentPage - 1)}
                  style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
                  ← Prev
                </button>
                <span style={{ padding: '0.4rem 0.8rem', color: '#374151' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button disabled={currentPage >= totalPages} onClick={() => load(currentPage + 1)}
                  style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
                  Next →
                </button>
              </div>
              <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Total: {total} services</span>
            </div>
          </div>
        ) : (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading services...</p>
          </div>
        )}
      </div>
    </TracingErrorBoundary>
  );
};

export default AdminServicesTab;
