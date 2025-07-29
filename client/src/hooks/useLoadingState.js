import { useState, useCallback } from 'react';

export const useLoadingState = (initialState = false) => {
  const [loading, setLoading] = useState(initialState);
  const [error, setError] = useState(null);

  const withLoading = useCallback(async (asyncFn) => {
    try {
      setLoading(true);
      setError(null);
      const result = await asyncFn();
      return result;
    } catch (err) {
      console.error('Operation failed:', err);
      setError(err.response?.data?.error || err.message || 'Operation failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    withLoading,
    clearError,
    setLoading,
    setError
  };
};
