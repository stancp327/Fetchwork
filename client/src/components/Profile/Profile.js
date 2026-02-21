import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import FileUpload from '../common/FileUpload';
import { getLocationDisplay } from '../../utils/location';
import './Profile.css';

const TABS = ['Overview', 'About', 'Skills', 'Portfolio', 'Rates', 'Verification', 'Settings'];

// ── Profile Completion ──────────────────────────────────────────
const calcCompletion = (data) => {
  const fields = [
    { key: 'firstName', w: 10 }, { key: 'lastName', w: 10 },
    { key: 'bio', w: 15 }, { key: 'profilePicture', w: 15 },
    { key: 'location', w: 5 }, { key: 'phone', w: 10 },
    { key: 'skills', w: 15, check: v => v?.length > 0 },
    { key: 'hourlyRate', w: 10, check: v => v > 0 },
    { key: 'socialLinks', w: 10, check: v => Object.values(v || {}).some(Boolean) },
  ];
  let score = 0;
  fields.forEach(f => {
    const val = data[f.key];
    if (f.check ? f.check(val) : val) score += f.w;
  });
  return Math.min(score, 100);
};

// ── Left Summary Card ───────────────────────────────────────────
const SummaryCard = ({ data, completion }) => (
  <div className="profile-summary-card">
    <div className="summary-avatar">
      {data.profilePicture ? (
        <img src={data.profilePicture} alt={data.firstName} />
      ) : (
        <div className="summary-avatar-placeholder">
          {data.firstName?.[0]}{data.lastName?.[0]}
        </div>
      )}
    </div>
    <h3 className="summary-name">{data.firstName} {data.lastName}</h3>
    {data.headline && <p className="summary-headline">{data.headline}</p>}
    {data.location && <p className="summary-location">📍 {getLocationDisplay(data.location)}</p>}

    <div className="summary-completion">
      <div className="completion-bar">
        <div className="completion-fill" style={{ width: `${completion}%` }} />
      </div>
      <span className="completion-text">{completion}% complete</span>
    </div>

    <div className="summary-stats">
      {data.hourlyRate > 0 && <div className="summary-stat"><span className="stat-val">${data.hourlyRate}</span><span className="stat-lbl">/hr</span></div>}
      <div className="summary-stat"><span className="stat-val">{data.skills?.length || 0}</span><span className="stat-lbl">skills</span></div>
      {data.rating > 0 && <div className="summary-stat"><span className="stat-val">⭐ {data.rating.toFixed(1)}</span><span className="stat-lbl">rating</span></div>}
    </div>
  </div>
);

