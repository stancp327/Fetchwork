import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../../utils/api';
import FileUpload from '../../common/FileUpload';
import { getLocationDisplay } from '../../../utils/location';
import PortfolioWizard from '../../Portfolio/PortfolioWizard';
import { useZipLookup } from '../../../hooks/useZipLookup';
import CategoryCombobox from '../../common/CategoryCombobox';
import StripeConnect from '../../Payments/StripeConnect';
import PaymentMethods from '../../Payments/PaymentMethods';
import CalendarConnect from '../../Bookings/CalendarConnect';
import { TrustBadge } from '../../common/TrustBadges';
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

    {/* Earned badges — only rendered if the user has at least one */}
    {(() => {
      const earned = [];
      if (data.isEmailVerified || data.isVerified || data.badges?.includes('email_verified')) earned.push('email_verified');
      if (data.verificationLevel === 'identity' || data.verificationLevel === 'full' || data.badges?.includes('id_verified')) earned.push('id_verified');
      if (data.rating >= 4.5 && data.totalReviews >= 5) earned.push('top_rated');
      if (data.backgroundCheck?.status === 'passed' || data.badges?.includes('bg_checked')) earned.push('bg_checked');
      return earned.length > 0 ? (
        <div className="summary-badges">
          {earned.map(b => <TrustBadge key={b} type={b} size="sm" />)}
        </div>
      ) : null;
    })()}

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
const TabAbout = ({ data, onChange, onFileSelect }) => {
  const { lookupZip, zipLoading, zipError } = useZipLookup();
  return (
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
        <input
          type="text"
          value={data.location?.zipCode || ''}
          onChange={e => {
            const zip = e.target.value;
            const loc = { ...(typeof data.location === 'object' ? data.location : {}), locationType: data.location?.locationType || 'remote', zipCode: zip };
            onChange('location', loc);
            lookupZip(zip, ({ city, stateCode }) => {
              onChange('location', { ...loc, city: city || loc.city, state: stateCode || loc.state });
            });
          }}
          placeholder="Zip"
          maxLength={10}
        />
        {zipLoading && <span style={{ fontSize: '12px', color: '#888' }}>Looking up...</span>}
        {zipError && <span style={{ fontSize: '12px', color: '#e74c3c' }}>{zipError}</span>}
      </div>
      <div className="prof-field">
        <label>Availability Status</label>
        <select value={data.availabilityStatus || 'available'} onChange={e => onChange('availabilityStatus', e.target.value)}>
          <option value="available">🟢 Available Now</option>
          <option value="busy">🟡 Busy</option>
          <option value="not_taking_work">🔴 Not Taking Work</option>
          <option value="away">⚫ Away</option>
        </select>
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
};

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
        <CategoryCombobox
          value={data.primaryCategory || ''}
          onChange={v => onChange('primaryCategory', v)}
          placeholder="Select your main expertise"
        />
      </div>
    </div>
  );
};

// ── Tab: Portfolio ──────────────────────────────────────────────
const TabPortfolio = ({ data, onRefresh }) => {
  const [showWizard, setShowWizard] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const handleOpen = (item = null) => {
    setEditItem(item);
    setShowWizard(true);
  };

  const handleClose = () => {
    setShowWizard(false);
    setEditItem(null);
  };

  const handleSuccess = () => {
    handleClose();
    if (onRefresh) onRefresh(); // Re-fetch profile to update portfolio list
  };

  return (
    <div className="tab-content">
      <div className="tab-content-header">
        <div>
          <h2>Portfolio</h2>
          <p className="tab-desc">Showcase your best work to attract more clients.</p>
        </div>
        <button className="btn-add-portfolio" onClick={() => handleOpen()}>
          + Add Project
        </button>
      </div>

      {(data.portfolio || []).length === 0 ? (
        <div className="portfolio-empty" onClick={() => handleOpen()}>
          <div className="portfolio-empty-icon">🗂️</div>
          <h3>No projects yet</h3>
          <p>Add your first project to showcase your skills</p>
          <button className="btn btn-primary">+ Add Your First Project</button>
        </div>
      ) : (
        <div className="portfolio-grid">
          {(data.portfolio || []).map((item, i) => (
            <div key={item._id || i} className="portfolio-tile">
              {(item.mediaUrls?.[0] || item.image) && (
                <img src={item.mediaUrls?.[0] || item.image} alt={item.title} />
              )}
              <div className="portfolio-tile-body">
                <h4>{item.title}</h4>
                {item.description && <p>{item.description.substring(0, 100)}{item.description.length > 100 ? '…' : ''}</p>}
                {item.tags?.length > 0 && (
                  <div className="portfolio-tags">
                    {item.tags.slice(0, 3).map((t, ti) => <span key={ti} className="portfolio-tag">{t}</span>)}
                  </div>
                )}
                <button className="portfolio-tile-edit" onClick={() => handleOpen(item)}>
                  ✏️ Edit
                </button>
              </div>
            </div>
          ))}
          <div className="portfolio-add" onClick={() => handleOpen()}>
            <span style={{ fontSize: '2rem' }}>+</span>
            <p>Add another project</p>
          </div>
        </div>
      )}

      {showWizard && (
        <PortfolioWizard
          onClose={handleClose}
          onSuccess={handleSuccess}
          editItem={editItem}
        />
      )}
    </div>
  );
};

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
// ── Tab: Verification ──────────────────────────────────────────
const DOC_TYPES = [
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'passport',        label: 'Passport' },
  { value: 'national_id',     label: 'National ID' },
  { value: 'other',           label: 'Other Government ID' },
];

