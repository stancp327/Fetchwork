import React, { useState, useEffect } from 'react';
import './EmailPreferences.css';
import { getApiBaseUrl } from '../../utils/api';

const EmailPreferences = () => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const apiBaseUrl = getApiBaseUrl();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBaseUrl}/api/preferences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setPreferences(data.preferences);
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (newPreferences) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBaseUrl}/api/preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ preferences: newPreferences })
      });
      
      if (response.ok) {
        setPreferences(newPreferences);
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (category, setting) => {
    const newPreferences = {
      ...preferences,
      [category]: {
        ...preferences[category],
        [setting]: !preferences[category][setting]
      }
    };
    updatePreferences(newPreferences);
  };

  const handleFrequencyChange = (frequency) => {
    const newPreferences = {
      ...preferences,
      notificationFrequency: frequency
    };
    updatePreferences(newPreferences);
  };

  if (loading) return <div className="ep-loading">Loading preferences...</div>;

  return (
    <div className="ep-email-preferences">
      <h2>Email Preferences</h2>
      
      <div className="ep-preference-section">
        <h3>Email Notifications</h3>
        {Object.entries(preferences.emailNotifications).map(([key, value]) => (
          <div key={key} className="ep-preference-item">
            <label>
              <input
                type="checkbox"
                checked={value}
                onChange={() => handleToggle('emailNotifications', key)}
                disabled={saving}
              />
              <span className="ep-preference-label">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </span>
            </label>
          </div>
        ))}
      </div>

      <div className="ep-preference-section">
        <h3>Notification Frequency</h3>
        <select
          value={preferences.notificationFrequency}
          onChange={(e) => handleFrequencyChange(e.target.value)}
          disabled={saving}
        >
          <option value="immediate">Immediate</option>
          <option value="daily">Daily Digest</option>
          <option value="weekly">Weekly Digest</option>
        </select>
      </div>

      <div className="ep-preference-section">
        <h3>SMS Notifications</h3>
        <div className="ep-preference-item">
          <label>
            <input
              type="checkbox"
              checked={preferences.smsNotifications}
              onChange={() => handleToggle('smsNotifications')}
              disabled={saving}
            />
            <span className="ep-preference-label">
              Enable SMS notifications
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default EmailPreferences;
