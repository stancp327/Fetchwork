import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useFeatures } from '../../hooks/useFeatures';
import UpgradePrompt from '../Billing/UpgradePrompt';
import './PostJob.css';
import SEO from '../common/SEO';
import { validateStep, validateFormData, buildJobPayload } from './postJobUtils';
import { useZipLookup } from '../../hooks/useZipLookup';
import PostJobStep1 from './PostJobStep1';
import PostJobStep2 from './PostJobStep2';
import PostJobStep3 from './PostJobStep3';
import PostJobStep4 from './PostJobStep4';

const STEPS = [
  { num: 1, label: 'Basics' },
  { num: 2, label: 'Details' },
  { num: 3, label: 'Budget' },
  { num: 4, label: 'Location' },
];

const PostJob = () => {
  const navigate = useNavigate();
  const { hasFeature } = useFeatures();
  const canTemplates      = hasFeature('job_templates');
  const canAIDescription  = hasFeature('ai_job_description');

  const [currentStep, setCurrentStep] = useState(1);
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
    projectType: 'one_time',
    locationType: 'remote',
    city: '',
    state: '',
    zipCode: '',
    preferredDays: [],
    preferredTimeStart: '',
    preferredTimeEnd: '',
    deadline: '',
    scheduledDate: '',
    isUrgent: false,
    recurringEnabled:  false,
    recurringInterval: 'monthly',
    recurringEndDate:  '',
    attachments: [],
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
      setTemplateMsg(`Template "${t.name}" applied \u2713`);
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
      setTemplateMsg('Template saved \u2713');
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

  const handleNext = () => {
    const stepErrors = validateStep(currentStep, formData);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setCurrentStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (currentStep < 4) {
      handleNext();
      return;
    }
    handleSubmit();
  };

  const handleSubmit = async () => {
    const allErrors = validateFormData(formData);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      if (allErrors.title || allErrors.description || allErrors.category) setCurrentStep(1);
      else if (allErrors.experienceLevel || allErrors.duration) setCurrentStep(2);
      else if (allErrors.budgetAmount || allErrors.budgetMax) setCurrentStep(3);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const jobData = buildJobPayload(formData, selectedTeam);
      const result = await apiRequest('/api/jobs', { method: 'POST', body: JSON.stringify(jobData) });
      setSuccess(result?.status === 'draft' ? 'draft' : 'live');
      setTimeout(() => navigate(result?.status === 'draft' ? '/dashboard' : '/browse-jobs'), 2000);
    } catch (error) {
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
        {success === 'draft' ? (
          <>
            <h3>{'⏳'} Job Submitted for Approval</h3>
            <p>Your job is pending team approval before it goes live. Redirecting to your dashboard...</p>
          </>
        ) : (
          <>
            <h3>{'\u2713'} Job Posted Successfully!</h3>
            <p>Your job is now live. Redirecting to browse jobs...</p>
          </>
        )}
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
              <span className="pj-template-icon">{'\ud83d\udcc1'}</span>
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

        {/* Wizard progress bar */}
        <div className="pj-wizard-progress">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className={`pj-wizard-step${currentStep === step.num ? ' active' : ''}${currentStep > step.num ? ' completed' : ''}`}
              onClick={() => { if (step.num <= currentStep) setCurrentStep(step.num); }}
              role="button"
              tabIndex={step.num <= currentStep ? 0 : -1}
            >
              <div className="pj-wizard-step-number">
                {currentStep > step.num ? '\u2713' : step.num}
              </div>
              <div className="pj-wizard-step-label">{step.label}</div>
            </div>
          ))}
        </div>

        <form onSubmit={handleFormSubmit}>
          {/* All steps rendered, hidden via CSS to preserve local state */}
          <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
            <PostJobStep1
              formData={formData}
              handleInputChange={handleInputChange}
              errors={errors}
              setFormData={setFormData}
              setErrors={setErrors}
              canAIDescription={canAIDescription}
            />
          </div>
          <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
            <PostJobStep2
              formData={formData}
              handleInputChange={handleInputChange}
              errors={errors}
              userTeams={userTeams}
              selectedTeam={selectedTeam}
              setSelectedTeam={setSelectedTeam}
            />
          </div>
          <div style={{ display: currentStep === 3 ? 'block' : 'none' }}>
            <PostJobStep3
              formData={formData}
              handleInputChange={handleInputChange}
              errors={errors}
              setFormData={setFormData}
            />
          </div>
          <div style={{ display: currentStep === 4 ? 'block' : 'none' }}>
            <PostJobStep4
              formData={formData}
              handleInputChange={handleInputChange}
              zipLookup={zipLookup}
              setFormData={setFormData}
            />
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

          {/* Save as template — last step only */}
          {currentStep === 4 && canTemplates && (
            <div className="pj-save-template">
              {!showSaveTemplate ? (
                <button type="button" className="pj-save-template-btn" onClick={() => setShowSaveTemplate(true)}>
                  {'\ud83d\udcc1'} Save as Template
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

          {/* Wizard navigation */}
          <div className="pj-wizard-nav">
            {currentStep > 1 ? (
              <button type="button" className="btn-secondary" onClick={handleBack}>
                {'\u2190'} Back
              </button>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')}>
                Cancel
              </button>
            )}

            {currentStep < 4 ? (
              <button type="button" className="btn-primary" onClick={handleNext}>
                Next {'\u2192'}
              </button>
            ) : (
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Posting...' : 'Post Job'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostJob;
