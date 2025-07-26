export const formatBudget = (budget) => {
  if (typeof budget === 'object' && budget.amount) {
    return `$${budget.amount.toLocaleString()} ${budget.type === 'hourly' ? '/hr' : budget.type || 'fixed'}`;
  }
  if (typeof budget === 'number') {
    return `$${budget.toLocaleString()}`;
  }
  return `$${budget}`;
};

export const formatDuration = (duration) => {
  const durationMap = {
    'less_than_1_week': 'Less than 1 week',
    '1_2_weeks': '1-2 weeks',
    '1_month': '1 month',
    '2_3_months': '2-3 months',
    '3_6_months': '3-6 months',
    'more_than_6_months': 'More than 6 months'
  };
  return durationMap[duration] || duration;
};

export const formatCategory = (category) => {
  return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export const formatJobStatus = (status) => {
  const statusMap = {
    'draft': 'Draft',
    'open': 'Open',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'disputed': 'Disputed'
  };
  return statusMap[status] || status;
};

export const getStatusClass = (status) => {
  const statusClasses = {
    'draft': 'status-tag draft',
    'open': 'status-tag open',
    'in_progress': 'status-tag in-progress',
    'completed': 'status-tag completed',
    'cancelled': 'status-tag cancelled',
    'disputed': 'status-tag disputed'
  };
  return statusClasses[status] || 'status-tag';
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};
