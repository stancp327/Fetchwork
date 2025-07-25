import React from 'react';

const ActivitySection = ({ title, items, renderItem }) => (
  <div className="activity-section">
    <h3>{title}</h3>
    <div className="activity-list">
      {items && items.length > 0 ? items.map((item, index) => (
        <div key={index} className="activity-item">
          {renderItem(item)}
        </div>
      )) : <p>No recent {title.toLowerCase()}</p>}
    </div>
  </div>
);

export default ActivitySection;
