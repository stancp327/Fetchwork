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

const STEPS = [
  { key: 'basics',   label: 'Basics' },
  { key: 'details',  label: 'Details' },
  { key: 'budget',   label: 'Budget & Timeline' },
  { key: 'review',   label: 'Review & Post' },
];

const DURATION_LABELS = {
  less_than_1_week: 'Less than 1 week',
  '1_2_weeks': '1-2 weeks',
  '1_month': '1 month',
  '2_3_months': '2-3 months',
  '3_6_months': '3-6 months',
  more_than_6_months: 'More than 6 months',
};

const EXP_LABELS = { entry: 'Entry Level', intermediate: 'Intermediate', expert: 'Expert' };

const PostJob = () => {
  const navigate = useNavigate();
  const { hasFeature } = useFeatures();
  const canTemplates      = hasFeature('job_templates');
  const canAIDescription  = hasFeature('ai_job_description');

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [userTeams, setUserTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [upgradeLimit, setUpgradeLimit] = useState(null);
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
    isUrgent: false,
    recurringEnabled:  false,
    recurringInterval: 'monthly',
    recurringEndDate:  '',
  });
  const [errors, setErrors] = useState({});
  const zipLookup = useZipLookup(formData.zipCode);

  // Auto-fill city/state from zip lookup result
  useEffect(() => {
    if (zipLookup.result && formData.zipCode.length >= 5) {
      setFormData(prev => ({
        ...prev,
        city: zipLookup.result.city || prev.city,
        state: zipLookup.result.state || prev.state,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipLookup.result]);

  // --- AI handlers ---
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
      setAiMsg(result.aiGenerated ? '\u2713 AI-generated \u2014 feel free to edit.' : '\uD83D\uDCE5 Template applied \u2014 edit to make it yours.');
      setTimeout(() => setAiMsg(''), 6000);
    } catch (err) {
      setAiMsg('Generation failed \u2014 try again.');
      setTimeout(() => setAiMsg(''), 4000);
    } finally {
      setAiGenerating(false);
    }
  };

  // --- Templates ---
  const loadTemplates = useCallback(async () => {
    if (!canTemplates) return;
    try {
      const data = await apiRequest('/api/job-templates');
      setTemplates(data.templates || []);
    } catch { /* silent */ }
  }, [canTemplates]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

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
      setTemplateMsg(`Template "${t.name}" applied \u2714`);
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
      setTemplateMsg('Template saved \u2714');
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

  // --- Per-step validation ---
  const validateStep = (step) => {
    const errs = {};
    if (step === 0) {
      if (!formData.title.trim()) errs.title = 'Job title is required';
      else if (formData.title.length > 100) errs.title = 'Title cannot exceed 100 characters';
      if (!formData.description.trim()) errs.description = 'Job description is required';
      else if (formData.description.length > 5000) errs.description = 'Description cannot exceed 5000 characters';
      if (!formData.category) errs.category = 'Category is required';
    } else if (step === 1) {
      if (!formData.experienceLevel) errs.experienceLevel = 'Experience level is required';
      if (!formData.duration) errs.duration = 'Duration is required';
    } else if (step === 2) {
      if (!formData.budgetAmount || parseFloat(formData.budgetAmount) < 1) errs.budgetAmount = 'Budget must be at least $1';
      if (formData.budgetType === 'range') {
        if (!formData.budgetMax || parseFloat(formData.budgetMax) < 1) errs.budgetMax = 'Max budget is required for range pricing';
        else if (parseFloat(formData.budgetMax) <= parseFloat(formData.budgetAmount)) errs.budgetMax = 'Max budget must be greater than min budget';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const allErrors = validateFormData(formData);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const jobData = buildJobPayload(formData, selectedTeam);
      await apiRequest('/api/jobs', { method: 'POST', body: JSON.stringify(jobData) });
      setSuccess(true);
      setTimeout(() => { navigate('/browse-jobs'); }, 2000);
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
        <h3>{'\u2714'} Job Posted Successfully!</h3>
        <p>Your job is now live. Redirecting to browse jobs...</p>
      </div>
    );
  }

  // --- Step renderers ---
  const renderStepBasics = () => (
    <div className="form-section">
      <div className="form-section-title">Job Basics</div>

      <div className="form-group">
        <label htmlFor="title">Job Title <span className="pj-required">*</span></label>
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
        {formData.title.length >= 5 && (
          <div className="pj-ai-title-wrap">
            {titleSuggestion ? (
              <div className="pj-ai-title-suggestion">
                <span className="pj-ai-title-improved">{'\u2713'} {titleSuggestion.improved}</span>
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
                {titleFixLoading ? '\u2713 Checking\u2026' : '\u2713 Improve title'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="form-group">
        <div className="pj-label-row">
          <label htmlFor="description">Job Description <span className="pj-required">*</span></label>
          <div className="pj-ai-btn-group">
            <button
              type="button"
              className={`pj-ai-btn ${!canAIDescription ? 'locked' : ''} ${aiGenerating ? 'loading' : ''}`}
              onClick={handleGenerateDescription}
              disabled={aiGenerating}
              title={!canAIDescription ? 'Available on Plus and above' : undefined}
            >
              {aiGenerating ? '\u23F3 Generating\u2026' : canAIDescription ? '\u2713 Write for me' : '\uD83D\uDD12 Write for me \u00B7 Plus'}
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
                {scopeExpanding ? '\u2713 Expanding\u2026' : '\u2713 Expand scope'}
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
          placeholder="Describe your project in detail, or click \u2713 Write for me above\u2026"
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
          <label htmlFor="category">Category <span className="pj-required">*</span></label>
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
              {catDetecting ? '\u2713 Detecting\u2026' : '\u2713 Auto-detect category'}
            </button>
          )}
        </div>
        {catDetected && catDetected.confidence > 0.7 && (
          <div className="pj-ai-cat-banner">{'\u2713'} Detected: {catDetected.category.replace(/_/g, ' ')} {'\u2014'} {catDetected.reason}</div>
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
              {skillsLoading ? '\u2713 Suggesting\u2026' : '\u2713 Suggest skills'}
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
  );

  const renderStepDetails = () => (
    <div className="form-section">
      <div className="form-section-title">Project Details</div>

      <div className="form-group">
        <label htmlFor="experienceLevel">Experience Level <span className="pj-required">*</span></label>
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
        <label htmlFor="duration">Project Duration <span className="pj-required">*</span></label>
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

      <div className="post-job-checkbox">
        <input
          type="checkbox"
          id="isUrgent"
          name="isUrgent"
          checked={formData.isUrgent}
          onChange={handleInputChange}
        />
        <label htmlFor="isUrgent">{'\u26A1'} This is an urgent job</label>
      </div>

      <div className="post-job-checkbox">
        <input
          type="checkbox"
          id="recurringEnabled"
          name="recurringEnabled"
          checked={formData.recurringEnabled}
          onChange={handleInputChange}
        />
        <label htmlFor="recurringEnabled">{'\u2699\uFE0F'} Make this a recurring job</label>
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

      {userTeams.length > 0 && (
        <div className="form-group" style={{ marginTop: 'var(--space-lg)' }}>
          <label htmlFor="teamId">Post on behalf of a team <span className="label-optional">(optional)</span></label>
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
      )}
    </div>
  );

  const renderStepBudget = () => (
    <div className="form-section">
      <div className="form-section-title">Budget & Timeline</div>

      <div className="post-job-grid-3">
        <div className="form-group">
          <label htmlFor="budgetType">Budget Type <span className="pj-required">*</span></label>
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
            {formData.budgetType === 'range' ? 'Min Budget' : 'Amount'} <span className="pj-required">*</span>
            {formData.budgetType !== 'range' && <span className="label-optional"> ({formData.budgetType === 'hourly' ? '/hr' : 'total'})</span>}
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
            {budgetEstimateLoading ? '\u2713 Estimating\u2026' : '\u2713 AI Budget Estimate'}
          </button>
          {budgetEstimate && (
            <div className="pj-ai-budget-result">
              <span className="pj-ai-budget-range">
                ${budgetEstimate.low?.toLocaleString()} {'\u2013'} ${budgetEstimate.high?.toLocaleString()} {budgetEstimate.type === 'hourly' ? '/hr' : 'total'}
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
            <label htmlFor="budgetMax">Max Budget <span className="pj-required">*</span></label>
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
        <label htmlFor="deadline">Deadline <span className="label-optional">(optional)</span></label>
        <input
          type="date"
          id="deadline"
          name="deadline"
          value={formData.deadline}
          onChange={handleInputChange}
          min={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div className="form-section-title" style={{ marginTop: 'var(--space-xl)' }}>Where is the work done?</div>

      <div className="work-type-cards">
        {[
          { value: 'remote', icon: '\uD83C\uDF0D', label: 'Remote', desc: 'Done online, anywhere' },
          { value: 'local', icon: '\uD83D\uDCCC', label: 'Local / On-site', desc: 'Freelancer comes to you' },
          { value: 'hybrid', icon: '\uD83D\uDD04', label: 'Hybrid', desc: 'Mix of remote + on-site' },
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

      {formData.locationType === 'remote' && (
        <div className="location-info-banner">
          {'\uD83C\uDF0D'} Great {'\u2014'} freelancers worldwide can apply. No location details needed.
        </div>
      )}

      {formData.locationType !== 'remote' && (
        <>
          <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
            {'\uD83D\uDCCC'} Let freelancers know where the work takes place so they can assess travel.
          </p>
          <div className="post-job-grid-location">
            <div className="form-group">
              <label htmlFor="city">City <span className="pj-required">*</span></label>
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
              <label htmlFor="state">State <span className="pj-required">*</span></label>
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
                onChange={handleInputChange}
                placeholder="94520"
                maxLength={10}
              />
              {zipLookup.loading && <span className="zip-loading">Looking up...</span>}
              {zipLookup.error && <span className="zip-error">{zipLookup.error}</span>}
              {zipLookup.result && <span className="zip-city-hint">{'\uD83D\uDCCC'} {zipLookup.result.city}, {zipLookup.result.state}</span>}
            </div>
          </div>
        </>
      )}

      {formData.locationType !== 'remote' && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <div className="form-section-title">{'\uD83D\uDCC5'} Scheduling</div>
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
        </div>
      )}
    </div>
  );

  const renderStepReview = () => {
    const skillsList = formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
    const team = userTeams.find(t => t._id === selectedTeam);

    return (
      <div className="form-section pj-review">
        <div className="form-section-title">Review Your Job</div>
        <p className="pj-review-hint">Please review the details below before posting.</p>

        <div className="pj-review-card">
          <div className="pj-review-section-label">Basics</div>
          <div className="pj-review-row">
            <span className="pj-review-label">Title</span>
            <span className="pj-review-value">{formData.title}</span>
          </div>
          <div className="pj-review-row pj-review-row-block">
            <span className="pj-review-label">Description</span>
            <p className="pj-review-desc">{formData.description}</p>
          </div>
          <div className="pj-review-row">
            <span className="pj-review-label">Category</span>
            <span className="pj-review-value">{formData.category.replace(/_/g, ' ')}</span>
          </div>
          {formData.subcategory && (
            <div className="pj-review-row">
              <span className="pj-review-label">Subcategory</span>
              <span className="pj-review-value">{formData.subcategory}</span>
            </div>
          )}
          {skillsList.length > 0 && (
            <div className="pj-review-row">
              <span className="pj-review-label">Skills</span>
              <span className="pj-review-value">{skillsList.join(', ')}</span>
            </div>
          )}
        </div>

        <div className="pj-review-card">
          <div className="pj-review-section-label">Details</div>
          <div className="pj-review-row">
            <span className="pj-review-label">Experience Level</span>
            <span className="pj-review-value">{EXP_LABELS[formData.experienceLevel] || formData.experienceLevel}</span>
          </div>
          <div className="pj-review-row">
            <span className="pj-review-label">Duration</span>
            <span className="pj-review-value">{DURATION_LABELS[formData.duration] || formData.duration}</span>
          </div>
          {formData.isUrgent && (
            <div className="pj-review-row">
              <span className="pj-review-label">Urgent</span>
              <span className="pj-review-value">{'\u26A1'} Yes</span>
            </div>
          )}
          {formData.recurringEnabled && (
            <div className="pj-review-row">
              <span className="pj-review-label">Recurring</span>
              <span className="pj-review-value">
                {formData.recurringInterval}{formData.recurringEndDate ? ` until ${formData.recurringEndDate}` : ''}
              </span>
            </div>
          )}
          {team && (
            <div className="pj-review-row">
              <span className="pj-review-label">Team</span>
              <span className="pj-review-value">{team.name}</span>
            </div>
          )}
        </div>

        <div className="pj-review-card">
          <div className="pj-review-section-label">Budget & Timeline</div>
          <div className="pj-review-row">
            <span className="pj-review-label">Budget</span>
            <span className="pj-review-value">
              {formData.budgetType === 'range'
                ? `${formData.currency} $${Number(formData.budgetAmount).toLocaleString()} \u2013 $${Number(formData.budgetMax).toLocaleString()}`
                : `${formData.currency} $${Number(formData.budgetAmount).toLocaleString()}${formData.budgetType === 'hourly' ? '/hr' : ''}`
              }
            </span>
          </div>
          {formData.deadline && (
            <div className="pj-review-row">
              <span className="pj-review-label">Deadline</span>
              <span className="pj-review-value">{formData.deadline}</span>
            </div>
          )}
          <div className="pj-review-row">
            <span className="pj-review-label">Location</span>
            <span className="pj-review-value">
              {formData.locationType === 'remote' ? 'Remote' : formData.locationType === 'local' ? 'Local / On-site' : 'Hybrid'}
              {formData.locationType !== 'remote' && formData.city && ` \u2014 ${formData.city}, ${formData.state}`}
              {formData.locationType !== 'remote' && formData.zipCode && ` ${formData.zipCode}`}
            </span>
          </div>
          {formData.scheduledDate && (
            <div className="pj-review-row">
              <span className="pj-review-label">Scheduled</span>
              <span className="pj-review-value">{new Date(formData.scheduledDate).toLocaleString()}</span>
            </div>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}
        {upgradeLimit && (
          <UpgradePrompt
            inline
            reason={upgradeLimit.reason}
            limit={upgradeLimit.limit}
            onDismiss={() => setUpgradeLimit(null)}
          />
        )}
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderStepBasics();
      case 1: return renderStepDetails();
      case 2: return renderStepBudget();
      case 3: return renderStepReview();
      default: return null;
    }
  };

  return (
    <div className="post-job-page">
      <SEO title="Post a Job" path="/post-job" noIndex={true} />
      <div className="post-job-header">
        <h1>Post a Job</h1>
        <p>Find the perfect freelancer for your project</p>
      </div>

      {/* Step indicator bar */}
      <div className="pj-step-bar">
        {STEPS.map((step, i) => (
          <div
            key={step.key}
            className={`pj-step-item ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}`}
          >
            <div className="pj-step-number">{i < currentStep ? '\u2713' : i + 1}</div>
            <span className="pj-step-label">{step.label}</span>
          </div>
        ))}
      </div>

      <div className="post-job-form">
        {/* Template picker — available on all steps */}
        {canTemplates && templates.length > 0 && currentStep < 3 && (
          <div className="pj-template-bar">
            <div className="pj-template-header">
              <span className="pj-template-icon">{'\uD83D\uDCCF'}</span>
              <strong>Templates</strong>
            </div>
            <div className="pj-template-list">
              {templates.map(t => (
                <div key={t._id} className="pj-template-chip">
                  <button className="pj-template-apply" onClick={() => applyTemplate(t._id)} disabled={templateLoading}>
                    {t.name}
                  </button>
                  <button className="pj-template-delete" onClick={() => handleDeleteTemplate(t._id)} title="Delete">{'\u2716'}</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {templateMsg && <div className="pj-template-msg">{templateMsg}</div>}

        <form onSubmit={handleSubmit}>
          {renderCurrentStep()}

          {/* Save as template — not on review step */}
          {canTemplates && currentStep < 3 && (
            <div className="pj-save-template">
              {!showSaveTemplate ? (
                <button type="button" className="pj-save-template-btn" onClick={() => setShowSaveTemplate(true)}>
                  {'\uD83D\uDCCF'} Save as Template
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
                  <button type="button" className="pj-save-template-cancel" onClick={() => setShowSaveTemplate(false)}>{'\u2716'}</button>
                </div>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="post-job-actions">
            {currentStep > 0 && (
              <button type="button" className="btn-secondary" onClick={handleBack}>
                Back
              </button>
            )}
            {currentStep < STEPS.length - 1 && (
              <button type="button" className="btn-primary" onClick={handleNext}>
                Next
              </button>
            )}
            {currentStep === STEPS.length - 1 && (
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Posting...' : 'Post Job'}
              </button>
            )}
            {currentStep === 0 && (
              <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostJob;
