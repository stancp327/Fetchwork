import { useState, useCallback, useRef } from 'react';

/**
 * useZipLookup — zip code → city/state autofill via Zippopotam.us
 * Free, no API key, no rate limit.
 *
 * Usage:
 *   const { lookupZip, zipLoading, zipError } = useZipLookup();
 *
 *   // Call on zip input change (debounced internally):
 *   const handleZipChange = (e) => {
 *     const zip = e.target.value;
 *     setFormData(f => ({ ...f, zipCode: zip }));
 *     lookupZip(zip, ({ city, state, stateCode, lat, lon }) => {
 *       setFormData(f => ({ ...f, city, state: stateCode }));
 *     });
 *   };
 */

const cache = new Map(); // simple in-memory cache per session

export function useZipLookup() {
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState(null);
  const debounceRef = useRef(null);

  const lookupZip = useCallback((zip, onResult, countryCode = 'us') => {
    // Only look up when zip is exactly 5 digits
    if (!zip || !/^\d{5}$/.test(zip)) {
      setZipError(null);
      return;
    }

    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const cacheKey = `${countryCode}:${zip}`;

      // Return cached result immediately
      if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (cached) onResult(cached);
        else setZipError('ZIP code not found');
        return;
      }

      setZipLoading(true);
      setZipError(null);

      try {
        const res = await fetch(`https://api.zippopotam.us/${countryCode}/${zip}`);

        if (res.status === 404) {
          cache.set(cacheKey, null);
          setZipError('ZIP code not found');
          setZipLoading(false);
          return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const place = data.places?.[0];
        if (!place) {
          cache.set(cacheKey, null);
          setZipError('ZIP code not found');
          setZipLoading(false);
          return;
        }

        const result = {
          city: place['place name'],
          state: place['state'],
          stateCode: place['state abbreviation'],
          lat: parseFloat(place.latitude),
          lon: parseFloat(place.longitude),
          country: data.country,
          countryCode: data['country abbreviation'],
        };

        cache.set(cacheKey, result);
        setZipError(null);
        onResult(result);
      } catch (err) {
        // Don't block the user — just don't autofill
        console.warn('[useZipLookup] lookup failed:', err.message);
        setZipError(null); // silent fail
      } finally {
        setZipLoading(false);
      }
    }, 400); // 400ms debounce
  }, []);

  return { lookupZip, zipLoading, zipError };
}
