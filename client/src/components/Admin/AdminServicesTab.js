import React from 'react';
import { apiRequest } from '../../utils/api';
import TracingErrorBoundary from '../common/TracingErrorBoundary';

const AdminServicesTab = ({ servicesData, fetchServicesData }) => (
  <TracingErrorBoundary componentName="ServicesTab">
    <div className="jobs-tab">
      <h2>Service Management</h2>
      {servicesData ? (
        <div className="jobs-management">
          <div className="jobs-controls">
            <select className="status-filter" onChange={(e) => fetchServicesData(1, e.target.value)}>
              <option value="all">All Services</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
              <option value="under_review">Under Review</option>
            </select>
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
                    <td>{service.title}</td>
                    <td>{service.freelancer ? `${service.freelancer.firstName} ${service.freelancer.lastName}` : 'N/A'}</td>
                    <td>{service.category?.replace(/_/g, ' ') || 'N/A'}</td>
                    <td>${service.pricing?.basic?.price || 'N/A'}</td>
                    <td><span className={`status ${service.status}`}>{service.status}</span></td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn delete" onClick={async () => {
                          if (!window.confirm(`Remove "${service.title}"?`)) return;
                          try {
                            await apiRequest(`/api/admin/services/${service._id}`, { method: 'DELETE' });
                            alert('Service removed');
                            fetchServicesData();
                          } catch (err) {
                            console.error('Failed to remove service:', err);
                            alert('Failed to remove service');
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
          <div className="pagination">
            <span>Page {servicesData?.pagination?.current || 1} of {servicesData?.pagination?.pages || 1}</span>
            <span>Total: {servicesData?.pagination?.total || 0} services</span>
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

export default AdminServicesTab;
