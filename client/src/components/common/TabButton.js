import React from 'react';

const TabButton = ({ id, label, active, onClick }) => (
  <button
    className={`tab-button ${active ? 'active' : ''}`}
    onClick={() => onClick(id)}
  >
    {label}
  </button>
);

export default TabButton;
