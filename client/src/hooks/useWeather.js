/**
 * useWeather
 * Fetches a 7-day daily forecast from Open-Meteo (free, no key, HTTPS).
 * https://open-meteo.com/
 *
 * @param {{ lat: number, lon: number }} coords
 * @param {string} targetDate  — ISO date string 'YYYY-MM-DD' to highlight
 */
import { useState, useEffect } from 'react';

const WMO_CODES = {
  0: { label: 'Clear', icon: '☀️' },
  1: { label: 'Mostly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Foggy', icon: '🌫️' },
  48: { label: 'Icy fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Heavy drizzle', icon: '🌧️' },
  61: { label: 'Light rain', icon: '🌧️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  71: { label: 'Light snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '❄️' },
  75: { label: 'Heavy snow', icon: '❄️' },
  80: { label: 'Rain showers', icon: '🌦️' },
  81: { label: 'Heavy showers', icon: '🌧️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  99: { label: 'Severe storm', icon: '🌩️' },
};

export function wmoCode(code) {
  return WMO_CODES[code] || { label: 'Unknown', icon: '🌡️' };
}

export function useWeather(coords, targetDate) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!coords?.lat || !coords?.lon) return;

    setLoading(true);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        const d = data.daily;
        if (!d) throw new Error('No forecast data');
        const result = (d.time || []).map((date, i) => ({
          date,
          high: Math.round(d.temperature_2m_max[i]),
          low:  Math.round(d.temperature_2m_min[i]),
          rain: d.precipitation_probability_max[i] ?? 0,
          code: d.weathercode[i] ?? 0,
          ...wmoCode(d.weathercode[i] ?? 0),
          isTarget: date === targetDate,
        }));
        setDays(result);
        setError(null);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [coords?.lat, coords?.lon, targetDate]);

  return { days, loading, error };
}
