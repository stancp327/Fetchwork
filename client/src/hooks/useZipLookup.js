/**
 * useZipLookup
 * Validates a 5-digit US zip code via /api/geo/zip/:zip (zippopotam.us)
 * Returns { city, state, lat, lon } or null if invalid.
 * Debounced 500ms to avoid hammering on keystroke.
 */
import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';

export function useZipLookup(zip) {
  const [result, setResult] = useState(null);   // { city, state, lat, lon }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const clean = (zip || '').replace(/\D/g, '');
    if (clean.length !== 5) {
      setResult(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const data = await apiRequest(`/api/geo/zip/${clean}`);
        setResult(data);
        setError(null);
      } catch {
        setResult(null);
        setError('Invalid zip code');
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [zip]);

  return { result, loading, error };
}
