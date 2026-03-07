/**
 * PricingInsightWidget
 * Shows market pricing distribution for a service/job category.
 * Props:
 *   category    {string}  — category ID (e.g. 'web_development')
 *   subcategory {string}  — optional subcategory
 *   currentPrice{number}  — optional: highlight user's current price on the chart
 *   mode        {string}  — 'service' (default) or 'job'
 *   compact     {boolean} — show a minimal one-liner instead of full chart
 */

import React, { useState, useEffect } from 'react';
import { skillsApi } from '../../api/skills';
import './PricingInsightWidget.css';

const PricingInsightWidget = ({ category, subcategory, currentPrice, mode = 'service', compact = false }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!category) return;
    setLoading(true);
    setData(null);
    const fetcher = mode === 'job'
      ? skillsApi.getBudgetInsights(category)
      : skillsApi.getPricingInsights(category, subcategory);

    fetcher
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [category, subcategory, mode]);

  if (!category) return null;
  if (loading) return <div className="piw-loading">Loading market rates…</div>;
  if (!data || data.insufficient) {
    return (
      <div className="piw-insufficient">
        <span className="piw-icon">📊</span>
        <span>Market data not yet available for this category.</span>
      </div>
    );
  }

  const { min, p25, median, p75, max, count, avg } = data;
  const range = max - min || 1;

  // Position of markers as percentage of bar
  const pct = (v) => Math.round(((v - min) / range) * 100);
  const currentPct = currentPrice != null ? Math.max(0, Math.min(100, pct(currentPrice))) : null;

  if (compact) {
    return (
      <div className="piw-compact">
        <span className="piw-icon">💡</span>
        <span>
          Similar {mode === 'job' ? 'jobs budget' : 'services charge'}{' '}
          <strong>${p25.toLocaleString()}–${p75.toLocaleString()}</strong>
          {' '}(median: <strong>${median.toLocaleString()}</strong>)
        </span>
      </div>
    );
  }

  return (
    <div className="piw-card">
      <div className="piw-header">
        <span className="piw-title">
          📊 Market {mode === 'job' ? 'Budget' : 'Rate'} Insights
        </span>
        <span className="piw-count">{count} {mode === 'job' ? 'jobs' : 'services'} analyzed</span>
      </div>

      {/* Stat pills */}
      <div className="piw-stats">
        <div className="piw-stat">
          <span className="piw-stat-label">Low</span>
          <span className="piw-stat-value">${min.toLocaleString()}</span>
        </div>
        <div className="piw-stat piw-stat--p25">
          <span className="piw-stat-label">25th %ile</span>
          <span className="piw-stat-value">${p25.toLocaleString()}</span>
        </div>
        <div className="piw-stat piw-stat--median">
          <span className="piw-stat-label">Median</span>
          <span className="piw-stat-value">${median.toLocaleString()}</span>
        </div>
        <div className="piw-stat piw-stat--p75">
          <span className="piw-stat-label">75th %ile</span>
          <span className="piw-stat-value">${p75.toLocaleString()}</span>
        </div>
        <div className="piw-stat">
          <span className="piw-stat-label">High</span>
          <span className="piw-stat-value">${max.toLocaleString()}</span>
        </div>
      </div>

      {/* Distribution bar */}
      <div className="piw-bar-wrap">
        <div className="piw-bar">
          {/* IQR band (p25–p75) */}
          <div
            className="piw-bar-iqr"
            style={{ left: `${pct(p25)}%`, width: `${pct(p75) - pct(p25)}%` }}
          />
          {/* Median line */}
          <div className="piw-bar-median" style={{ left: `${pct(median)}%` }}>
            <span className="piw-bar-median-label">${median.toLocaleString()}</span>
          </div>
          {/* Your price */}
          {currentPct != null && (
            <div className="piw-bar-current" style={{ left: `${currentPct}%` }}>
              <span className="piw-bar-current-label">You</span>
            </div>
          )}
        </div>
        <div className="piw-bar-axis">
          <span>${min.toLocaleString()}</span>
          <span>${max.toLocaleString()}</span>
        </div>
      </div>

      {/* Pricing tip */}
      <div className="piw-tip">
        {currentPrice != null ? (
          currentPrice < p25 ? (
            <span className="piw-tip--low">💡 Your price is below 75% of similar {mode === 'job' ? 'budgets' : 'services'}. Consider raising it.</span>
          ) : currentPrice > p75 ? (
            <span className="piw-tip--high">💡 You're priced in the top 25%. Make sure your profile highlights your experience.</span>
          ) : (
            <span className="piw-tip--good">✅ Your price is right in the sweet spot for this category.</span>
          )
        ) : (
          <span>Typical {mode === 'job' ? 'budgets range' : 'services charge'} ${p25.toLocaleString()}–${p75.toLocaleString()} (avg ${avg.toLocaleString()})</span>
        )}
      </div>
    </div>
  );
};

export default PricingInsightWidget;
