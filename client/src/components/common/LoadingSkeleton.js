import React from 'react';
import './LoadingSkeleton.css';

const LoadingSkeleton = ({ 
  width = '100%', 
  height = '20px', 
  borderRadius = 'var(--radius-md)',
  className = '',
  count = 1 
}) => {
  const skeletons = Array.from({ length: count }, (_, index) => (
    <div
      key={index}
      className={`loading-skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        marginBottom: count > 1 && index < count - 1 ? '8px' : '0'
      }}
    />
  ));

  return count === 1 ? skeletons[0] : <div className="loading-skeleton-group">{skeletons}</div>;
};

export const SkeletonCard = () => (
  <div className="skeleton-card">
    <LoadingSkeleton height="200px" borderRadius="var(--radius-lg)" />
    <div className="skeleton-card-content">
      <LoadingSkeleton height="24px" width="80%" />
      <LoadingSkeleton height="16px" width="60%" />
      <LoadingSkeleton height="16px" width="40%" />
    </div>
  </div>
);

export const SkeletonList = ({ items = 3 }) => (
  <div className="skeleton-list">
    {Array.from({ length: items }, (_, index) => (
      <div key={index} className="skeleton-list-item">
        <LoadingSkeleton width="40px" height="40px" borderRadius="var(--radius-full)" />
        <div className="skeleton-list-content">
          <LoadingSkeleton height="18px" width="70%" />
          <LoadingSkeleton height="14px" width="50%" />
        </div>
      </div>
    ))}
  </div>
);

export default LoadingSkeleton;
