import React from 'react';

const PaymentHistory = ({ payments, onRefresh }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'failed': return '#f44336';
      case 'disputed': return '#9C27B0';
      default: return '#666';
    }
  };

  return (
    <div className="payment-history">
      <div className="section-header">
        <h2>Payment History</h2>
        <button onClick={onRefresh} className="refresh-btn">
          Refresh
        </button>
      </div>

      {payments.length === 0 ? (
        <div className="no-payments">
          <p>No payment history found</p>
        </div>
      ) : (
        <div className="payments-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Job</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment._id}>
                  <td>{formatDate(payment.createdAt)}</td>
                  <td>{payment.job?.title || 'N/A'}</td>
                  <td className="payment-type">{payment.type}</td>
                  <td className="payment-amount">
                    ${payment.amount.toFixed(2)}
                  </td>
                  <td>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(payment.status) }}
                    >
                      {payment.status}
                    </span>
                  </td>
                  <td>{payment.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;
