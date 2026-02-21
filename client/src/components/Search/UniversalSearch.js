import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { categoryOptions } from '../../utils/categories';
import './UniversalSearch.css';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  ...categoryOptions
];

const DURATIONS = [
  { value: '', label: 'Any Duration' },
  { value: 'less_than_1_week', label: 'Less than 1 week' },
  { value: '1_2_weeks', label: '1-2 weeks' },
  { value: '1_month', label: '1 month' },
  { value: '2_3_months', label: '2-3 months' },
  { value: '3_6_months', label: '3-6 months' },
  { value: 'more_than_6_months', label: '6+ months' },
];

const EXPERIENCE = [
  { value: '', label: 'Any Level' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert', label: 'Expert' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'budget_high', label: 'Budget: High to Low' },
  { value: 'budget_low', label: 'Budget: Low to High' },
  { value: 'proposals', label: 'Fewest Proposals' },
];

const formatCurrency = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

const timeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

// ── Search Result Card ──────────────────────────────────────────
const ResultCard = ({ job, onClick }) => {
  const budget = job.budget || {};
  return (
    <div className="search-result-card" onClick={onClick}>
      <div className="result-card-header">
        <span className="result-card-title">{job.title}</span>
        <span className="result-card-budget">
          {formatCurrency(budget.amount)} {budget.type === 'hourly' ? '/hr' : ''}
        </span>
      </div>

      <div className="result-card-desc">{job.description}</div>

      {job.skills?.length > 0 && (
        <div className="result-card-skills">
          {job.skills.slice(0, 6).map((skill, i) => (
            <span key={i} className="skill-tag">{skill}</span>
          ))}
          {job.skills.length > 6 && (
            <span className="skill-tag">+{job.skills.length - 6} more</span>
          )}
        </div>
      )}

      <div className="result-card-meta">
        <span>📁 {CATEGORIES.find(c => c.value === job.category)?.label || job.category}</span>
        <span>📨 {job.proposalCount || 0} proposals</span>
        <span>⏱️ {timeAgo(job.createdAt)}</span>
        <span>📍 {job.location || 'Remote'}</span>
        {job.isUrgent && <span>🔥 Urgent</span>}
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────
const UniversalSearch = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef(null);

  // State from URL params
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [duration, setDuration] = useState('');
  const [experience, setExperience] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [remoteOnly, setRemoteOnly] = useState(false);

  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // ── Fetch suggestions ─────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const data = await apiRequest(`/api/search/suggestions?q=${encodeURIComponent(q)}`);
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  // Debounced suggestions
  useEffect(() => {
    const timer = setTimeout(() => fetchSuggestions(query), 300);
    return () => clearTimeout(timer);
  }, [query, fetchSuggestions]);

  // ── Search ────────────────────────────────────────────────────
  const search = useCallback(async (page = 1) => {
    setLoading(true);
    setShowSuggestions(false);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', '20');
      params.set('status', 'open');

      if (query) params.set('search', query);
      if (category) params.set('category', category);
      if (duration) params.set('duration', duration);
      if (experience) params.set('experienceLevel', experience);
      if (minBudget) params.set('minBudget', minBudget);
      if (maxBudget) params.set('maxBudget', maxBudget);
      if (remoteOnly) params.set('isRemote', 'true');

      // Sort
      if (sortBy === 'budget_high') params.set('sort', '-budget.amount');
      else if (sortBy === 'budget_low') params.set('sort', 'budget.amount');
      else if (sortBy === 'proposals') params.set('sort', 'proposalCount');
      else params.set('sort', '-createdAt');

      const data = await apiRequest(`/api/jobs?${params.toString()}`);
      const jobs = data.jobs || data || [];

      setResults(jobs);
      setPagination({
        total: data.total || jobs.length,
        page: data.page || page,
        pages: data.pages || Math.ceil((data.total || jobs.length) / 20),
      });

      // Update URL
      const urlParams = new URLSearchParams();
      if (query) urlParams.set('q', query);
      if (category) urlParams.set('category', category);
      setSearchParams(urlParams, { replace: true });
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, category, duration, experience, minBudget, maxBudget, remoteOnly, sortBy, setSearchParams]);

  // Search on mount if URL has params
  useEffect(() => {
    if (initialQuery || initialCategory) {
      search();
    }
    // Focus input on mount
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    search(1);
  };

  const handleSuggestionClick = (suggestion) => {
    if (suggestion.type === 'category') {
      const cat = CATEGORIES.find(
        (c) => c.label.toLowerCase() === suggestion.text.toLowerCase()
      );
      if (cat) setCategory(cat.value);
      setQuery('');
    } else {
      setQuery(suggestion.text);
    }
    setShowSuggestions(false);
    setTimeout(() => search(1), 50);
  };

  const clearFilters = () => {
    setCategory('');
    setDuration('');
    setExperience('');
    setMinBudget('');
    setMaxBudget('');
    setRemoteOnly(false);
  };

  const activeFilterCount = [category, duration, experience, minBudget, maxBudget, remoteOnly].filter(Boolean).length;

  return (
    <div className="search-container">
      {/* Search Bar */}
      <form onSubmit={handleSubmit}>
        <div className="search-bar-wrapper">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Search jobs, skills, categories..."
            />
            {query && (
              <button type="button" className="clear-btn" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
                ✕
              </button>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="search-suggestions">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="suggestion-item"
                  onMouseDown={() => handleSuggestionClick(s)}
                >
                  <span className={`suggestion-type ${s.type}`}>{s.type}</span>
                  <span className="suggestion-text">{s.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>

      {/* Filters */}
      <div className="search-filters">
        <div className="filter-group">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Duration</label>
          <select value={duration} onChange={(e) => setDuration(e.target.value)}>
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Experience</label>
          <select value={experience} onChange={(e) => setExperience(e.target.value)}>
            {EXPERIENCE.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Min Budget</label>
          <input
            type="number"
            value={minBudget}
            onChange={(e) => setMinBudget(e.target.value)}
            placeholder="$0"
            min="0"
          />
        </div>

        <div className="filter-group">
          <label>Max Budget</label>
          <input
            type="number"
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
            placeholder="Any"
            min="0"
          />
        </div>

        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
          <label>&nbsp;</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
            />
            Remote Only
          </label>
        </div>
      </div>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="active-filters">
          {category && (
            <span className="filter-tag">
              {CATEGORIES.find(c => c.value === category)?.label}
              <button className="remove-filter" onClick={() => setCategory('')}>✕</button>
            </span>
          )}
          {duration && (
            <span className="filter-tag">
              {DURATIONS.find(d => d.value === duration)?.label}
              <button className="remove-filter" onClick={() => setDuration('')}>✕</button>
            </span>
          )}
          {experience && (
            <span className="filter-tag">
              {EXPERIENCE.find(e => e.value === experience)?.label}
              <button className="remove-filter" onClick={() => setExperience('')}>✕</button>
            </span>
          )}
          {minBudget && (
            <span className="filter-tag">
              Min: ${minBudget}
              <button className="remove-filter" onClick={() => setMinBudget('')}>✕</button>
            </span>
          )}
          {maxBudget && (
            <span className="filter-tag">
              Max: ${maxBudget}
              <button className="remove-filter" onClick={() => setMaxBudget('')}>✕</button>
            </span>
          )}
          {remoteOnly && (
            <span className="filter-tag">
              Remote Only
              <button className="remove-filter" onClick={() => setRemoteOnly(false)}>✕</button>
            </span>
          )}
          <button
            className="remove-filter"
            onClick={clearFilters}
            style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results Header */}
      {hasSearched && (
        <div className="search-results-header">
          <span className="results-count">
            {loading ? 'Searching...' : `${pagination.total} job${pagination.total !== 1 ? 's' : ''} found`}
          </span>
          <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setTimeout(() => search(1), 50); }}>
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="search-loading">Searching...</div>}

      {/* Results */}
      {!loading && hasSearched && results.length === 0 && (
        <div className="search-empty">
          <div className="empty-icon">🔍</div>
          <p>No jobs found matching your criteria</p>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>Try adjusting your filters or search terms</p>
        </div>
      )}

      {!loading && results.map((job) => (
        <ResultCard
          key={job._id}
          job={job}
          onClick={() => navigate(`/jobs/${job._id}`)}
        />
      ))}

      {/* Pagination */}
      {!loading && pagination.pages > 1 && (
        <div className="search-pagination">
          <button
            disabled={pagination.page <= 1}
            onClick={() => search(pagination.page - 1)}
          >
            ← Previous
          </button>
          <span className="page-info">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            disabled={pagination.page >= pagination.pages}
            onClick={() => search(pagination.page + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {/* Initial State */}
      {!hasSearched && !loading && (
        <div className="search-empty">
          <div className="empty-icon">🔍</div>
          <p>Search for jobs across FetchWork</p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Type a keyword, select filters, or browse by category
          </p>
        </div>
      )}
    </div>
  );
};

export default UniversalSearch;
