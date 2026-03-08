import React from 'react';
import './OnlineStatus.css';

// Format lastSeen into a human-readable string
export const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return null;
  const diff = Date.now() - new Date(lastSeen).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(lastSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Format avgResponseTime (minutes) into a readable label
export const formatResponseTime = (minutes) => {
  if (minutes == null) return null;
  if (minutes < 60)    return `~${Math.round(minutes)}m`;
  const hrs = Math.round(minutes / 60);
  if (hrs < 24)        return `~${hrs}h`;
  return `~${Math.round(hrs / 24)}d`;
};

/**
 * OnlineStatus
 *
 * Props:
 *   isOnline      {boolean}   — whether user is currently connected
 *   lastSeen      {string}    — ISO date string (from DB)
 *   size          {'sm'|'md'} — dot size (default 'md')
 *   showLabel     {boolean}   — show text label (default true)
 *   className     {string}    — extra class on wrapper
 */
const OnlineStatus = ({ isOnline, lastSeen, size = 'md', showLabel = true, className = '' }) => {
  const label = isOnline
    ? 'Available now'
    : lastSeen
      ? `Last seen ${formatLastSeen(lastSeen)}`
      : 'Offline';

  return (
    <span className={`os-online-status os-online-status--${size} ${className}`} title={label}>
      <span className={`os-online-dot ${isOnline ? 'online' : 'offline'}`} />
      {showLabel && <span className="os-online-label">{label}</span>}
    </span>
  );
};

export default OnlineStatus;
