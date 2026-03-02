export const STATUS_LABELS = {
  draft: 'Draft', open: 'Open',
  accepted: 'Accepted', pending_start: 'Awaiting Start',
  in_progress: 'In Progress',
  completed: 'Completed', cancelled: 'Cancelled', disputed: 'Disputed',
};

export const MILESTONE_STATUS_META = {
  pending:     { label: 'Pending',     color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { label: 'In Progress', color: '#2563eb', bg: '#eff6ff' },
  completed:   { label: 'Completed',   color: '#f59e0b', bg: '#fefce8' },
  approved:    { label: 'Approved',    color: '#10b981', bg: '#ecfdf5' },
};

export const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

export const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString();
};
