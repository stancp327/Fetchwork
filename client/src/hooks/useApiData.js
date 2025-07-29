import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../utils/api';

export const useApiData = (endpoint, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest(endpoint);
      setData(response);
    } catch (err) {
      console.error(`Failed to fetch data from ${endpoint}:`, err);
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [endpoint, ...dependencies]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
};

export const useApiMutation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (endpoint, options = {}) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest(endpoint, options);
      return { success: true, data: response };
    } catch (err) {
      console.error(`API mutation failed for ${endpoint}:`, err);
      const errorMessage = err.response?.data?.error || 'Operation failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
};
