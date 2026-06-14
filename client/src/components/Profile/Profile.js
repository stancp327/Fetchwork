import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SEO from '../common/SEO';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import './Profile.css';

import { TABS, calcCompletion, SummaryCard, TabOverview, TabAbout, TabSkills, TabPortfolio, TabRates, TabVerification, TabSettings } from './parts/components';
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
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [rateAdvice, setRateAdvice] = useState(null);
  const [rateAdviceLoading, setRateAdviceLoading] = useState(false);
  const [rateError, setRateError] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [data, setData] = useState({
    firstName: '', lastName: '', bio: '', headline: '', skills: [],
    hourlyRate: 0, location: '', profilePicture: '',
    languages: '', primaryCategory: '', email: '', isVerified: false,
    rating: 0, portfolio: [],
    socialLinks: { linkedin: '', github: '', portfolio: '', twitter: '' }
  });

  // Handle Stripe Connect return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripe = params.get('stripe');
    if (stripe === 'success') {
      setSuccess('🎉 Stripe connected! You can now receive payments.');
      setActiveTab(4); // Verification tab
      window.history.replaceState({}, '', '/profile');
    } else if (stripe === 'refresh') {
      setError('Stripe setup session expired. Please try again.');
      setActiveTab(4);
      window.history.replaceState({}, '', '/profile');
    }
  }, []); // eslint-disable-line

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/api/users/profile');
      const u = response.user;
      setData({
        _id: u._id || '',
        firstName: u.firstName || '', lastName: u.lastName || '',
        bio: u.bio || '', headline: u.headline || '',
        skills: u.skills || [], hourlyRate: u.hourlyRate || 0,
        location: u.location || { locationType: 'remote', city: '', state: '', zipCode: '' },
        profilePicture: u.profilePicture || '',
        languages: Array.isArray(u.languages) ? u.languages.map(l => l.name || l).filter(Boolean).join(', ') : (u.languages || ''),
        primaryCategory: u.primaryCategory || '', email: u.email || '',
        isVerified: u.isVerified || false, rating: u.rating || 0,
        portfolio: u.portfolio || [], stripeConnected: u.stripeConnected || false,
        socialLinks: {
          linkedin: u.socialLinks?.linkedin || '', github: u.socialLinks?.github || '',
          portfolio: u.socialLinks?.portfolio || '', twitter: u.socialLinks?.twitter || ''
        },
        availabilityStatus: u.availabilityStatus || 'available',
        rateNegotiable: u.rateNegotiable || false
      });
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (hasChanges) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

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

      let response;
      if (selectedFile) {
        // Use FormData only when uploading a profile picture
        const formData = new FormData();
        formData.append('profilePicture', selectedFile);
        // Send all other fields as JSON in a single field
        const { _id, profilePicture, stripeConnected, isVerified, rating, email, socialLinks, ...saveable } = data;
        formData.append('_json', JSON.stringify(saveable));
        response = await apiRequest('/api/users/profile', { method: 'PUT', body: formData });
      } else {
        // No file — send clean JSON
        const { _id, profilePicture, stripeConnected, isVerified, rating, email, socialLinks, ...saveable } = data;
        response = await apiRequest('/api/users/profile', {
          method: 'PUT',
          body: JSON.stringify(saveable),
        });
      }
      // Update auth context (minimal — just avatar + name)
      if (response?.user) {
        try {
          updateUser({
            firstName: response.user.firstName,
            lastName: response.user.lastName,
            profilePicture: response.user.profilePicture,
            headline: response.user.headline,
          });
        } catch (e) {
          console.warn('updateUser failed:', e);
        }
      }
      // Reflect saved data in local form state
      if (response?.user) {
        const u = response.user;
        setData(prev => ({
          ...prev,
          firstName: u.firstName || prev.firstName,
          lastName: u.lastName || prev.lastName,
          bio: u.bio || '',
          headline: u.headline || prev.headline,
          skills: Array.isArray(u.skills) ? u.skills : (prev.skills || []),
          hourlyRate: u.hourlyRate ?? prev.hourlyRate ?? 0,
          rateNegotiable: u.rateNegotiable ?? prev.rateNegotiable,
          availabilityStatus: u.availabilityStatus || prev.availabilityStatus,
          primaryCategory: u.primaryCategory || prev.primaryCategory,
          socialLinks: prev.socialLinks, // preserved but hidden from UI
          location: u.location || prev.location,
          portfolio: Array.isArray(u.portfolio) ? u.portfolio : (prev.portfolio || []),
          languages: Array.isArray(u.languages)
            ? u.languages.map(l => l.name || l).filter(Boolean).join(', ')
            : (typeof u.languages === 'string' ? u.languages : prev.languages),
          profilePicture: u.profilePicture || prev.profilePicture,
        }));
      }
      setSuccess('Profile saved!');
      setHasChanges(false);
      setSelectedFile(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Profile save error:', err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const completion = useMemo(() => calcCompletion(data), [data]);

  if (loading) {
    return (
      <div className="profile-page">
      <SEO title="My Profile" path="/profile" noIndex={true} />
        <div className="profile-page-loading">
          <div className="profile-skeleton profile-skeleton-header" />
          <div className="profile-skeleton profile-skeleton-body" />
        </div>
      </div>
    );
  }

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setHasChanges(true);
  };

  const tabContent = [
    <TabOverview data={data} completion={completion} onTabChange={setActiveTab} />,
    <TabAbout data={data} onChange={onChange} onFileSelect={handleFileSelect} />,
    <TabSkills data={data} onChange={onChange} />,
    <TabPortfolio data={data} onChange={onChange} onRefresh={fetchProfile} />,
    <TabRates data={data} onChange={onChange} />,
    <TabVerification data={data} onRefresh={fetchProfile} />,
    <TabSettings data={data} onChange={onChange} />,
  ];

  return (
    <div className="profile-page">
      <SEO title="My Profile" path="/profile" noIndex={true} />
      {/* Header */}
      <div className="profile-page-header">
        <div className="profile-page-header-left">
          <h1>Profile</h1>
          <div className="profile-completion-badge">{completion}% complete</div>
        </div>
        <div className="profile-page-header-right">
          <button className="prf-ai-tools-btn" onClick={() => setShowAiPanel(p => !p)}>
            ✨ AI Tools
          </button>
          {(data._id || user?.id) && (
            <a href={`/freelancers/${data._id || user?.id}`} className="btn-preview" target="_blank" rel="noopener noreferrer">
              👁️ Public Preview
            </a>
          )}
          {(data._id || user?.id) && (
            <button className="btn-share" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/freelancers/${data._id || user?.id}`)}>
              🔗 Share Profile
            </button>
          )}
        </div>
      </div>

      {/* AI Tools Panel */}
      {showAiPanel && (
        <div className="prf-ai-panel">
          <div className="prf-ai-panel-header">
            <span>✨ AI Profile Tools</span>
            <button className="prf-ai-panel-close" onClick={() => setShowAiPanel(false)}>✕</button>
          </div>

          {/* Profile Optimizer */}
          <div className="prf-ai-section">
            <div className="prf-ai-section-title">Profile Optimizer</div>
            <p className="prf-ai-section-desc">Get specific suggestions to improve your profile and win more clients.</p>
            {aiSuggestions ? (
              <div className="prf-ai-suggestions">
                {aiSuggestions.map((s, i) => (
                  <div key={i} className={`prf-ai-suggestion prf-ai-impact-${s.impact}`}>
                    <div className="prf-ai-suggestion-title">{s.title}
                      <span className={`prf-ai-impact-badge ${s.impact}`}>{s.impact}</span>
                    </div>
                    <div className="prf-ai-suggestion-text">{s.suggestion}</div>
                  </div>
                ))}
              </div>
            ) : (
              <button className="prf-ai-run-btn" disabled={aiSuggestionsLoading} onClick={async () => {
                setAiSuggestionsLoading(true);
                setAiError('');
                try {
                  const res = await apiRequest('/api/ai/optimize-profile', {
                    method: 'POST',
                    body: JSON.stringify({ bio: data.bio, headline: data.headline, skills: data.skills, hourlyRate: data.hourlyRate, category: data.primaryCategory, completionScore: completion }),
                  });
                  setAiSuggestions(res.suggestions);
                } catch (err) {
                  console.error('AI optimize error:', err);
                  setAiError(err.status === 403 ? 'Requires a Plus+ plan.' : err.status === 503 ? 'AI not configured on server.' : `Error: ${err.message || 'Try again later.'}`);
                }
                finally { setAiSuggestionsLoading(false); }
              }}>
                {aiSuggestionsLoading ? '✨ Analyzing…' : '✨ Analyze My Profile'}
              </button>
              {aiError && <p className="prf-ai-error">{aiError}</p>}
            )}
          </div>

          {/* Rate Advisor */}
          <div className="prf-ai-section">
            <div className="prf-ai-section-title">Rate Advisor</div>
            <p className="prf-ai-section-desc">See how your rate compares to market rates for your skills.</p>
            {rateAdvice ? (
              <div className="prf-ai-rate-result">
                <div className={`prf-ai-rate-verdict ${rateAdvice.verdict}`}>
                  {rateAdvice.verdict === 'underpriced' ? '📉 Underpriced' : rateAdvice.verdict === 'overpriced' ? '📈 Overpriced' : '✅ Fairly Priced'}
                </div>
                <div className="prf-ai-rate-range">
                  Market: ${rateAdvice.marketLow}–${rateAdvice.marketHigh}/hr · Typical: ${rateAdvice.marketMid}/hr
                </div>
                <p className="prf-ai-rate-advice">{rateAdvice.advice}</p>
                {rateAdvice.positioning && <p className="prf-ai-rate-positioning">💡 {rateAdvice.positioning}</p>}
              </div>
            ) : (
              <button className="prf-ai-run-btn" disabled={rateAdviceLoading} onClick={async () => {
                setRateAdviceLoading(true);
                setRateError('');
                try {
                  const res = await apiRequest('/api/ai/rate-advice', {
                    method: 'POST',
                    body: JSON.stringify({ hourlyRate: data.hourlyRate, skills: data.skills, category: data.primaryCategory, bio: data.bio, location: data.location }),
                  });
                  if (res.advice) setRateAdvice(res.advice);
                } catch (err) {
                  console.error('AI rate error:', err);
                  setRateError(err.status === 403 ? 'Requires a Plus+ plan.' : err.status === 503 ? 'AI not configured on server.' : `Error: ${err.message || 'Try again later.'}`);
                }
                finally { setRateAdviceLoading(false); }
              }}>
                {rateAdviceLoading ? '✨ Analyzing…' : '✨ Check My Rate'}
              </button>
              {rateError && <p className="prf-ai-error">{rateError}</p>}
            )}
          </div>
        </div>
      )}

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

      {/* Feedback toast (visible even after save hides the sticky bar) */}
      {!hasChanges && (success || error) && (
        <div className={`profile-toast ${error ? 'profile-toast-error' : 'profile-toast-success'}`}>
          {success || error}
        </div>
      )}

      {/* Sticky Actions */}
      {hasChanges && (
        <div className="profile-sticky-actions">
          <span className="unsaved-indicator">● Unsaved changes</span>
          <div className="sticky-btns">
            <button className="btn-cancel" onClick={() => { fetchProfile(); setHasChanges(false); }}>Cancel</button>
            <button className="btn-save" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          {error && <span className="sticky-error">{error}</span>}
        </div>
      )}
    </div>
  );
};

export default Profile;

