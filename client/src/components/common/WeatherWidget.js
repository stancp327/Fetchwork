/**
 * WeatherWidget
 * Shows a 7-day forecast strip from Open-Meteo, with the booking date highlighted.
 * Only renders when coords are available (local/in-person services).
 *
 * Usage:
 *   <WeatherWidget coords={{ lat: 37.9, lon: -122.0 }} targetDate="2026-03-15" />
 */
import React from 'react';
import { useWeather } from '../../hooks/useWeather';
import './WeatherWidget.css';

const WeatherWidget = ({ coords, targetDate }) => {
  const { days, loading, error } = useWeather(coords, targetDate);

  if (!coords?.lat || !coords?.lon) return null;
  if (loading) return <div className="weather-widget weather-widget--loading">🌡️ Loading forecast…</div>;
  if (error || !days.length) return null;

  return (
    <div className="weather-widget">
      <div className="weather-header">
        <span className="weather-title">📅 7-Day Forecast</span>
        <span className="weather-source">via Open-Meteo</span>
      </div>
      <div className="weather-strip">
        {days.map(d => (
          <div key={d.date} className={`weather-day${d.isTarget ? ' weather-day--target' : ''}`}>
            <div className="weather-dow">
              {d.isTarget ? 'Appt' : new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
            </div>
            <div className="weather-icon" title={d.label}>{d.icon}</div>
            <div className="weather-temps">
              <span className="weather-high">{d.high}°</span>
              <span className="weather-low">{d.low}°</span>
            </div>
            {d.rain > 0 && (
              <div className="weather-rain" title="Chance of precipitation">
                💧{d.rain}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeatherWidget;
