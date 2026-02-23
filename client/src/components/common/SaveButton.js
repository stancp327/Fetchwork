import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const SaveButton = ({ itemId, itemType, size = 'md', className = '' }) => {
  const { isAuthenticated } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !itemId) return;
    apiRequest(`/api/saved/check/${itemId}`)
      .then(data => setSaved(data.isSaved))
      .catch(() => {});
  }, [itemId, isAuthenticated]);

  const toggle = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isAuthenticated || loading) return;

    setLoading(true);
    try {
      if (saved) {
        await apiRequest(`/api/saved/${itemId}`, { method: 'DELETE' });
        setSaved(false);
      } else {
        await apiRequest('/api/saved', {
          method: 'POST',
          body: JSON.stringify({ itemId, itemType })
        });
        setSaved(true);
      }
    } catch (err) {
      console.error('Save toggle failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  const sizes = { sm: '1.2rem', md: '1.5rem', lg: '1.8rem' };

  return (
    <button
      onClick={toggle}
      className={className}
      title={saved ? 'Remove from saved' : 'Save for later'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem',
        fontSize: sizes[size] || sizes.md, opacity: loading ? 0.5 : 1,
        transition: 'transform 0.15s',
        transform: saved ? 'scale(1.1)' : 'scale(1)',
        filter: saved ? 'none' : 'grayscale(0.5)'
      }}
    >
      {saved ? '❤️' : '🤍'}
    </button>
  );
};

export default SaveButton;
