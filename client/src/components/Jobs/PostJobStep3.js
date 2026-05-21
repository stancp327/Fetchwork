import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import PricingInsightWidget from '../Skills/PricingInsightWidget';

const PostJobStep3 = ({ formData, handleInputChange, errors, setFormData }) => {
  const [budgetEstimate, setBudgetEstimate] = useState(null);
  const [budgetEstimateLoading, setBudgetEstimateLoading] = useState(false);

  return (
    <div className="form-section">
      <div className="form-section-title">Budget &amp; Timeline</div>

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
                ${budgetEstimate.low?.toLocaleString()} &ndash; ${budgetEstimate.high?.toLocaleString()} {budgetEstimate.type === 'hourly' ? '/hr' : 'total'}
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
  );
};

export default PostJobStep3;
