import React, { useState, useEffect, useMemo } from 'react';
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

const emptyExperience = { company: '', role: '', startDate: '', endDate: '', description: '' };
const emptyEducation = { school: '', degree: '', startDate: '', endDate: '' };
const emptyCert = { name: '', issuer: '', date: '', credentialUrl: '' };
const emptyLanguage = { name: '', level: 'Intermediate' };

const Wizard = () => {
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [data, setData] = useState({
    firstName: '', lastName: '', headline: '', tagline: '',
    skills: [], languages: [], experience: [], education: [],
    certifications: [], hourlyRate: 0, preferencesExtended: { remote: true, local: false, rateType: 'hourly', availabilityDays: [], availabilityHours: '' },
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
          languages: u.languages || [],
          experience: u.experience || [],
          education: u.education || [],
          certifications: u.certifications || [],
          hourlyRate: u.hourlyRate || 0,
          preferencesExtended: u.preferencesExtended || prev.preferencesExtended,
          visibility: u.visibility || prev.visibility,
          modes: u.modes || prev.modes,
          username: u.username || '',
          portfolio: u.portfolio || [],
          bannerUrl: u.bannerUrl || ''
        }));
        setUsernameInput(u.username || '');
      } catch {}
    })();
  }, []);

  const stepProgress = Math.round(((stepIdx + 1) / steps.length) * 100);

  const completion = useMemo(() => {
    const checks = [
      Boolean(data.headline && data.headline.trim().length >= 3),
      Array.isArray(data.skills) && data.skills.length >= 5,
      Array.isArray(data.portfolio) && data.portfolio.length > 0,
      Number(data.hourlyRate) > 0 || (data.preferencesExtended && (data.preferencesExtended.rateType === 'fixed')),
      Boolean(data.username && data.username.trim().length > 0),
      Boolean(data.tagline && data.tagline.trim().length >= 10)
    ];
    const total = checks.length;
    const achieved = checks.filter(Boolean).length;
    return Math.max(0, Math.min(100, Math.round((achieved / Math.max(total, 1)) * 100)));
  }, [data]);

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
      const key = steps[stepIdx].key;
      const body = {};
      if (key === 'basic') {
        body.firstName = data.firstName;
        body.lastName = data.lastName;
        body.headline = data.headline;
        body.tagline = data.tagline;
      } else if (key === 'skills') {
        body.skills = data.skills;
      } else if (key === 'experience') {
        body.experience = data.experience;
        body.education = data.education;
        body.certifications = data.certifications;
        body.languages = data.languages;
      } else if (key === 'portfolio') {
        body.portfolio = data.portfolio;
        body.bannerUrl = data.bannerUrl;
      } else if (key === 'rates') {
        body.hourlyRate = data.hourlyRate;
        body.preferencesExtended = data.preferencesExtended;
      } else if (key === 'branding') {
        body.visibility = data.visibility;
        body.modes = data.modes;
      } else if (key === 'social') {
      } else if (key === 'review') {
        body.firstName = data.firstName;
        body.lastName = data.lastName;
        body.headline = data.headline;
        body.tagline = data.tagline;
        body.skills = data.skills;
        body.experience = data.experience;
        body.education = data.education;
        body.certifications = data.certifications;
        body.languages = data.languages;
        body.portfolio = data.portfolio;
        body.bannerUrl = data.bannerUrl;
        body.hourlyRate = data.hourlyRate;
        body.preferencesExtended = data.preferencesExtended;
        body.visibility = data.visibility;
        body.modes = data.modes;
      }
      if (Object.keys(body).length) {
        await apiRequest('/api/users/profile', {
          method: 'PUT',
          headers: {},
          body: JSON.stringify(body)
        });
      }
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
    if (steps[stepIdx].key === 'review' && data.username) {
      window.location.href = `/freelancer/${encodeURIComponent(data.username)}`;
      return;
    }
    setStepIdx(i => Math.min(i + 1, steps.length - 1));
  };
  const onBack = () => setStepIdx(i => Math.max(i - 1, 0));

  const updateArrayItem = (listKey, idx, field, value) => {
    setData(d => {
      const next = (d[listKey] || []).slice();
      next[idx] = { ...(next[idx] || {}), [field]: value };
      return { ...d, [listKey]: next };
    });
  };
  const addArrayItem = (listKey, emptyObj) => setData(d => ({ ...d, [listKey]: [...(d[listKey] || []), emptyObj] }));
  const removeArrayItem = (listKey, idx) => setData(d => ({ ...d, [listKey]: (d[listKey] || []).filter((_, i) => i !== idx) }));

  return (
    <div className="wizard-container">
      <div className="wizard-header">
        <h1>Set up your profile</h1>
        <div className="progress-bar">
          <div className="progress" style={{ width: `${stepProgress}%` }} />
        </div>
        <div className="steps">
          {steps.map((s, i) => (
            <div key={s.key} className={`step ${i === stepIdx ? 'active' : ''}`}>{s.title}</div>
          ))}
        </div>
        <div className="completion-meter">
          <span>Profile strength: {completion}%</span>
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
              <div className="row">
                <label>Languages</label>
                <div>
                  {(data.languages || []).map((lan, i) => (
                    <div key={i} className="list-row">
                      <input placeholder="Language" value={lan.name} onChange={e => updateArrayItem('languages', i, 'name', e.target.value)} />
                      <select value={lan.level || 'Intermediate'} onChange={e => updateArrayItem('languages', i, 'level', e.target.value)}>
                        <option>Beginner</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                        <option>Native</option>
                      </select>
                      <button type="button" onClick={() => removeArrayItem('languages', i)}>Remove</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addArrayItem('languages', { ...emptyLanguage })}>Add language</button>
                </div>
              </div>
              <small>Suggestion: Add at least 5 skills to boost discoverability.</small>
            </div>
          </div>
        )}

        {steps[stepIdx].key === 'experience' && (
          <div className="section">
            <div className="row">
              <label>Experience</label>
              <div>
                {(data.experience || []).map((it, i) => (
                  <div key={i} className="list-card">
                    <input placeholder="Company" value={it.company} onChange={e => updateArrayItem('experience', i, 'company', e.target.value)} />
                    <input placeholder="Role" value={it.role} onChange={e => updateArrayItem('experience', i, 'role', e.target.value)} />
                    <div className="two">
                      <input type="date" value={it.startDate} onChange={e => updateArrayItem('experience', i, 'startDate', e.target.value)} />
                      <input type="date" value={it.endDate} onChange={e => updateArrayItem('experience', i, 'endDate', e.target.value)} />
                    </div>
                    <textarea placeholder="Description" value={it.description} onChange={e => updateArrayItem('experience', i, 'description', e.target.value)} />
                    <button type="button" onClick={() => removeArrayItem('experience', i)}>Remove</button>
                  </div>
                ))}
                <button type="button" onClick={() => addArrayItem('experience', { ...emptyExperience })}>Add experience</button>
              </div>
            </div>
            <div className="row">
              <label>Education</label>
              <div>
                {(data.education || []).map((it, i) => (
                  <div key={i} className="list-card">
                    <input placeholder="School" value={it.school} onChange={e => updateArrayItem('education', i, 'school', e.target.value)} />
                    <input placeholder="Degree" value={it.degree} onChange={e => updateArrayItem('education', i, 'degree', e.target.value)} />
                    <div className="two">
                      <input type="date" value={it.startDate} onChange={e => updateArrayItem('education', i, 'startDate', e.target.value)} />
                      <input type="date" value={it.endDate} onChange={e => updateArrayItem('education', i, 'endDate', e.target.value)} />
                    </div>
                    <button type="button" onClick={() => removeArrayItem('education', i)}>Remove</button>
                  </div>
                ))}
                <button type="button" onClick={() => addArrayItem('education', { ...emptyEducation })}>Add education</button>
              </div>
            </div>
            <div className="row">
              <label>Certifications</label>
              <div>
                {(data.certifications || []).map((it, i) => (
                  <div key={i} className="list-card">
                    <input placeholder="Name" value={it.name} onChange={e => updateArrayItem('certifications', i, 'name', e.target.value)} />
                    <input placeholder="Issuer" value={it.issuer} onChange={e => updateArrayItem('certifications', i, 'issuer', e.target.value)} />
                    <input type="date" value={it.date || ''} onChange={e => updateArrayItem('certifications', i, 'date', e.target.value)} />
                    <input placeholder="Credential URL" value={it.credentialUrl || ''} onChange={e => updateArrayItem('certifications', i, 'credentialUrl', e.target.value)} />
                    <button type="button" onClick={() => removeArrayItem('certifications', i)}>Remove</button>
                  </div>
                ))}
                <button type="button" onClick={() => addArrayItem('certifications', { ...emptyCert })}>Add certification</button>
              </div>
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
                {data.portfolio.map((p, idx) => (
                  <div key={idx} className="list-card">
                    <div className="gallery-row">
                      {(p.mediaUrls || []).map((url, i) => {
                        const lower = String(url).toLowerCase();
                        const isVideo = lower.endsWith('.mp4') || lower.endsWith('.mov');
                        return (
                          <a key={`${idx}-${i}`} href={url} target="_blank" rel="noreferrer">
                            {isVideo ? (
                              <video src={url} controls style={{ width: 160, height: 100 }} />
                            ) : (
                              <img src={url} alt="Portfolio" style={{ width: 160, height: 100, objectFit: 'cover' }} />
                            )}
                          </a>
                        );
                      })}
                    </div>
                    <input placeholder="Title" value={p.title || ''} onChange={e => updateArrayItem('portfolio', idx, 'title', e.target.value)} />
                    <textarea placeholder="Description" value={p.description || ''} onChange={e => updateArrayItem('portfolio', idx, 'description', e.target.value)} />
                    <button type="button" onClick={() => removeArrayItem('portfolio', idx)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {steps[stepIdx].key === 'rates' && (
          <div className="section">
            <div className="row">
              <label>Rate type</label>
              <select value={data.preferencesExtended?.rateType || 'hourly'} onChange={e => setData(d => ({ ...d, preferencesExtended: { ...d.preferencesExtended, rateType: e.target.value } }))}>
                <option value="hourly">Hourly</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            {data.preferencesExtended?.rateType === 'hourly' && (
              <div className="row">
                <label>Hourly rate (USD)</label>
                <input type="number" min="0" value={data.hourlyRate} onChange={e => setData(d => ({ ...d, hourlyRate: Number(e.target.value || 0) }))} />
                <small>Freelancers like you typically charge $25–40/hr.</small>
              </div>
            )}
            <div className="row">
              <label>Availability hours</label>
              <input placeholder="e.g., 9am–5pm" value={data.preferencesExtended?.availabilityHours || ''} onChange={e => setData(d => ({ ...d, preferencesExtended: { ...d.preferencesExtended, availabilityHours: e.target.value } }))} />
            </div>
            <div className="row">
              <label>Work preference</label>
              <div className="two">
                <label><input type="checkbox" checked={!!data.preferencesExtended?.remote} onChange={e => setData(d => ({ ...d, preferencesExtended: { ...d.preferencesExtended, remote: e.target.checked } }))} /> Remote</label>
                <label><input type="checkbox" checked={!!data.preferencesExtended?.local} onChange={e => setData(d => ({ ...d, preferencesExtended: { ...d.preferencesExtended, local: e.target.checked } }))} /> Local</label>
              </div>
            </div>
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

        {steps[stepIdx].key === 'social' && (
          <div className="section">
            <p>Social proof features are coming soon. You can publish your profile now and add testimonials later.</p>
          </div>
        )}

        {steps[stepIdx].key === 'review' && (
          <div className="section">
            <h2>Review</h2>
            <p>Profile strength: {completion}%</p>
            <ul>
              <li>Headline: {data.headline || '—'}</li>
              <li>Skills: {(data.skills || []).join(', ') || '—'}</li>
              <li>Portfolio items: {data.portfolio?.length || 0}</li>
              <li>Username: {data.username || 'Not set'}</li>
            </ul>
            {!data.username && <small>Set your custom URL in Branding before publishing.</small>}
          </div>
        )}
      </div>

      <div className="wizard-actions">
        {msg && <div className="info">{msg}</div>}
        <button onClick={onBack} disabled={stepIdx === 0 || saving}>Back</button>
        <button onClick={onNext} disabled={saving || (steps[stepIdx].key === 'review' && !data.username)}>{steps[stepIdx].key === 'review' ? 'Publish' : 'Save & Next'}</button>
      </div>
    </div>
  );
};

export default Wizard;
