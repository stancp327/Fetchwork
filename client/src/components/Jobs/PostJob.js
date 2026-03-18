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
  const canTemplates = hasFeature('job_templates');
  const canAIDescription = hasFeature('ai_job_description');

  // Reactive zip lookup — auto-fills city/state when user enters a valid zip
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
      setAImsg('upgrade_required');
      return;
    }
    if (!formData.title) {
      setAImsg('Add a job title first so I know what to write about.');
      setTimeout(() => setAImsg(''), 4000);
      return;
    }

    setAiGenerating(true);
    setAiMsg('');
    try {
      const result = await aiApi.generateDescription({
        title: formData.title,
        category: formData.category,
        skills: formData.skills,
        budgetType: formData.budgetType,
        budgetAmount: formData.budgetAmount,
        duration: formData.duration,
        experienceLevel: formData.experienceLevel,
      });

      setFormData(prev => ({
        ...prev,
        description: result.description
      }));
      setAiMsg(result.aiGenerated ? '✨ AI-generated — feel free to edit.' : '📝 Template applied — edit to make it yours.');
      setTimeout(() => setAiMsg(''), 6000);
    } catch (err) {
      setAiMsg('Generation failed — try again.');
      setTimeout(() => setAiMsg(''), 4000);
    } finally {
      setAiGenerating(false);
    }
  };

  // ... (rest of the existing code remains exactly the same)

  return (
    <div className="post-job-page">
      <SEO title="Post a Job" path="/post-job" noIndex={true} />
      <div className="post-job-header">
        <h1>Post a Job</h1>
        <p>Find the perfect freelancer for your project</p>
      </div>

      <div className="post-job-form">
        {/* Existing template picker and form sections... */}
        
        <form onSubmit={handleSubmit}>
          {/* Existing form content... */}

          <div className="post-job-actions">
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading || !(
                formData.title.trim() !== '' &&
                formData.description.trim() !== '' &&
                formData.category !== '' &&
                formData.budgetAmount && parseFloat(formData.budgetAmount) >= 1 &&
                formData.duration !== '' &&
                formData.experienceLevel !== '' &&
                (formData.locationType === 'remote' || (formData.city.trim() !== '' && formData.state.trim() !== ''))
              )}
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