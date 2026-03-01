import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { apiRequest } from '../utils/api';

/**
 * useFeatures — fetch and cache the current user's resolved feature flags.
 *
 * Priority chain is resolved server-side (individual grant → group → plan → fallback).
 * This hook is the single way frontend components check feature access.
 *
 * Usage:
 *   const { hasFeature, features, loading } = useFeatures();
 *   if (hasFeature('recurring_services')) { ... }
 */

// Module-level cache (cleared on logout)
let _cache = null;
let _cacheUserId = null;

export function clearFeaturesCache() {
  _cache = null;
  _cacheUserId = null;
}

export function useFeatures() {
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id || auth?.user?._id;
  const isAuthenticated = !!userId;

  const [features, setFeatures] = useState(_cache || {});
  const [loading,  setLoading]  = useState(!_cache || _cacheUserId !== userId);

  useEffect(() => {
    if (!isAuthenticated) { setFeatures({}); setLoading(false); return; }
    if (_cache && _cacheUserId === userId) { setFeatures(_cache); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    apiRequest('/api/auth/me/features')
      .then(data => {
        if (cancelled) return;
        _cache = data.features || {};
        _cacheUserId = userId;
        setFeatures(_cache);
      })
      .catch(() => {
        // Fail open — don't block UI on error
        if (!cancelled) setFeatures({});
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [userId, isAuthenticated]);

  const hasFeature = (feature) => {
    if (loading) return true; // optimistic while loading — backend gates anyway
    return features[feature] === true;
  };

  return { features, hasFeature, loading };
}
