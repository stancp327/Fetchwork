import React from 'react';
import './TrustBadges.css';

// Inline badge — shows next to names on cards, search results, profiles
const TrustBadge = ({ type, size = 'sm' }) => {
  const badges = {
    email_verified: { icon: '✉️', label: 'Email Verified', color: '#2563eb' },
    id_verified: { icon: '🛡️', label: 'ID Verified', color: '#059669' },
    top_rated: { icon: '⭐', label: 'Top Rated', color: '#d97706' },
    bg_checked: { icon: '✅', label: 'Background Checked', color: '#7c3aed' },
  };
  const b = badges[type];
  if (!b) return null;
  return (
    <span className={`trust-badge trust-badge-${size}`} title={b.label} style={{ '--badge-color': b.color }}>
      <span className="trust-badge-icon">{b.icon}</span>
      {size !== 'xs' && <span className="trust-badge-label">{b.label}</span>}
    </span>
  );
};

// Badge row — renders all applicable badges for a user
const TrustBadges = ({ user, size = 'sm' }) => {
  if (!user) return null;

  const badges = [];

  // Email verified
  if (user.isEmailVerified || user.isVerified || user.badges?.includes('email_verified')) {
    badges.push('email_verified');
  }

  // ID verified
  if (user.verificationLevel === 'identity' || user.verificationLevel === 'full' || user.badges?.includes('id_verified')) {
    badges.push('id_verified');
  }

  // Top rated (4.5+ with 5+ reviews)
  if ((user.rating >= 4.5 && user.totalReviews >= 5) || user.badges?.includes('top_rated')) {
    badges.push('top_rated');
  }

  // Background checked (future)
  if (user.backgroundCheck?.status === 'passed' || user.badges?.includes('bg_checked')) {
    badges.push('bg_checked');
  }

  if (badges.length === 0) return null;

  return (
    <span className="trust-badges-row">
      {badges.map(b => <TrustBadge key={b} type={b} size={size} />)}
    </span>
  );
};

// Reputation stats bar — for profiles
const ReputationStats = ({ user }) => {
  if (!user) return null;

  const stats = [
    { label: 'Rating', value: user.rating ? `${user.rating.toFixed(1)} ⭐` : '—', show: true },
    { label: 'Reviews', value: user.totalReviews || 0, show: true },
    { label: 'Completed', value: user.completedJobs || 0, show: true },
    { label: 'On Time', value: user.onTimeDelivery != null ? `${user.onTimeDelivery}%` : '—', show: user.completedJobs > 0 },
    { label: 'Completion', value: user.completionRate != null ? `${user.completionRate}%` : '—', show: user.completedJobs > 0 },
    { label: 'Response', value: user.avgResponseTime ? `${user.avgResponseTime < 60 ? user.avgResponseTime + 'm' : Math.round(user.avgResponseTime / 60) + 'h'}` : '—', show: user.avgResponseTime != null },
    { label: 'Repeat Clients', value: user.repeatClientRate ? `${user.repeatClientRate}%` : '—', show: user.repeatClientRate > 0 },
  ].filter(s => s.show);

  return (
    <div className="reputation-stats">
      {stats.map(s => (
        <div key={s.label} className="rep-stat">
          <strong>{s.value}</strong>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
};

export { TrustBadge, TrustBadges, ReputationStats };
export default TrustBadges;
