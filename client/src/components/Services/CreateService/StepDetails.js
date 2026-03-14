import React, { useState } from 'react';
import { apiRequest } from '../../../utils/api';
import CategoryCombobox from '../../common/CategoryCombobox';
import ServiceTypeSelector from './ServiceTypeSelector';

const StepDetails = ({ data, onChange, errors, hasFeature = () => true }) => {
  const canAI = hasFeature('ai_job_description');
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoTips, setSeoTips] = useState(null);
  const [seoError, setSeoError] = useState('');

  const handleSeoTips = async () => {
    if (!canAI) { setSeoError('upgrade_required'); return; }
    setSeoLoading(true);
    setSeoTips(null);
    setSeoError('');
    try {
      const result = await apiRequest('/api/ai/optimize-service-seo', {
        method: 'POST',
        body: JSON.stringify({
          title: data.title, description: data.description,
          category: data.category, skills: data.skills,
        }),
      });
      setSeoTips(result);
    } catch (err) {
      if (err.data?.error === 'upgrade_required') setSeoError('upgrade_required');
      else setSeoError('Failed to generate SEO tips');
    } finally {
      setSeoLoading(false);
    }
  };

  return (
    <div className="wizard-step-content">
      <h2>Service Details</h2>
      <p className="wizard-tip">💡 A clear, descriptive title helps clients find your service.</p>

      <ServiceTypeSelector value={data.serviceType} onChange={onChange} hasFeature={hasFeature} />

      <div className="wiz-field" style={{ marginTop: '1.5rem' }}>
        <label>Service Title *</label>
        <input
          type="text" value={data.title} maxLength={100}
          onChange={e => onChange('title', e.target.value)}
          placeholder={
            data.serviceType === 'recurring'
              ? 'e.g. 1-on-1 Math Tutoring Sessions (All Grades)'
              : 'e.g. I will create a professional website for your business'
          }
        />
        <div className="wiz-field-footer">
          <span className="wiz-error">{errors.title}</span>
          <span className="wiz-count">{data.title.length}/100</span>
        </div>
      </div>

      <div className="wiz-field">
        <label>Description *</label>
        <textarea
          value={data.description} maxLength={3000} rows={6}
          onChange={e => onChange('description', e.target.value)}
          placeholder={
            data.serviceType === 'recurring'
              ? 'Describe your sessions — your background, what you cover, your teaching style, expected outcomes...'
              : 'Describe your service in detail — what you offer, your process, what makes you different...'
          }
        />
        <div className="wiz-field-footer">
          <span className="wiz-error">{errors.description}</span>
          <span className="wiz-count">{data.description.length}/3000</span>
        </div>
      </div>

      {/* AI SEO Tips */}
      {data.title && (
        <div className="cs-ai-seo-wrap">
          <button
            type="button"
            className={`cs-ai-seo-btn ${!canAI ? 'locked' : ''}`}
            disabled={seoLoading}
            onClick={handleSeoTips}
            title={!canAI ? 'Available on Plus and above' : undefined}
          >
            {seoLoading ? '✨ Analyzing…' : canAI ? '✨ SEO Tips' : '🔒 SEO Tips · Plus'}
          </button>

          {seoError === 'upgrade_required' && (
            <div className="cs-ai-seo-upgrade">Upgrade to Plus to unlock AI SEO tips.</div>
          )}
          {seoError && seoError !== 'upgrade_required' && (
            <div className="cs-ai-seo-error">{seoError}</div>
          )}

          {seoTips && (
            <div className="cs-ai-seo-results">
              {seoTips.titleSuggestion && (
                <div className="cs-ai-seo-section">
                  <strong>Suggested Title</strong>
                  <div className="cs-ai-seo-suggestion">
                    <span>{seoTips.titleSuggestion}</span>
                    <button type="button" className="cs-ai-seo-apply" onClick={() => onChange('title', seoTips.titleSuggestion)}>Use</button>
                  </div>
                </div>
              )}
              {seoTips.keywords?.length > 0 && (
                <div className="cs-ai-seo-section">
                  <strong>Keywords to Include</strong>
                  <div className="cs-ai-seo-chips">
                    {seoTips.keywords.map(kw => <span key={kw} className="cs-ai-seo-chip">{kw}</span>)}
                  </div>
                </div>
              )}
              {seoTips.descriptionTips?.length > 0 && (
                <div className="cs-ai-seo-section">
                  <strong>Description Tips</strong>
                  <ul className="cs-ai-seo-tips-list">
                    {seoTips.descriptionTips.map((tip, i) => <li key={i}>{tip}</li>)}
                  </ul>
                </div>
              )}
              {seoTips.tagSuggestions?.length > 0 && (
                <div className="cs-ai-seo-section">
                  <strong>Suggested Tags</strong>
                  <div className="cs-ai-seo-chips">
                    {seoTips.tagSuggestions.map(tag => (
                      <button key={tag} type="button" className="cs-ai-seo-tag-btn" onClick={() => {
                        const current = data.skills ? data.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
                        if (!current.includes(tag)) onChange('skills', [...current, tag].join(', '));
                      }}>+ {tag}</button>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" className="cs-ai-seo-dismiss" onClick={() => setSeoTips(null)}>Dismiss</button>
            </div>
          )}
        </div>
      )}

      <div className="wiz-row">
        <div className="wiz-field">
          <label>Category *</label>
          <CategoryCombobox
            value={data.category}
            onChange={v => onChange('category', v)}
            required
          />
          {errors.category && <span className="wiz-error">{errors.category}</span>}
        </div>
        <div className="wiz-field">
          <label>Subcategory</label>
          <input type="text" value={data.subcategory} onChange={e => onChange('subcategory', e.target.value)}
            placeholder={data.serviceType === 'recurring' ? 'e.g. SAT Prep, HIIT, Life Coaching' : 'e.g. React, WordPress'} />
        </div>
      </div>

      <div className="wiz-field">
        <label>Tags / Skills</label>
        <input type="text" value={data.skills} onChange={e => onChange('skills', e.target.value)}
          placeholder={data.serviceType === 'recurring' ? 'e.g. Algebra, Calculus, Test Prep (comma separated)' : 'React, Node.js, MongoDB (comma separated)'} />
      </div>

      {/* ── Service Location ── */}
      <div className="wiz-field">
        <label>Where is this service delivered?</label>
        <div className="svc-location-cards">
          {[
            { value: 'remote',         icon: '💻', label: 'Remote',           desc: 'Fully online — video, chat, or digital delivery' },
            { value: 'at_client',      icon: '🏠', label: 'I go to the client', desc: "You travel to the client's location" },
            { value: 'at_freelancer',  icon: '📍', label: 'Client comes to me', desc: 'Client visits your location or workspace' },
            { value: 'flexible',       icon: '🔄', label: 'Flexible',          desc: 'Can do either — you decide together' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`svc-location-card ${(data.serviceLocation || 'remote') === opt.value ? 'selected' : ''}`}
              onClick={() => onChange('serviceLocation', opt.value)}
            >
              <span className="svc-loc-icon">{opt.icon}</span>
              <div>
                <div className="svc-loc-label">{opt.label}</div>
                <div className="svc-loc-desc">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StepDetails;
