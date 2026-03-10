/**
 * usePublicHolidays
 * Fetches US public holidays from date.nager.at (free, no key, HTTPS).
 * https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}
 *
 * Returns { holidays: [{ date, name, localName }], loading }
 * Caches per year in sessionStorage.
 */
import { useState, useEffect } from 'react';

export function usePublicHolidays(year = new Date().getFullYear(), countryCode = 'US') {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cacheKey = `fw_holidays_${countryCode}_${year}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) { setHolidays(JSON.parse(cached)); return; }
    } catch (_) {}

    setLoading(true);
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = (data || []).map(h => ({ date: h.date, name: h.name, localName: h.localName }));
        setHolidays(list);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(list)); } catch (_) {}
      })
      .catch(() => setHolidays([]))
      .finally(() => setLoading(false));
  }, [year, countryCode]);

  return { holidays, loading };
}
