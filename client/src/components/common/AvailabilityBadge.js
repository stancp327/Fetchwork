import React from 'react';

const STATUS_MAP = {
  available: { label: 'Available Now', color: '#3b82f6', dot: '#3b82f6' },
  busy: { label: 'Busy', color: '#f59e0b', dot: '#f59e0b' },
  not_taking_work: { label: 'Not Taking Work', color: '#dc2626', dot: '#dc2626' },
  away: { label: 'Away', color: '#6b7280', dot: '#6b7280' },
};

const AvailabilityBadge = ({ status, compact = false }) => {
  const info = STATUS_MAP[status] || STATUS_MAP.available;

  if (compact) {
    return (
      <span title={info.label} style={{
        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
        background: info.dot, border: '2px solid white', boxShadow: '0 0 0 1px ' + info.dot + '40'
      }} />
    );
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
      background: info.color + '15', color: info.color
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: info.dot }} />
      {info.label}
    </span>
  );
};

export default AvailabilityBadge;
