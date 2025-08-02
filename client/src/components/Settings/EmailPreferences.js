import React, { useState, useEffect } from 'react';
import './EmailPreferences.css';

const EmailPreferences = () => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const apiBaseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://fetchwork-1.onrender.com' 
    : 'http://localhost:10000';

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

  if (loading) return <div className="loading">Loading preferences...</div>;

  return (
    <div className="email-preferences">
      <h2>Email Preferences</h2>
      
      <div className="preference-section">
        <h3>Email Notifications</h3>
        {Object.entries(preferences.emailNotifications).map(([key, value]) => (
          <div key={key} className="preference-item">
            <label>
              <input
                type="checkbox"
                checked={value}
                onChange={() => handleToggle('emailNotifications', key)}
                disabled={saving}
              />
              <span className="preference-label">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </span>
            </label>
          </div>
        ))}
      </div>

      <div className="preference-section">
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

      <div className="preference-section">
        <h3>SMS Notifications</h3>
        <div className="preference-item">
          <label>
            <input
              type="checkbox"
              checked={preferences.smsNotifications}
              onChange={() => handleToggle('smsNotifications')}
              disabled={saving}
            />
            <span className="preference-label">
              Enable SMS notifications
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default EmailPreferences;
