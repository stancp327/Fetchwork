import React from 'react';

const SafetyNudge = ({ text, onClose }) => {
  if (!text) return null;
  return (
    <div style={{
      background: '#fff7ed',
      border: '1px solid #fdba74',
      color: '#9a3412',
      padding: '10px 12px',
      borderRadius: 8,
      marginBottom: 10,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    }}>
      <span>🛡️ {text}</span>
      <button onClick={onClose} style={{ background: 'transparent', border: 0, color: '#9a3412', cursor: 'pointer' }}>Dismiss</button>
    </div>
  );
};

export default SafetyNudge;
