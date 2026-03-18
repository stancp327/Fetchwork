import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import './SmsPreferences.css';

const CATEGORIES = [
  { key: 'messages',         label: 'New messages',        desc: 'When someone sends you a message' },
  { key: 'bookingReminders', label: 'Booking reminders',   desc: '24h and 1h before your sessions' },
  { key: 'payments',         label: 'Payments & payouts',  desc: 'When you receive or send money' },
  { key: 'proposals',        label: 'Proposals',           desc: 'When proposals are submitted or accepted' },
  { key: 'disputes',         label: 'Disputes',            desc: 'Updates on active disputes' },
  { key: 'marketing',        label: 'Tips & promotions',   desc: 'Occasional tips and feature announcements' },
];

const SmsPreferences = () => {
  const [phone, setPhone]           = useState('');
  const [master, setMaster]         = useState(false);
  const [optIn, setOptIn]           = useState({});
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    apiRequest('/api/users/profile').then(({ user: data }) => {
      setPhone(data.phone || '');
      setMaster(data.preferences?.smsNotifications || false);
      setOptIn(data.preferences?.smsOptIn || {});
    }).catch(() => {});
  }, []);

  const toggle = (key) => setOptIn(prev => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    // Normalize to E.164: strip spaces/dashes/parens, add + if missing
    let cleaned = phone.replace(/[\s\-().]/g, '');
    if (cleaned && !cleaned.startsWith('+')) cleaned = '+1' + cleaned; // default to US if no country code
    if (cleaned && !/^\+[1-9]\d{7,14}$/.test(cleaned)) {
      setError('Enter a valid phone number, e.g. +1 415 555 1234');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await apiRequest('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({
          phone: cleaned,
          preferences: {
            smsNotifications: master,
            smsOptIn: optIn,
          },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sms-prefs">
      <h2>📱 SMS Notifications</h2>
      <p className="sms-prefs-sub">Opt in to text message alerts. Standard message rates apply.</p>

      <div className="sms-phone-row">
        <label>Mobile number</label>
        <input
          type="tel"
          className="sms-phone-input"
          placeholder="+1 415 555 1234"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />
        {error && <p className="sms-error">{error}</p>}
      </div>

      <div className="sms-master-toggle">
        <label className="sms-toggle-label">
          <input
            type="checkbox"
            checked={master}
            onChange={e => setMaster(e.target.checked)}
          />
          <span className="sms-toggle-track" />
          <span className="sms-toggle-text">Enable SMS notifications</span>
        </label>
      </div>

      {master && (
        <div className="sms-categories">
          {CATEGORIES.map(({ key, label, desc }) => (
            <div key={key} className="sms-category-row">
              <label className="sms-toggle-label">
                <input
                  type="checkbox"
                  checked={optIn[key] !== false} // default true
                  onChange={() => toggle(key)}
                />
                <span className="sms-toggle-track" />
                <div className="sms-category-info">
                  <span className="sms-category-name">{label}</span>
                  <span className="sms-category-desc">{desc}</span>
                </div>
              </label>
            </div>
          ))}
        </div>
      )}

      <button className="sms-save-btn" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save preferences'}
      </button>
    </div>
  );
};

export default SmsPreferences;
