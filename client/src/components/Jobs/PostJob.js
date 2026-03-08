import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useFeatures } from '../../hooks/useFeatures';
import CategoryCombobox from '../common/CategoryCombobox';
import UpgradePrompt from '../Billing/UpgradePrompt';
import './PostJob.css';
import SEO from '../common/SEO';
import { validateFormData, buildJobPayload } from './postJobUtils';
import { aiApi } from '../../api/ai';
import PricingInsightWidget from '../Skills/PricingInsightWidget';
import { useZipLookup } from '../../hooks/useZipLookup';

const PostJob = () => {
  const navigate = useNavigate();
  const { hasFeature } = useFeatures();
  const canTemplates      = hasFeature('job_templates');
  const canAIDescription  = hasFeature('ai_job_description');
  const { lookupZip, zipLoading, zipError } = useZipLookup();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [userTeams, setUserTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [upgradeLimit, setUpgradeLimit] = useState(null); // { reason, limit }
  const [templates, setTemplates] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateMsg, setTemplateMsg] = useState('');
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMsg, setAiMsg] = useState('');
  const [budgetEstimate, setBudgetEstimate] = useState(null);
  const [budgetEstimateLoading, setBudgetEstimateLoading] = useState(false);
  const [titleSuggestion, setTitleSuggestion] = useState(null);
  const [titleFixLoading, setTitleFixLoading] = useState(false);
  const [scopeExpanding, setScopeExpanding] = useState(false);
  const [suggestedSkills, setSuggestedSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [catDetecting, setCatDetecting] = useState(false);
  const [catDetected, setCatDetected] = useState(null);

  const handleGenerateDescription = async () => {
    if (!canAIDescription) {
      setAiMsg('upgrade_required');
      return;
    }
    if (!formData.title) {
      setAiMsg('Add a job title first so I know what to write about.');
      setTimeout(() => setAiMsg(''), 4000);
      return;
    }
    setAiGenerating(true);
    setAiMsg('');
    try {
      const result = await aiApi.generateDescription({
        title:           formData.title,
        category:        formData.category,
        skills:          formData.skills,
        budgetType:      formData.budgetType,
        budgetAmount:    formData.budgetAmount,
        duration:        formData.duration,
        experienceLevel: formData.experienceLevel,
      });
      setFormData(prev => ({ ...prev, description: result.description }));
      setAiMsg(result.aiGenerated ? '✨ AI-generated — feel free to edit.' : '📝 Template applied — edit to make it yours.');
      setTimeout(() => setAiMsg(''), 6000);
    } catch (err) {
      setAiMsg('Generation failed — try again.');
      setTimeout(() => setAiMsg(''), 4000);
    } finally {
      setAiGenerating(false);
    }
  };

  const loadTemplates = useCallback(async () => {
    if (!canTemplates) return;
    try {
      const data = await apiRequest('/api/job-templates');
      setTemplates(data.templates || []);
    } catch { /* silent */ }
  }, [canTemplates]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // Load user's teams for team-scoped posting
  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest('/api/teams');
        const teams = (data.teams || []).filter(t =>
          t.members?.some(m =>
            m.status === 'active' && m.permissions?.includes('create_jobs')
          )
        );
        setUserTeams(teams);
      } catch { /* no teams */ }
    })();
  }, []);

  const applyTemplate = async (templateId) => {
    setTemplateLoading(true);
    try {
      const data = await apiRequest(`/api/job-templates/${templateId}/use`, { method: 'POST' });
      const t = data.template;
      setFormData(prev => ({
        ...prev,
        title:          t.title || prev.title,
        description:    t.description || prev.description,
        category:       t.category || prev.category,
        subcategory:    t.subcategory || prev.subcategory,
        skills:         t.skills?.join(', ') || prev.skills,
        budgetType:     t.budgetType || prev.budgetType,
        budgetAmount:   t.budgetMin || prev.budgetAmount,
        budgetMax:      t.budgetMax || prev.budgetMax,
        locationType:   t.location?.locationType || prev.locationType,
        city:           t.location?.city || prev.city,
        state:          t.location?.state || prev.state,
        zipCode:        t.location?.zipCode || prev.zipCode,
      }));
      setTemplateMsg(`Template "${t.name}" applied ✅`);
      setTimeout(() => setTemplateMsg(''), 3000);
    } catch (err) {
      setTemplateMsg('Failed: ' + err.message);
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim()) return;
    setTemplateLoading(true);
    try {
      await apiRequest('/api/job-templates', {
        method: 'POST',
        body: JSON.stringify({
          name:        saveTemplateName.trim(),
          title:       formData.title,
          description: formData.description,
          category:    formData.category,
          subcategory: formData.subcategory,
          skills:      formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
          budgetType:  formData.budgetType,
          budgetMin:   formData.budgetAmount ? Number(formData.budgetAmount) : undefined,
          budgetMax:   formData.budgetMax ? Number(formData.budgetMax) : undefined,
          location: {
            locationType: formData.locationType,
            city:         formData.city,
            state:        formData.state,
            zipCode:      formData.zipCode,
          },
        }),
      });
      setTemplateMsg('Template saved ✅');
      setSaveTemplateName('');
      setShowSaveTemplate(false);
      loadTemplates();
      setTimeout(() => setTemplateMsg(''), 3000);
    } catch (err) {
      setTemplateMsg('Failed: ' + err.message);
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await apiRequest(`/api/job-templates/${id}`, { method: 'DELETE' });
      loadTemplates();
    } catch { /* silent */ }
  };
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    subcategory: '',
    skills: '',
    budgetType: 'fixed',
    budgetAmount: '',
    budgetMax: '',
    currency: 'USD',
    duration: '',
    experienceLevel: '',
    locationType: 'remote',
    city: '',
    state: '',
    zipCode: '',
    deadline: '',
    scheduledDate: '',
    cancellationPolicy: 'flexible',
    isUrgent: false,
    recurringEnabled:  false,
    recurringInterval: 'monthly',
    recurringEndDate:  '',
  });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = validateFormData(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const jobData = buildJobPayload(formData, selectedTeam);
      await apiRequest('/api/jobs', { method: 'POST', body: JSON.stringify(jobData) });
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/browse-jobs');
      }, 2000);

    } catch (error) {
      console.error('Failed to post job:', error);
      const data = error.data;
      if (data?.reason === 'job_limit') {
        setUpgradeLimit({ reason: 'job_limit', limit: data.limit });
      } else {
        setError(data?.error || error.message || 'Failed to post job');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="post-job-success">
        <h3>✅ Job Posted Successfully!</h3>
        <p>Your job is now live. Redirecting to browse jobs...</p>
      </div>
    );
  }

  return (
    <div className="post-job-page">
      <SEO title="Post a Job" path="/post-job" noIndex={true} />
      <div className="post-job-header">
        <h1>Post a Job</h1>
        <p>Find the perfect freelancer for your project</p>
      </div>

      <div className="post-job-form">
        {/* Template picker */}
        {canTemplates && templates.length > 0 && (
          <div className="pj-template-bar">
            <div className="pj-template-header">
              <span className="pj-template-icon">📋</span>
              <strong>Templates</strong>
            </div>
            <div className="pj-template-list">
              {templates.map(t => (
                <div key={t._id} className="pj-template-chip">
                  <button className="pj-template-apply" onClick={() => applyTemplate(t._id)} disabled={templateLoading}>
                    {t.name}
                  </button>
                  <button className="pj-template-delete" onClick={() => handleDeleteTemplate(t._id)} title="Delete">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {templateMsg && <div className="pj-template-msg">{templateMsg}</div>}

        <form onSubmit={handleSubmit}>
          {userTeams.length > 0 && (
            <div className="form-section">
              <div className="form-section-title">Post on behalf of a team (optional)</div>
              <div className="form-group">
                <label htmlFor="teamId">Team</label>
                <select
                  id="teamId"
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid #d1d5db' }}
                >
                  <option value="">Personal (no team)</option>
                  {userTeams.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
                {selectedTeam && (
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    This job will be linked to your team. It may require approval if team settings are enabled.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="form-section">
            <div className="form-section-title">Job Details</div>

            <div className="form-group">
              <label htmlFor="title">Job Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g. Build a responsive website"
                maxLength={100}
              />
              {errors.title && <div className="error-text">{errors.title}</div>}
              {/* AI Title Fixer */}
              {formData.title.length >= 5 && (
                <div className="pj-ai-title-wrap">
                  {titleSuggestion ? (
                    <div className="pj-ai-title-suggestion">
                      <span className="pj-ai-title-improved">✨ {titleSuggestion.improved}</span>
                      <span className="pj-ai-title-reason">{titleSuggestion.reason}</span>
                      <div className="pj-ai-title-actions">
                        <button type="button" className="pj-ai-title-apply" onClick={() => {
                          setFormData(prev => ({ ...prev, title: titleSuggestion.improved }));
                          setTitleSuggestion(null);
                        }}>Use this</button>
                        <button type="button" className="pj-ai-title-dismiss" onClick={() => setTitleSuggestion(null)}>Dismiss</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="pj-ai-inline-btn" disabled={titleFixLoading} onClick={async () => {
                      setTitleFixLoading(true);
                      try {
                        const data = await apiRequest('/api/ai/fix-job-title', {
                          method: 'POST',
                          body: JSON.stringify({ title: formData.title, description: formData.description, category: formData.category }),
                        });
                        setTitleSuggestion(data);
                      } catch { /* silent fail */ }
                      finally { setTitleFixLoading(false); }
                    }}>
                      {titleFixLoading ? '✨ Checking…' : '✨ Improve title'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <div className="pj-label-row">
                <label htmlFor="description">Job Description *</label>
                <div className="pj-ai-btn-group">
                  <button
                    type="button"
                    className={`pj-ai-btn ${!canAIDescription ? 'locked' : ''} ${aiGenerating ? 'loading' : ''}`}
                    onClick={handleGenerateDescription}
                    disabled={aiGenerating}
                    title={!canAIDescription ? 'Available on Plus and above' : undefined}
                  >
                    {aiGenerating ? '⏳ Generating…' : canAIDescription ? '✨ Write for me' : '🔒 Write for me · Plus'}
                  </button>
                  {formData.description.trim().length >= 20 && (
                    <button
                      type="button"
                      className="pj-ai-inline-btn"
                      disabled={scopeExpanding}
                      onClick={async () => {
                        setScopeExpanding(true);
                        try {
                          const data = await apiRequest('/api/ai/expand-scope', {
                            method: 'POST',
                            body: JSON.stringify({ description: formData.description, title: formData.title, category: formData.category }),
                          });
                          if (data.expanded) setFormData(prev => ({ ...prev, description: data.expanded }));
                        } catch { /* silent fail */ }
                        finally { setScopeExpanding(false); }
                      }}
                    >
                      {scopeExpanding ? '✨ Expanding…' : '✨ Expand scope'}
                    </button>
                  )}
                </div>
              </div>
              {aiMsg === 'upgrade_required'
                ? <UpgradePrompt
                    inline
                    reason="feature_gated"
                    message="AI job descriptions are available on Plus and above."
                    onDismiss={() => setAiMsg('')}
                  />
                : aiMsg && <div className="pj-ai-msg">{aiMsg}</div>
              }
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your project in detail, or click ✨ Write for me above…"
                rows={6}
                maxLength={5000}
              />
              <div className="char-count">
                {formData.description.length}/5000 characters
              </div>
              {errors.description && <div className="error-text">{errors.description}</div>}
            </div>

            <div className="form-group">
              <div className="pj-ai-cat-label-row">
                <label htmlFor="category">Category *</label>
                {formData.title && (
                  <button
                    type="button"
                    className="pj-ai-cat-btn"
                    disabled={catDetecting}
                    onClick={async () => {
                      setCatDetecting(true);
                      setCatDetected(null);
                      try {
                        const data = await apiRequest('/api/ai/classify-category', {
                          method: 'POST',
                          body: JSON.stringify({ title: formData.title, description: formData.description }),
                        });
                        if (data.category && data.confidence > 0.7) {
                          setFormData(prev => ({ ...prev, category: data.category, subcategory: data.subcategory || prev.subcategory }));
                          if (errors.category) setErrors(prev => ({ ...prev, category: '' }));
                          setCatDetected(data);
                        } else if (data.category) {
                          setCatDetected(data);
                        }
                      } catch { /* silent */ }
                      finally { setCatDetecting(false); }
                    }}
                  >
                    {catDetecting ? '✨ Detecting…' : '✨ Auto-detect category'}
                  </button>
                )}
              </div>
              {catDetected && catDetected.confidence > 0.7 && (
                <div className="pj-ai-cat-banner">✨ Detected: {catDetected.category.replace(/_/g, ' ')} — {catDetected.reason}</div>
              )}
              <CategoryCombobox
                value={formData.category}
                onChange={v => {
                  setFormData(prev => ({ ...prev, category: v }));
                  if (errors.category) setErrors(prev => ({ ...prev, category: '' }));
                }}
                placeholder="Select a category"
                required
              />
              {errors.category && <div className="error-text">{errors.category}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="subcategory">Subcategory</label>
              <input
                type="text"
                id="subcategory"
                name="subcategory"
                value={formData.subcategory}
                onChange={handleInputChange}
                placeholder="e.g. React Development, Logo Design"
              />
            </div>

            <div className="form-group">
              <label htmlFor="skills">Required Skills</label>
              <input
                type="text"
                id="skills"
                name="skills"
                value={formData.skills}
                onChange={handleInputChange}
                placeholder="e.g. JavaScript, React, Node.js (comma separated)"
              />
              {(formData.title || formData.description) && (
                <div className="pj-ai-skills-wrap">
                  <button
                    type="button"
                    className="pj-ai-skills-btn"
                    disabled={skillsLoading}
                    onClick={async () => {
                      setSkillsLoading(true);
                      setSuggestedSkills([]);
                      try {
                        const data = await apiRequest('/api/ai/suggest-skills', {
                          method: 'POST',
                          body: JSON.stringify({ title: formData.title, description: formData.description, category: formData.category }),
                        });
                        if (data.skills?.length) setSuggestedSkills(data.skills);
                      } catch { /* silent */ }
                      finally { setSkillsLoading(false); }
                    }}
                  >
                    {skillsLoading ? '✨ Suggesting…' : '✨ Suggest skills'}
                  </button>
                  {suggestedSkills.length > 0 && (
                    <div className="pj-ai-skills-chips">
                      {suggestedSkills.map(skill => (
                        <button
                          key={skill}
                          type="button"
                          className="pj-ai-skills-chip"
                          onClick={() => {
                            const current = formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
                            if (!current.includes(skill)) {
                              setFormData(prev => ({ ...prev, skills: [...current, skill].join(', ') }));
                            }
                            setSuggestedSkills(prev => prev.filter(s => s !== skill));
                          }}
                        >
                          + {skill}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Budget & Timeline</div>

            <div className="post-job-grid-3">
              <div className="form-group">
                <label htmlFor="budgetType">Budget Type *</label>
                <select
                  id="budgetType"
                  name="budgetType"
                  value={formData.budgetType}
                  onChange={handleInputChange}
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="range">Budget Range</option>
                  <option value="hourly">Hourly Rate</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="budgetAmount">
                  {formData.budgetType === 'range' ? 'Min Budget *' : `Amount * (${formData.budgetType === 'hourly' ? '/hr' : 'total'})`}
                </label>
                <input
                  type="number"
                  id="budgetAmount"
                  name="budgetAmount"
                  value={formData.budgetAmount}
                  onChange={handleInputChange}
                  placeholder="0"
                  min="1"
                  step="0.01"
                />
                {errors.budgetAmount && <div className="error-text">{errors.budgetAmount}</div>}
              </div>

              {/* AI Budget Estimator */}
              <div className="pj-ai-budget-wrap">
                <button
                  type="button"
                  className="pj-ai-budget-btn"
                  disabled={budgetEstimateLoading || (!formData.category && !formData.description)}
                  onClick={async () => {
                    setBudgetEstimateLoading(true);
                    setBudgetEstimate(null);
                    try {
                      const params = new URLSearchParams();
                      if (formData.category) params.set('category', formData.category);
                      if (formData.description) params.set('description', formData.description.slice(0, 400));
                      const data = await apiRequest(`/api/ai/budget-estimate?${params}`);
                      setBudgetEstimate(data.estimate);
                    } catch { setBudgetEstimate(null); }
                    finally { setBudgetEstimateLoading(false); }
                  }}
                >
                  {budgetEstimateLoading ? '✨ Estimating…' : '✨ AI Budget Estimate'}
                </button>
                {budgetEstimate && (
                  <div className="pj-ai-budget-result">
                    <span className="pj-ai-budget-range">
                      ${budgetEstimate.low?.toLocaleString()} – ${budgetEstimate.high?.toLocaleString()} {budgetEstimate.type === 'hourly' ? '/hr' : 'total'}
                    </span>
                    <span className="pj-ai-budget-mid">Typical: ${budgetEstimate.mid?.toLocaleString()}</span>
                    {budgetEstimate.rationale && <p className="pj-ai-budget-note">{budgetEstimate.rationale}</p>}
                    <button
                      type="button"
                      className="pj-ai-budget-apply"
                      onClick={() => {
                        if (budgetEstimate.mid) {
                          setFormData(prev => ({ ...prev, budgetAmount: String(budgetEstimate.mid) }));
                        }
                      }}
                    >
                      Use ${budgetEstimate.mid?.toLocaleString()}
                    </button>
                  </div>
                )}
              </div>

              {formData.budgetType === 'range' && (
                <div className="form-group">
                  <label htmlFor="budgetMax">Max Budget *</label>
                  <input
                    type="number"
                    id="budgetMax"
                    name="budgetMax"
                    value={formData.budgetMax}
                    onChange={handleInputChange}
                    placeholder="0"
                    min={formData.budgetAmount || 1}
                    step="0.01"
                  />
                  {errors.budgetMax && <div className="error-text">{errors.budgetMax}</div>}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="currency">Currency</label>
                <select
                  id="currency"
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                </select>
              </div>
            </div>

            {/* Smart pricing hint */}
            {formData.category && (
              <PricingInsightWidget
                category={formData.category}
                subcategory={formData.subcategory}
                currentPrice={formData.budgetAmount ? Number(formData.budgetAmount) : undefined}
                mode="job"
                compact
              />
            )}

            <div className="form-group">
              <label htmlFor="duration">Project Duration *</label>
              <select
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
              >
                <option value="">Select duration</option>
                <option value="less_than_1_week">Less than 1 week</option>
                <option value="1_2_weeks">1-2 weeks</option>
                <option value="1_month">1 month</option>
                <option value="2_3_months">2-3 months</option>
                <option value="3_6_months">3-6 months</option>
                <option value="more_than_6_months">More than 6 months</option>
              </select>
              {errors.duration && <div className="error-text">{errors.duration}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="experienceLevel">Experience Level *</label>
              <select
                id="experienceLevel"
                name="experienceLevel"
                value={formData.experienceLevel}
                onChange={handleInputChange}
              >
                <option value="">Select experience level</option>
                <option value="entry">Entry Level</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
              {errors.experienceLevel && <div className="error-text">{errors.experienceLevel}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="deadline">Deadline (optional)</label>
              <input
                type="date"
                id="deadline"
                name="deadline"
                value={formData.deadline}
                onChange={handleInputChange}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Where is the work done?</div>

            {/* Visual work-type card selector */}
            <div className="work-type-cards">
              {[
                { value: 'remote', icon: '🌐', label: 'Remote', desc: 'Done online, anywhere' },
                { value: 'local', icon: '📍', label: 'Local / On-site', desc: 'Freelancer comes to you' },
                { value: 'hybrid', icon: '🔄', label: 'Hybrid', desc: 'Mix of remote + on-site' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`work-type-card ${formData.locationType === opt.value ? 'selected' : ''}`}
                  onClick={() => handleInputChange({ target: { name: 'locationType', value: opt.value } })}
                >
                  <span className="work-type-icon">{opt.icon}</span>
                  <span className="work-type-label">{opt.label}</span>
                  <span className="work-type-desc">{opt.desc}</span>
                </button>
              ))}
            </div>

            {/* Remote: nothing extra needed */}
            {formData.locationType === 'remote' && (
              <div className="location-info-banner">
                🌐 Great — freelancers worldwide can apply. No location details needed.
              </div>
            )}

            {/* Local / Hybrid: show address fields */}
            {formData.locationType !== 'remote' && (
              <>
                <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
                  📍 Let freelancers know where the work takes place so they can assess travel.
                </p>
                <div className="post-job-grid-location">
                  <div className="form-group">
                    <label htmlFor="city">City *</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="e.g. Concord"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="state">State *</label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      placeholder="CA"
                      maxLength={2}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="zipCode">Zip Code</label>
                    <input
                      type="text"
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => {
                        handleInputChange(e);
                        lookupZip(e.target.value, ({ city, stateCode }) => {
                          setFormData(prev => ({
                            ...prev,
                            city: city || prev.city,
                            state: stateCode || prev.state,
                          }));
                        });
                      }}
                      placeholder="94520"
                      maxLength={10}
                    />
                    {zipLoading && <span className="zip-loading">Looking up...</span>}
                    {zipError && <span className="zip-error">{zipError}</span>}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Scheduling — only for local/hybrid */}
          {formData.locationType !== 'remote' && (
            <div className="form-section">
              <div className="form-section-title">📅 Scheduling</div>
              <div className="form-group">
                <label htmlFor="scheduledDate">When do you need them? <span className="label-optional">(optional)</span></label>
                <input
                  type="datetime-local"
                  id="scheduledDate"
                  name="scheduledDate"
                  value={formData.scheduledDate}
                  onChange={handleInputChange}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <span className="field-hint">Leave blank if you're flexible on timing</span>
              </div>

              <div className="form-group">
                <label htmlFor="cancellationPolicy">Cancellation Policy</label>
                <div className="cancellation-cards">
                  {[
                    { value: 'flexible', icon: '🟢', label: 'Flexible', desc: 'Cancel anytime, no fee' },
                    { value: 'moderate', icon: '🟡', label: 'Moderate', desc: '10% fee if cancelled under 1 hour before' },
                    { value: 'strict', icon: '🔴', label: 'Strict', desc: '25–50% fee depending on notice given' },
                  ].map(p => (
                    <button
                      key={p.value}
                      type="button"
                      className={`cancellation-card ${formData.cancellationPolicy === p.value ? 'selected' : ''}`}
                      onClick={() => handleInputChange({ target: { name: 'cancellationPolicy', value: p.value } })}
                    >
                      <span>{p.icon} <strong>{p.label}</strong></span>
                      <span className="cancellation-desc">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="post-job-checkbox">
            <input
              type="checkbox"
              id="isUrgent"
              name="isUrgent"
              checked={formData.isUrgent}
              onChange={handleInputChange}
            />
            <label htmlFor="isUrgent">⚡ This is an urgent job</label>
          </div>

          <div className="post-job-checkbox">
            <input
              type="checkbox"
              id="recurringEnabled"
              name="recurringEnabled"
              checked={formData.recurringEnabled}
              onChange={handleInputChange}
            />
            <label htmlFor="recurringEnabled">♻️ Make this a recurring job</label>
          </div>

          {formData.recurringEnabled && (
            <div className="post-job-recurring">
              <div className="form-group">
                <label className="form-label">Repeat every</label>
                <select
                  name="recurringInterval"
                  value={formData.recurringInterval}
                  onChange={handleInputChange}
                  className="form-input"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">End date (optional)</label>
                <input
                  type="date"
                  name="recurringEndDate"
                  value={formData.recurringEndDate}
                  onChange={handleInputChange}
                  className="form-input"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <p className="post-job-recurring-hint">
                After each job completes, a new one will be posted automatically and your previous freelancer will get first look.
              </p>
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}
          {upgradeLimit && (
            <UpgradePrompt
              inline
              reason={upgradeLimit.reason}
              limit={upgradeLimit.limit}
              onDismiss={() => setUpgradeLimit(null)}
            />
          )}

          {/* Save as template */}
          {canTemplates && (
            <div className="pj-save-template">
              {!showSaveTemplate ? (
                <button type="button" className="pj-save-template-btn" onClick={() => setShowSaveTemplate(true)}>
                  📋 Save as Template
                </button>
              ) : (
                <div className="pj-save-template-form">
                  <input
                    type="text"
                    value={saveTemplateName}
                    onChange={e => setSaveTemplateName(e.target.value)}
                    placeholder="Template name..."
                    className="pj-save-template-input"
                  />
                  <button type="button" className="pj-save-template-confirm" onClick={handleSaveTemplate} disabled={templateLoading || !saveTemplateName.trim()}>
                    {templateLoading ? '...' : 'Save'}
                  </button>
                  <button type="button" className="pj-save-template-cancel" onClick={() => setShowSaveTemplate(false)}>✕</button>
                </div>
              )}
            </div>
          )}

          <div className="post-job-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Posting...' : 'Post Job'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostJob;


