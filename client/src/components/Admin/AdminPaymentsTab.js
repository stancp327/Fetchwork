import React from 'react';
import TracingErrorBoundary from '../common/TracingErrorBoundary';

const AdminPaymentsTab = ({ paymentsData, fetchPaymentsData }) => (
  <TracingErrorBoundary componentName="PaymentsTab">
    <div className="payments-tab">
      <h2>Payment Management</h2>
      {paymentsData ? (
        <div className="payments-management">
          <div className="payments-controls">
            <select className="status-filter" onChange={(e) => fetchPaymentsData(1, e.target.value)}>
              <option value="all">All Payments</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div className="payments-table">
            <table>
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Client</th>
                  <th>Freelancer</th>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(paymentsData?.payments) && paymentsData.payments.length > 0 ? paymentsData.payments.map((payment) => (
                  <tr key={payment._id}>
                    <td>${payment.amount}</td>
                    <td>{payment.client ? `${payment.client.firstName} ${payment.client.lastName}` : 'N/A'}</td>
                    <td>{payment.freelancer ? `${payment.freelancer.firstName} ${payment.freelancer.lastName}` : 'N/A'}</td>
                    <td>{payment.job ? payment.job.title : 'N/A'}</td>
                    <td><span className={`status ${payment.status}`}>{payment.status}</span></td>
                    <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                    <td><button className="action-btn view">View Details</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="no-data">No payments found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>Page {paymentsData?.pagination?.current || 1} of {paymentsData?.pagination?.pages || 1}</span>
            <span>Total: {paymentsData?.pagination?.total || 0} payments</span>
          </div>
        </div>
      ) : (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading payments...</p>
        </div>
      )}
    </div>
  </TracingErrorBoundary>
);

export default AdminPaymentsTab;
