import React, { useState, useEffect } from 'react';
import { apiRequest, getApiBaseUrl } from '../../../utils/api';
import './Wizard.css';

const steps = [
  { key: 'basic', title: 'Basic Info' },
  { key: 'skills', title: 'Skills' },
  { key: 'experience', title: 'Experience & Education' },
  { key: 'portfolio', title: 'Portfolio & Media' },
  { key: 'rates', title: 'Rates & Preferences' },
  { key: 'branding', title: 'Branding' },
  { key: 'social', title: 'Social Proof' },
  { key: 'review', title: 'Review & Publish' }
];

const Wizard = () => {
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [data, setData] = useState({
    firstName: '', lastName: '', headline: '', tagline: '',
    skills: [], languages: [], experience: [], education: [],
    certifications: [], hourlyRate: 0, preferencesExtended: { remote: true, local: false, rateType: 'hourly' },
    bannerUrl: '', visibility: { showEmail: false, showPhone: false }, modes: { freelancer: true, client: false },
    username: '', portfolio: []
  });
  const [usernameInput, setUsernameInput] = useState('');
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest('/api/users/profile');
        const u = res.user || {};
        setData(prev => ({
          ...prev,
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          headline: u.headline || '',
          tagline: u.tagline || '',
          skills: u.skills || [],
          hourlyRate: u.hourlyRate || 0,
          visibility: u.visibility || prev.visibility,
          modes: u.modes || prev.modes,
          username: u.username || '',
          portfolio: u.portfolio || []
        }));
        setUsernameInput(u.username || '');
      } catch {}
    })();
  }, []);

  const progress = Math.round(((stepIdx + 1) / steps.length) * 100);

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s) return;
    if (data.skills.includes(s)) return;
    setData(d => ({ ...d, skills: [...d.skills, s] }));
    setNewSkill('');
  };
  const removeSkill = (s) => setData(d => ({ ...d, skills: d.skills.filter(x => x !== s) }));

  const saveStep = async () => {
    setSaving(true);
    setMsg('');
    try {
      await apiRequest('/api/users/profile', {
        method: 'PUT',
        headers: {},
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          headline: data.headline,
          tagline: data.tagline,
          skills: data.skills,
          hourlyRate: data.hourlyRate,
          visibility: data.visibility,
          modes: data.modes
        })
      });
      setMsg('Saved');
      setTimeout(() => setMsg(''), 1200);
      return true;
    } catch (e) {
      setMsg('Failed to save');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onNext = async () => {
    const ok = await saveStep();
    if (!ok) return;
    setStepIdx(i => Math.min(i + 1, steps.length - 1));
  };
  const onBack = () => setStepIdx(i => Math.max(i - 1, 0));

  return (
    <div className="wizard-container">
      <div className="wizard-header">
        <h1>Set up your profile</h1>
        <div className="progress-bar">
          <div className="progress" style={{ width: `${progress}%` }} />
        </div>
        <div className="steps">
          {steps.map((s, i) => (
            <div key={s.key} className={`step ${i === stepIdx ? 'active' : ''}`}>{s.title}</div>
          ))}
        </div>
      </div>

      <div className="wizard-content">
        {steps[stepIdx].key === 'basic' && (
          <div className="section">
            <div className="row">
              <label>First name</label>
              <input value={data.firstName} onChange={e => setData(d => ({ ...d, firstName: e.target.value }))} />
            </div>
            <div className="row">
              <label>Last name</label>
              <input value={data.lastName} onChange={e => setData(d => ({ ...d, lastName: e.target.value }))} />
            </div>
            <div className="row">
              <label>Headline</label>
              <input placeholder="e.g., Full-Stack Web Developer" value={data.headline} onChange={e => setData(d => ({ ...d, headline: e.target.value }))} />
              <small>Tip: A strong headline: "Certified Web Developer | React &amp; Node.js Expert"</small>
            </div>
            <div className="row">
              <label>Tagline</label>
              <input placeholder="Short pitch" value={data.tagline} onChange={e => setData(d => ({ ...d, tagline: e.target.value }))} />
            </div>
          </div>
        )}

        {steps[stepIdx].key === 'skills' && (
          <div className="section">
            <div className="row">
              <label>Skills</label>
              <div className="skills-input">
                <input value={newSkill} onChange={e => setNewSkill(e.target.value)} placeholder="Add a skill..." onKeyDown={e => e.key==='Enter' && (e.preventDefault(), addSkill())} />
                <button type="button" onClick={addSkill}>Add</button>
              </div>
              <div className="skills-list">
                {data.skills.map((s, i) => (
                  <span key={i} className="skill-tag">
                    {s}
                    <button type="button" onClick={() => removeSkill(s)}>×</button>
                  </span>
                ))}
              </div>
              <small>Suggestion: Add at least 5 skills to boost discoverability.</small>
            </div>
          </div>
        )}

        {steps[stepIdx].key === 'portfolio' && (
          <div className="section">
            <div className="row">
              <label>Upload portfolio files</label>
              <input type="file" multiple onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;
                try {
                  setSaving(true);
                  const form = new FormData();
                  files.forEach(f => form.append('files', f));
                  const token = localStorage.getItem('token') || '';
                  const resp = await fetch(`${getApiBaseUrl()}/api/portfolio/upload?watermark=true`, {
                    method: 'POST',
                    headers: { Authorization: token ? `Bearer ${token}` : '' },
                    body: form
                  });
                  if (!resp.ok) throw new Error();
                  const json = await resp.json();
                  const urls = json.files || [];
                  setData(d => ({ ...d, portfolio: [...(d.portfolio || []), ...urls.map(u => ({ title: '', description: '', mediaUrls: [u] }))] }));
                  setMsg('Uploaded');
                } catch {
                  setMsg('Upload failed');
                } finally {
                  setSaving(false);
                  setTimeout(() => setMsg(''), 1500);
                }
              }} />
              <small>Images will be watermarked for protection.</small>
            </div>
            {!!data.portfolio?.length && (
              <div className="gallery-grid">
                {data.portfolio.flatMap((p, idx) =>
                  (p.mediaUrls || []).map((url, i) => {
                    const lower = String(url).toLowerCase();
                    const isVideo = lower.endsWith('.mp4') || lower.endsWith('.mov');
                    return (
                      <a key={`${idx}-${i}`} href={url} target="_blank" rel="noreferrer">
                        {isVideo ? (
                          <video src={url} controls style={{ width: '100%', height: 'auto' }} />
                        ) : (
                          <img src={url} alt="Portfolio" />
                        )}
                      </a>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {steps[stepIdx].key === 'branding' && (
          <div className="section">
            <div className="row">
              <label>Custom URL</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>fetchwork.com/freelancer/</span>
                <input value={usernameInput} onChange={e => setUsernameInput(e.target.value)} placeholder="username" />
                <button type="button" onClick={async () => {
                  const u = (usernameInput || '').trim();
                  if (!u) return;
                  try {
                    const avail = await apiRequest(`/api/users/username-availability?username=${encodeURIComponent(u)}`);
                    if (avail && avail.available) {
                      const saved = await apiRequest('/api/users/me/username', { method: 'PUT', body: JSON.stringify({ username: u }) });
                      setData(d => ({ ...d, username: saved.username }));
                      setMsg('Username set');
                    } else {
                      setMsg('Username is taken');
                    }
                  } catch {
                    setMsg('Failed to set username');
                  } finally {
                    setTimeout(() => setMsg(''), 1500);
                  }
                }}>Set</button>
              </div>
              <small>Your public profile will be at /freelancer/username</small>
            </div>
            <div className="row">
              <label>Show email publicly</label>
              <input type="checkbox" checked={!!data.visibility?.showEmail} onChange={e => setData(d => ({ ...d, visibility: { ...d.visibility, showEmail: e.target.checked } }))} />
            </div>
            <div className="row">
              <label>Show phone publicly</label>
              <input type="checkbox" checked={!!data.visibility?.showPhone} onChange={e => setData(d => ({ ...d, visibility: { ...d.visibility, showPhone: e.target.checked } }))} />
            </div>
            <div className="row">
              <label>Mode</label>
              <select value={data.modes?.freelancer ? 'freelancer' : data.modes?.client ? 'client' : 'both'} onChange={e => {
                const v = e.target.value;
                setData(d => ({ ...d, modes: { freelancer: v !== 'client', client: v !== 'freelancer' } }));
              }}>
                <option value="freelancer">Freelancer</option>
                <option value="client">Client</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>
        )}

        {steps[stepIdx].key !== 'basic' && steps[stepIdx].key !== 'skills' && steps[stepIdx].key !== 'branding' && steps[stepIdx].key !== 'portfolio' && (
          <div className="section">
            <p>Coming soon in this phase: {steps[stepIdx].title}</p>
          </div>
        )}
      </div>

      <div className="wizard-actions">
        {msg && <div className="info">{msg}</div>}
        <button onClick={onBack} disabled={stepIdx === 0 || saving}>Back</button>
        <button onClick={onNext} disabled={saving}>{stepIdx === steps.length - 1 ? 'Publish' : 'Save & Next'}</button>
      </div>
    </div>
  );
};

export default Wizard;
