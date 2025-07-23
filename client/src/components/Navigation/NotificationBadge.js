import React from 'react';

const NotificationBadge = ({ type, count, children }) => {
  if (!count || count === 0) {
    return children;
  }

  const getBadgeClass = (type) => {
    const baseClass = 'nav-badge';
    switch (type) {
      case 'message':
        return `${baseClass} badge-message`;
      case 'proposal':
        return `${baseClass} badge-proposal`;
      case 'alert':
        return `${baseClass} badge-alert`;
      default:
        return baseClass;
    }
  };

  const formatCount = (count) => {
    if (count > 99) return '99+';
    return count.toString();
  };

  return (
    <div className="nav-badge-wrapper">
      {children}
      <span className={getBadgeClass(type)} aria-label={`${count} ${type}${count !== 1 ? 's' : ''}`}>
        {formatCount(count)}
      </span>
    </div>
  );
};

export default NotificationBadge;