const TabVerification = ({ data, onRefresh }) => {
  const verif  = data.idVerification || {};
  const status = verif.status || 'none';

  const [showForm,    setShowForm]    = useState(false);
  const [docType,     setDocType]     = useState('drivers_license');
  const [docFile,     setDocFile]     = useState(null);
  const [selfieFile,  setSelfieFile]  = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [formError,   setFormError]   = useState('');

  const canSubmit = status === 'none' || status === 'rejected';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!docFile) { setFormError('Please upload your ID document.'); return; }
    setFormError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('documentType', docType);
      fd.append('document', docFile);
      if (selfieFile) fd.append('selfie', selfieFile);
      const token = localStorage.getItem('token');
      const base  = process.env.REACT_APP_API_URL || '';
      const res   = await fetch(`${base}/api/users/verify-identity`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Submission failed');
      setShowForm(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Badge definitions ──────────────────────────────────────────
  const BADGE_DEFS = [
    {
      key:    'email_verified',
      icon:   '✉️',
      label:  'Email Verified',
      color:  '#2563eb',
      earned: data.isEmailVerified || data.isVerified || data.badges?.includes('email_verified'),
      how:    'Verify your email address from the link we send on signup.',
    },
    {
      key:    'id_verified',
      icon:   '🪪',
      label:  'ID Verified',
      color:  '#059669',
      earned: status === 'approved' || data.badges?.includes('id_verified'),
      how:    'Submit a government-issued ID below. Usually approved in 1–2 business days.',
    },
    {
      key:    'top_rated',
      icon:   '⭐',
      label:  'Top Rated',
      color:  '#d97706',
      earned: (data.rating >= 4.5 && (data.totalReviews || 0) >= 5) || data.badges?.includes('top_rated'),
      how:    `Maintain a 4.5+ star rating with at least 5 reviews. You're at ${data.rating?.toFixed(1) || '—'} ⭐ with ${data.totalReviews || 0} review${data.totalReviews !== 1 ? 's' : ''}.`,
    },
    {
      key:    'bg_checked',
      icon:   '🔍',
      label:  'Background Checked',
      color:  '#7c3aed',
      earned: data.backgroundCheck?.status === 'passed' || data.badges?.includes('bg_checked'),
      how:    'Background checks are coming soon.',
    },
  ];

  const earnedCount = BADGE_DEFS.filter(b => b.earned).length;

  return (
    <div className="tab-content">
      <h2>Safety & Trust</h2>

      {/* ── Badge Showcase ───────────────────────────────────────── */}
      <div className="badge-showcase">
        <div className="badge-showcase-header">
          <div>
            <h3>Your Badges</h3>
            <p>{earnedCount} of {BADGE_DEFS.length} earned — badges appear on your public profile and build client trust.</p>
          </div>
          {earnedCount > 0 && <span className="badge-count-pill">{earnedCount} earned</span>}
        </div>
        <div className="badge-showcase-grid">
          {BADGE_DEFS.map(b => (
            <div key={b.key} className={`badge-showcase-item ${b.earned ? 'earned' : 'locked'}`}>
              <div className="bsi-icon-wrap" style={{ '--badge-glow': b.color }}>
                <span className="bsi-icon">{b.icon}</span>
                {b.earned && <span className="bsi-check">✓</span>}
              </div>
              <strong className="bsi-label">{b.label}</strong>
              {b.earned ? (
                <span className="bsi-status earned">Earned ✓</span>
              ) : (
                <p className="bsi-how">{b.how}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Email + phone checks */}
      <div className="verify-list">
        <div className={`verify-item ${data.isEmailVerified || data.isVerified ? 'verified' : ''}`}>
          <span className="verify-icon">{data.isEmailVerified || data.isVerified ? '✅' : '⬜'}</span>
          <div>
            <strong>Email Verified</strong>
            <p>{data.isEmailVerified || data.isVerified ? 'Your email is verified' : 'Verify your email to build trust'}</p>
          </div>
        </div>
        <div className={`verify-item ${data.phone ? 'verified' : ''}`}>
          <span className="verify-icon">{data.phone ? '✅' : '⬜'}</span>
          <div>
            <strong>Phone Number</strong>
            <p>{data.phone ? 'Phone number added' : 'Add a phone number for extra security'}</p>
          </div>
        </div>
      </div>

      {/* ID Verification */}
      <div className="verify-id-section">
        <div className="verify-id-header">
          <div>
            <h3>🪪 ID Verification</h3>
            <p>Submit a government-issued ID to earn your <strong>ID Verified</strong> badge.</p>
          </div>
          {status === 'approved' && <span className="verify-badge-pill approved">✅ Verified</span>}
          {status === 'pending'  && <span className="verify-badge-pill pending">⏳ Under Review</span>}
          {status === 'rejected' && <span className="verify-badge-pill rejected">❌ Not Approved</span>}
        </div>

        {status === 'approved' && (
          <div className="verify-status-card approved">
            <p>🎉 You have the <strong>ID Verified</strong> badge. Your profile now shows a trust badge to clients.</p>
            {verif.reviewedAt && <p className="verify-date">Approved {new Date(verif.reviewedAt).toLocaleDateString()}</p>}
          </div>
        )}

        {status === 'pending' && (
          <div className="verify-status-card pending">
            <p>Your ID is being reviewed by our team. This usually takes 1–2 business days.</p>
            {verif.submittedAt && <p className="verify-date">Submitted {new Date(verif.submittedAt).toLocaleDateString()}</p>}
          </div>
        )}

        {status === 'rejected' && (
          <div className="verify-status-card rejected">
            <p><strong>Your submission was not approved.</strong></p>
            {verif.notes && <p className="verify-reason">Reason: {verif.notes}</p>}
            <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={() => setShowForm(true)}>
              Try Again
            </button>
          </div>
        )}

        {status === 'none' && !showForm && (
          <div className="verify-cta">
            <p>Takes about 2 minutes. Your documents are only seen by our moderation team.</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              Start Verification
            </button>
          </div>
        )}

        {canSubmit && showForm && (
          <form className="verify-form" onSubmit={handleSubmit}>
            <div className="verify-form-field">
              <label>Document Type</label>
              <select value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div className="verify-form-field">
              <label>ID Document <span className="required">*</span></label>
              <p className="verify-form-hint">Clear photo or scan of the front of your ID (JPG, PNG, or PDF, max 10MB)</p>
              <FileUpload
                label="Choose document file"
                accept="image/*,application/pdf"
                maxSize={10 * 1024 * 1024}
                preview={true}
                onFileSelect={files => setDocFile(files[0] || null)}
              />
            </div>
            <div className="verify-form-field">
              <label>Selfie <span className="optional">(optional but recommended)</span></label>
              <p className="verify-form-hint">A clear photo of your face to help us match against your ID</p>
              <FileUpload
                label="Choose selfie photo"
                accept="image/*"
                maxSize={5 * 1024 * 1024}
                preview={true}
                onFileSelect={files => setSelfieFile(files[0] || null)}
              />
            </div>
            {formError && <div className="verify-form-error">{formError}</div>}
            <div className="verify-form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setFormError(''); }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit for Review'}
              </button>
            </div>
            <p className="verify-privacy-note">🔒 Your documents are encrypted and only accessible to our trust & safety team.</p>
          </form>
        )}
      </div>

      {/* Payment */}
      <div className="verify-id-section" style={{ marginTop: '1.5rem' }}>
        <div className="verify-id-header">
          <div>
            <h3>🏦 Bank Account</h3>
            <p>Add your bank account to receive payments when clients release them.</p>
          </div>
        </div>
        <StripeConnect onStatusChange={(s) => {
          if (s?.connected && onRefresh) onRefresh();
        }} />
      </div>

      {/* Saved Payment Methods (client side — for paying jobs/services) */}
      <div className="verify-id-section" style={{ marginTop: '1.5rem' }}>
        <PaymentMethods />
      </div>

      {/* Calendar Integration */}
      <div className="verify-id-section" style={{ marginTop: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3>📅 Calendar Sync</h3>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
            Sync your bookings with Google Calendar, Apple Calendar, or Outlook.
          </p>
        </div>
        <CalendarConnect />
      </div>
    </div>
  );
};

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


export { TABS, calcCompletion, SummaryCard, TabOverview, TabAbout, TabSkills, TabPortfolio, TabRates, TabVerification, TabSettings };

