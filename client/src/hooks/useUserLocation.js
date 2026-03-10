/**
 * useUserLocation
 * Detects user's approximate location via two methods:
 *  1. Browser Geolocation API (precise, requires permission)
 *  2. IP-based lookup via /api/geo/locate (approximate, always works)
 *
 * Returns { city, zip, lat, lon, loading, source }
 * Caches result in sessionStorage so it only fires once per session.
 */
import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';

const CACHE_KEY = 'fw_user_location';

export function useUserLocation({ skip = false } = {}) {
  const [location, setLocation] = useState({ city: '', zip: '', lat: null, lon: null, loading: !skip, source: null });

  useEffect(() => {
    if (skip) return;

    // Check session cache first
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        setLocation({ ...JSON.parse(cached), loading: false });
        return;
      }
    } catch (_) {}

    const save = (data) => {
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (_) {}
      setLocation({ ...data, loading: false });
    };

    // Try browser geolocation first (more accurate)
    if (navigator.geolocation) {
      const timer = setTimeout(async () => {
        // Geolocation timed out — fall back to IP
        try {
          const data = await apiRequest('/api/geo/locate');
          save({ city: data.city || '', zip: data.zip || '', lat: data.lat, lon: data.lon, source: 'ip' });
        } catch {
          save({ city: '', zip: '', lat: null, lon: null, source: 'error' });
        }
      }, 5000);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          // Got browser coords — use lat/lon directly (no zip from browser geo)
          save({
            city: '',
            zip:  '',
            lat:  pos.coords.latitude,
            lon:  pos.coords.longitude,
            source: 'browser',
          });
        },
        async () => {
          clearTimeout(timer);
          // Permission denied or error — fall back to IP
          try {
            const data = await apiRequest('/api/geo/locate');
            save({ city: data.city || '', zip: data.zip || '', lat: data.lat, lon: data.lon, source: 'ip' });
          } catch {
            save({ city: '', zip: '', lat: null, lon: null, source: 'error' });
          }
        },
        { timeout: 4000, maximumAge: 600000 }
      );
    } else {
      // No geolocation API — use IP
      apiRequest('/api/geo/locate')
        .then(data => save({ city: data.city || '', zip: data.zip || '', lat: data.lat, lon: data.lon, source: 'ip' }))
        .catch(() => save({ city: '', zip: '', lat: null, lon: null, source: 'error' }));
    }
  }, [skip]);

  return location;
}
