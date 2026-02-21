import React, { useState } from 'react';
import './BrowseLayout.css';

// ── Search Bar ──────────────────────────────────────────────────
export const SearchBar = ({ value, onChange, placeholder, children }) => (
  <div className="browse-search-bar">
    <div className="search-input-wrapper">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Search...'}
        className="search-input"
      />
      {value && (
        <button className="search-clear" onClick={() => onChange('')}>×</button>
      )}
    </div>
    {children && <div className="search-extras">{children}</div>}
  </div>
);

// ── Filter Chip ─────────────────────────────────────────────────
export const FilterSelect = ({ label, value, onChange, options }) => (
  <div className="filter-select-group">
    <label className="filter-label">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className="filter-select">
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

export const FilterInput = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div className="filter-select-group">
    <label className="filter-label">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="filter-input"
    />
  </div>
);

export const FilterCheckbox = ({ label, checked, onChange }) => (
  <label className="filter-checkbox">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

// ── Results Controls ────────────────────────────────────────────
export const ResultsControls = ({ total, sortValue, onSortChange, sortOptions, viewMode, onViewModeChange }) => (
  <div className="results-controls">
    <span className="results-count">
      <strong>{total}</strong> result{total !== 1 ? 's' : ''} found
    </span>
    <div className="results-actions">
      {sortOptions && (
        <select value={sortValue} onChange={e => onSortChange(e.target.value)} className="results-sort">
          {sortOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
      {onViewModeChange && (
        <div className="view-toggle">
          <button
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => onViewModeChange('grid')}
            title="Grid view"
          >⊞</button>
          <button
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
            title="List view"
          >☰</button>
        </div>
      )}
    </div>
  </div>
);

// ── Pagination ──────────────────────────────────────────────────
export const BrowsePagination = ({ current, total, onChange }) => {
  if (total <= 1) return null;
  const pages = [];
  const start = Math.max(1, current - 2);
  const end = Math.min(total, current + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="browse-pagination">
      <button disabled={current <= 1} onClick={() => onChange(current - 1)} className="page-btn">← Prev</button>
      {start > 1 && <><button onClick={() => onChange(1)} className="page-btn">1</button><span className="page-dots">…</span></>}
      {pages.map(p => (
        <button key={p} className={`page-btn ${p === current ? 'active' : ''}`} onClick={() => onChange(p)}>{p}</button>
      ))}
      {end < total && <><span className="page-dots">…</span><button onClick={() => onChange(total)} className="page-btn">{total}</button></>}
      <button disabled={current >= total} onClick={() => onChange(current + 1)} className="page-btn">Next →</button>
    </div>
  );
};

// ── Empty State ─────────────────────────────────────────────────
export const BrowseEmpty = ({ icon = '🔍', title, message, action }) => (
  <div className="browse-empty">
    <div className="browse-empty-icon">{icon}</div>
    <h3>{title || 'No results found'}</h3>
    <p>{message || 'Try adjusting your search or filters'}</p>
    {action}
  </div>
);

// ── Main Layout ─────────────────────────────────────────────────
const BrowseLayout = ({ title, subtitle, headerAction, sidebar, children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="browse-container">
      {/* Header */}
      <div className="browse-header">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {headerAction && <div className="browse-header-action">{headerAction}</div>}
      </div>

      {/* Content */}
      <div className="browse-content">
        {/* Mobile filter toggle */}
        {sidebar && (
          <button className="mobile-filter-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ⚙️ Filters {sidebarOpen ? '▲' : '▼'}
          </button>
        )}

        {/* Sidebar */}
        {sidebar && (
          <aside className={`browse-sidebar ${sidebarOpen ? 'open' : ''}`}>
            {sidebar}
          </aside>
        )}

        {/* Main */}
        <main className="browse-main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default BrowseLayout;
