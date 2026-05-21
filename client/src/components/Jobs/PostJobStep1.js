import React, { useState } from 'react';
import CategoryCombobox from '../common/CategoryCombobox';
import UpgradePrompt from '../Billing/UpgradePrompt';
import { aiApi } from '../../api/ai';
import { apiRequest } from '../../utils/api';

const PostJobStep1 = ({ formData, handleInputChange, errors, setFormData, setErrors, canAIDescription }) => {
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMsg, setAiMsg] = useState('');
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
      setAiMsg(result.aiGenerated ? '\u2713 AI-generated \u2014 feel free to edit.' : '\ud83d\udce5 Template applied \u2014 edit to make it yours.');
      setTimeout(() => setAiMsg(''), 6000);
    } catch {
      setAiMsg('Generation failed \u2014 try again.');
      setTimeout(() => setAiMsg(''), 4000);
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div className="form-section">
      <div className="form-section-title">Job Basics</div>

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
          <label htmlFor="description">Job Description *</label>
          <div className="pj-ai-btn-group">
            <button
              type="button"
              className={`pj-ai-btn ${!canAIDescription ? 'locked' : ''} ${aiGenerating ? 'loading' : ''}`}
              onClick={handleGenerateDescription}
              disabled={aiGenerating}
              title={!canAIDescription ? 'Available on Plus and above' : undefined}
            >
              {aiGenerating ? '\u23f3 Generating\u2026' : canAIDescription ? '\u2713 Write for me' : '\ud83d\udd12 Write for me \u00b7 Plus'}
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
              {catDetecting ? '\u2713 Detecting\u2026' : '\u2713 Auto-detect category'}
            </button>
          )}
        </div>
        {catDetected && catDetected.confidence > 0.7 && (
          <div className="pj-ai-cat-banner">{'\u2713'} Detected: {catDetected.category.replace(/_/g, ' ')} &mdash; {catDetected.reason}</div>
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
};

export default PostJobStep1;