// ── Tab: Overview ───────────────────────────────────────────────
const TabOverview = ({ data, completion, onTabChange }) => {
  const incomplete = [];
  if (!data.bio) incomplete.push({ label: 'Add a bio', tab: 1 });
  if (!data.profilePicture) incomplete.push({ label: 'Upload a profile photo', tab: 0 });
  if (!data.skills?.length) incomplete.push({ label: 'Add your skills', tab: 2 });
  if (!data.hourlyRate) incomplete.push({ label: 'Set your hourly rate', tab: 4 });
  if (!data.phone) incomplete.push({ label: 'Add your phone number', tab: 5 });

  return (
    <div className="tab-content">
      <h2>Profile Overview</h2>
      {completion < 100 && (
        <div className="overview-todo">
          <h3>Complete your profile ({completion}%)</h3>
          <p>A complete profile helps you get more visibility and trust.</p>
          <div className="todo-list">
            {incomplete.map((item, i) => (
              <button key={i} className="todo-item" onClick={() => onTabChange(item.tab)}>
                <span className="todo-circle" />
                <span>{item.label}</span>
                <span className="todo-arrow">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {completion === 100 && (
        <div className="overview-complete">
          🎉 Your profile is 100% complete! You're ready to stand out.
        </div>
      )}

      <div className="overview-grid">
        <div className="overview-card">
          <h4>About</h4>
          <p>{data.bio || 'No bio yet'}</p>
        </div>
        <div className="overview-card">
          <h4>Skills</h4>
          <div className="overview-skills">
            {data.skills?.length > 0 ? data.skills.map((s, i) => (
              <span key={i} className="ov-skill-tag">{s}</span>
            )) : <span className="ov-empty">No skills added</span>}
          </div>
        </div>
        <div className="overview-card">
          <h4>Rates</h4>
          <p>{data.hourlyRate > 0 ? `$${data.hourlyRate}/hr` : 'Not set'}</p>
        </div>
        <div className="overview-card">
          <h4>Contact</h4>
          <p>{data.phone || 'No phone'}</p>
          <p>{getLocationDisplay(data.location) || 'No location'}</p>
        </div>
      </div>
    </div>
  );
};

// ── Tab: About ──────────────────────────────────────────────────
const TabAbout = ({ data, onChange, onFileSelect }) => (
  <div className="tab-content">
    <h2>About You</h2>
    <div className="prof-field">
      <label>Profile Picture</label>
      <FileUpload
        onFileSelect={onFileSelect}
        accept="image/*" maxSize={5 * 1024 * 1024}
        label="Upload Photo" preview={true}
        currentFile={data.profilePicture}
      />
    </div>
    <div className="prof-row">
      <div className="prof-field">
        <label>First Name *</label>
        <input type="text" value={data.firstName} onChange={e => onChange('firstName', e.target.value)} required />
      </div>
      <div className="prof-field">
        <label>Last Name *</label>
        <input type="text" value={data.lastName} onChange={e => onChange('lastName', e.target.value)} required />
      </div>
    </div>
    <div className="prof-field">
      <label>Headline</label>
      <input type="text" value={data.headline || ''} onChange={e => onChange('headline', e.target.value)} placeholder="e.g. Full-Stack Developer | React & Node.js" maxLength={100} />
    </div>
    <div className="prof-field">
      <label>Bio</label>
      <textarea value={data.bio} onChange={e => onChange('bio', e.target.value)} placeholder="Tell clients about yourself, your experience, and what makes you different..." rows={5} maxLength={500} />
      <div className="field-footer"><span /><span className="char-count">{data.bio.length}/500</span></div>
    </div>
    <div className="prof-row">
      <div className="prof-field">
        <label>City</label>
        <input type="text" value={typeof data.location === 'object' ? (data.location?.city || '') : (data.location || '')} onChange={e => onChange('location', { ...(typeof data.location === 'object' ? data.location : {}), locationType: data.location?.locationType || 'remote', city: e.target.value })} placeholder="City" />
      </div>
      <div className="prof-field">
        <label>State</label>
        <input type="text" value={data.location?.state || ''} onChange={e => onChange('location', { ...(typeof data.location === 'object' ? data.location : {}), locationType: data.location?.locationType || 'remote', state: e.target.value })} placeholder="State" maxLength={2} />
      </div>
      <div className="prof-field">
        <label>Zip Code</label>
        <input type="text" value={data.location?.zipCode || ''} onChange={e => onChange('location', { ...(typeof data.location === 'object' ? data.location : {}), locationType: data.location?.locationType || 'remote', zipCode: e.target.value })} placeholder="Zip" maxLength={10} />
      </div>
      <div className="prof-field">
        <label>Phone</label>
        <input type="tel" value={data.phone} onChange={e => onChange('phone', e.target.value)} placeholder="+1 (555) 123-4567" />
      </div>
    </div>
    <div className="prof-field">
      <label>Languages</label>
      <input type="text" value={data.languages || ''} onChange={e => onChange('languages', e.target.value)} placeholder="English, Spanish (comma separated)" />
    </div>
  </div>
);

// ── Tab: Skills ─────────────────────────────────────────────────
const TabSkills = ({ data, onChange }) => {
  const [newSkill, setNewSkill] = useState('');
  const addSkill = () => {
    if (newSkill.trim() && !data.skills.includes(newSkill.trim())) {
      onChange('skills', [...data.skills, newSkill.trim()]);
      setNewSkill('');
    }
  };
  const removeSkill = (s) => onChange('skills', data.skills.filter(sk => sk !== s));

  return (
    <div className="tab-content">
      <h2>Skills & Expertise</h2>
      <div className="prof-field">
        <label>Add Skills</label>
        <div className="skill-input-row">
          <input type="text" value={newSkill} onChange={e => setNewSkill(e.target.value)} placeholder="Type a skill and press Enter..." onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} />
          <button type="button" onClick={addSkill} className="btn-add-skill">+ Add</button>
        </div>
      </div>
      <div className="skills-grid">
        {data.skills.map((skill, i) => (
          <span key={i} className="skill-chip">
            {skill}
            <button type="button" onClick={() => removeSkill(skill)} className="skill-remove">×</button>
          </span>
        ))}
        {data.skills.length === 0 && <p className="skills-empty">No skills added yet. Add skills to help clients find you.</p>}
      </div>
      <div className="prof-field" style={{ marginTop: '1.5rem' }}>
        <label>Primary Category</label>
        <select value={data.primaryCategory || ''} onChange={e => onChange('primaryCategory', e.target.value)}>
          <option value="">Select your main expertise</option>
          <option value="web_development">Web Development</option>
          <option value="mobile_development">Mobile Development</option>
          <option value="design">Design</option>
          <option value="writing">Writing</option>
          <option value="marketing">Marketing</option>
          <option value="consulting">Consulting</option>
          <option value="other">Other</option>
        </select>
      </div>
    </div>
  );
};

// ── Tab: Portfolio ──────────────────────────────────────────────
const TabPortfolio = ({ data, onChange }) => (
  <div className="tab-content">
    <h2>Portfolio Highlights</h2>
    <p className="tab-desc">Showcase your best work to attract more clients.</p>
    <div className="portfolio-grid">
      {(data.portfolio || []).map((item, i) => (
        <div key={i} className="portfolio-tile">
          {item.image && <img src={item.image} alt={item.title} />}
          <div className="portfolio-tile-body">
            <h4>{item.title}</h4>
            <p>{item.description}</p>
          </div>
        </div>
      ))}
      <div className="portfolio-add">
        <span>+ Add Project</span>
        <p>Upload images and describe your work</p>
      </div>
    </div>
  </div>
);

// ── Tab: Rates ──────────────────────────────────────────────────
const TabRates = ({ data, onChange }) => (
  <div className="tab-content">
    <h2>Rates & Services</h2>
    <div className="prof-field">
      <label>Hourly Rate ($)</label>
      <input type="number" value={data.hourlyRate} onChange={e => onChange('hourlyRate', parseFloat(e.target.value) || 0)} min="0" step="0.5" placeholder="50" />
      <p className="field-hint">Set a competitive rate for your experience level.</p>
    </div>
    <div className="rates-services">
      <h3>Your Services</h3>
      <p className="tab-desc">Service packages you've created will appear here.</p>
      <a href="/create-service" className="btn-create-service">+ Create Service</a>
    </div>
  </div>
);

// ── Tab: Verification ───────────────────────────────────────────
const TabVerification = ({ data }) => (
  <div className="tab-content">
    <h2>Safety & Trust</h2>
    <div className="verify-list">
      <div className={`verify-item ${data.isVerified ? 'verified' : ''}`}>
        <span className="verify-icon">{data.isVerified ? '✅' : '⬜'}</span>
        <div><strong>Email Verified</strong><p>{data.isVerified ? 'Your email is verified' : 'Verify your email to build trust'}</p></div>
      </div>
      <div className={`verify-item ${data.phone ? 'verified' : ''}`}>
        <span className="verify-icon">{data.phone ? '✅' : '⬜'}</span>
        <div><strong>Phone Number</strong><p>{data.phone ? 'Phone number added' : 'Add a phone number for extra security'}</p></div>
      </div>
      <div className="verify-item">
        <span className="verify-icon">⬜</span>
        <div><strong>ID Verification</strong><p>Coming soon — verify your identity for a trust badge</p></div>
      </div>
      <div className={`verify-item ${data.stripeConnected ? 'verified' : ''}`}>
        <span className="verify-icon">{data.stripeConnected ? '✅' : '⬜'}</span>
        <div><strong>Payment Setup</strong><p>{data.stripeConnected ? 'Stripe connected' : 'Connect Stripe to receive payments'}</p></div>
      </div>
    </div>
  </div>
);

// ── Tab: Settings ───────────────────────────────────────────────
const TabSettings = ({ data, onChange }) => (
  <div className="tab-content">
    <h2>Settings</h2>
    <div className="prof-field">
      <label>Email</label>
      <input type="email" value={data.email || ''} disabled className="input-disabled" />
      <p className="field-hint">Contact support to change your email.</p>
    </div>
    <h3 style={{ marginTop: '1.5rem' }}>Social Links</h3>
    <div className="prof-row">
      <div className="prof-field">
        <label>LinkedIn</label>
        <input type="url" value={data.socialLinks?.linkedin || ''} onChange={e => onChange('socialLinks.linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." />
      </div>
      <div className="prof-field">
        <label>GitHub</label>
        <input type="url" value={data.socialLinks?.github || ''} onChange={e => onChange('socialLinks.github', e.target.value)} placeholder="https://github.com/..." />
      </div>
    </div>
    <div className="prof-row">
      <div className="prof-field">
        <label>Portfolio</label>
        <input type="url" value={data.socialLinks?.portfolio || ''} onChange={e => onChange('socialLinks.portfolio', e.target.value)} placeholder="https://yoursite.com" />
      </div>
      <div className="prof-field">
        <label>Twitter</label>
        <input type="url" value={data.socialLinks?.twitter || ''} onChange={e => onChange('socialLinks.twitter', e.target.value)} placeholder="https://twitter.com/..." />
      </div>
    </div>
  </div>
);

// ── Main Profile ────────────────────────────────────────────────
const Profile = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [data, setData] = useState({
    firstName: '', lastName: '', bio: '', headline: '', skills: [],
    hourlyRate: 0, location: '', phone: '', profilePicture: '',
    languages: '', primaryCategory: '', email: '', isVerified: false,
    rating: 0, portfolio: [],
    socialLinks: { linkedin: '', github: '', portfolio: '', twitter: '' }
  });

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/api/users/profile');
      const u = response.user;
      setData({
        firstName: u.firstName || '', lastName: u.lastName || '',
        bio: u.bio || '', headline: u.headline || '',
        skills: u.skills || [], hourlyRate: u.hourlyRate || 0,
        location: u.location || { locationType: 'remote', city: '', state: '', zipCode: '' }, phone: u.phone || '',
        profilePicture: u.profilePicture || '', languages: u.languages || '',
        primaryCategory: u.primaryCategory || '', email: u.email || '',
        isVerified: u.isVerified || false, rating: u.rating || 0,
        portfolio: u.portfolio || [], stripeConnected: u.stripeConnected || false,
        socialLinks: {
          linkedin: u.socialLinks?.linkedin || '', github: u.socialLinks?.github || '',
          portfolio: u.socialLinks?.portfolio || '', twitter: u.socialLinks?.twitter || ''
        }
      });
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const onChange = (field, value) => {
    setHasChanges(true);
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setData(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else {
      setData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const formData = new FormData();
      Object.keys(data).forEach(key => {
        if (key === 'socialLinks') {
          Object.keys(data.socialLinks).forEach(sk => formData.append(`socialLinks.${sk}`, data.socialLinks[sk]));
        } else if (Array.isArray(data[key])) {
          data[key].forEach(item => {
            if (typeof item === 'string') formData.append(`${key}[]`, item);
          });
        } else if (typeof data[key] !== 'object') {
          formData.append(key, data[key]);
        }
      });
      if (selectedFile) formData.append('profilePicture', selectedFile);

      const response = await apiRequest('/api/users/profile', { method: 'PUT', body: formData });
      updateUser(response.user);
      setSuccess('Profile saved!');
      setHasChanges(false);
      setSelectedFile(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const completion = useMemo(() => calcCompletion(data), [data]);

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-page-loading">
          <div className="profile-skeleton profile-skeleton-header" />
          <div className="profile-skeleton profile-skeleton-body" />
        </div>
      </div>
    );
  }

  const tabContent = [
    <TabOverview data={data} completion={completion} onTabChange={setActiveTab} />,
    <TabAbout data={data} onChange={onChange} onFileSelect={setSelectedFile} />,
    <TabSkills data={data} onChange={onChange} />,
    <TabPortfolio data={data} onChange={onChange} />,
    <TabRates data={data} onChange={onChange} />,
    <TabVerification data={data} />,
    <TabSettings data={data} onChange={onChange} />,
  ];

  return (
    <div className="profile-page">
      {/* Header */}
      <div className="profile-page-header">
        <div className="profile-page-header-left">
          <h1>Profile</h1>
          <div className="profile-completion-badge">{completion}% complete</div>
        </div>
        <div className="profile-page-header-right">
          <a href={`/freelancers/${user?._id || user?.userId}`} className="btn-preview" target="_blank" rel="noopener noreferrer">
            👁️ Public Preview
          </a>
          <button className="btn-share" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/freelancers/${user?._id || user?.userId}`)}>
            🔗 Share Profile
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="profile-tabs">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            className={`profile-tab ${i === activeTab ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="profile-content">
        <SummaryCard data={data} completion={completion} />
        <div className="profile-main">
          {tabContent[activeTab]}
        </div>
      </div>

      {/* Sticky Actions */}
      {hasChanges && (
        <div className="profile-sticky-actions">
          <span className="unsaved-indicator">● Unsaved changes</span>
          <div className="sticky-btns">
            <button className="btn-cancel" onClick={fetchProfile}>Cancel</button>
            <button className="btn-save" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          {error && <span className="sticky-error">{error}</span>}
          {success && <span className="sticky-success">{success}</span>}
        </div>
      )}
    </div>
  );
};

export default Profile;
