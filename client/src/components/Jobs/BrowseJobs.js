import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { formatBudget, formatDuration, formatCategory } from '../../utils/formatters';
import { categoryOptions } from '../../utils/categories';
import { getLocationDisplay, getLocationTypeBadge } from '../../utils/location';
import SEO from '../common/SEO';
import BrowseLayout, {
  SearchBar, FilterSelect, FilterInput, FilterCheckbox,
  ResultsControls, BrowsePagination, BrowseEmpty
} from '../common/BrowseLayout';
import SaveButton from '../common/SaveButton';
import '../common/BrowseLayout.css';

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  ...categoryOptions
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'budget_high', label: 'Highest Budget' },
  { value: 'budget_low', label: 'Lowest Budget' },
  { value: 'most_proposals', label: 'Most Proposals' },
];

const deadlineLabel = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const days = Math.ceil((d - now) / 86400000);
  if (days < 0) return { text: 'Overdue', color: '#dc2626' };
  if (days === 0) return { text: 'Due today', color: '#dc2626' };
  if (days <= 3) return { text: `${days}d left`, color: '#f59e0b' };
  if (days <= 7) return { text: `${days}d left`, color: '#f59e0b' };
  return { text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: '#6b7280' };
};

const interestLevel = (proposals, views) => {
  const p = proposals || 0;
  const v = views || 0;
  if (p >= 10 || v >= 50) return { text: '🔥 High interest', color: '#dc2626' };
  if (p >= 5 || v >= 20) return { text: '👀 Growing interest', color: '#f59e0b' };
  if (p >= 1) return { text: `${p} applicant${p > 1 ? 's' : ''}`, color: '#6b7280' };
  return { text: 'Be the first to apply', color: '#10b981' };
};

const JobCard = ({ job }) => {
  const navigate = useNavigate();
  const timeAgo = (date) => {
    const d = Math.floor((Date.now() - new Date(date)) / 86400000);
    return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d}d ago`;
  };

  const isRemote = !job.location || job.location?.locationType === 'remote' || (typeof job.location === 'string' && (!job.location || job.location === 'Remote'));
  const dl = deadlineLabel(job.deadline);
  const interest = interestLevel(job.proposalCount, job.views);

  return (
    <div className="browse-card" onClick={() => navigate(`/jobs/${job._id}`)} style={{ borderLeft: isRemote ? '3px solid #2563eb' : '3px solid #10b981', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem' }}>
        <SaveButton itemId={job._id} itemType="job" size="sm" />
      </div>
      <div className="browse-card-header">
        <div>
          <h3 className="browse-card-title">{job.title}</h3>
          <div className="browse-card-meta">
            {job.client?.firstName} {job.client?.lastName} • {timeAgo(job.createdAt)}
            {dl && <> • <span style={{ color: dl.color, fontWeight: 600 }}>⏰ {dl.text}</span></>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, color: '#111827', fontSize: '1rem' }}>{formatBudget(job.budget)}</div>
          {job.duration && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{formatDuration(job.duration)}</div>}
        </div>
      </div>

      <p className="browse-card-desc">{job.description}</p>

      <div className="browse-card-tags">
        <span className="browse-tag primary">{formatCategory(job.category)}</span>
        {isRemote ? (
          <span className="browse-tag" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 600 }}>🌐 Remote</span>
        ) : (
          <span className="browse-tag" style={{ background: '#ecfdf5', color: '#059669', fontWeight: 600 }}>📍 {getLocationDisplay(job.location)}</span>
        )}
        {job.experienceLevel && <span className="browse-tag">{job.experienceLevel}</span>}
        {job.isUrgent && <span className="browse-tag danger">🚨 Urgent</span>}
        {job.skills?.slice(0, 3).map((s, i) => <span key={i} className="browse-tag">{s}</span>)}
        {job.skills?.length > 3 && <span className="browse-tag">+{job.skills.length - 3}</span>}
      </div>

      <div className="browse-card-footer">
        <span className="browse-card-stats" style={{ color: interest.color, fontWeight: 500 }}>
          {interest.text} • {job.views || 0} views
        </span>
        <button className="browse-card-cta" onClick={e => { e.stopPropagation(); navigate(`/jobs/${job._id}`); }}>
          Apply Now
        </button>
      </div>
    </div>
  );
};

const BrowseJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    category: 'all', experienceLevel: 'all', workLocation: 'all',
    near: '', radius: '25', minBudget: '', maxBudget: '', sortBy: 'newest', urgentOnly: false
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [viewMode, setViewMode] = useState('list');

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 12 });
      if (search) params.set('search', search);
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v !== 'all' && v !== false) params.set(k, v);
      });

      const data = await apiRequest(`/api/jobs?${params}`);
      setJobs(data.jobs || []);
      setPagination(data.pagination || {});
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, filters, page]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const sidebar = (
    <>
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>Filters</h3>
      <FilterSelect label="Category" value={filters.category} onChange={v => updateFilter('category', v)} options={CATEGORIES} />
      <FilterSelect label="Experience" value={filters.experienceLevel} onChange={v => updateFilter('experienceLevel', v)}
        options={[{ value: 'all', label: 'All Levels' }, { value: 'entry', label: 'Entry' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'expert', label: 'Expert' }]} />
      <FilterSelect label="Work Type" value={filters.workLocation} onChange={v => updateFilter('workLocation', v)}
        options={[{ value: 'all', label: 'All Types' }, { value: 'remote', label: '🌐 Remote' }, { value: 'local', label: '📍 Local' }, { value: 'hybrid', label: '🔄 Hybrid' }]} />
      <FilterInput label="Near (zip or city)" value={filters.near} onChange={v => updateFilter('near', v)} placeholder="e.g. 94520 or Concord" />
      {filters.near && (
        <FilterSelect label="Distance" value={filters.radius} onChange={v => updateFilter('radius', v)}
          options={[{ value: '5', label: '5 miles' }, { value: '10', label: '10 miles' }, { value: '25', label: '25 miles' }, { value: '50', label: '50 miles' }, { value: '100', label: '100 miles' }]} />
      )}
      <FilterInput label="Min Budget" value={filters.minBudget} onChange={v => updateFilter('minBudget', v)} placeholder="$0" type="number" />
      <FilterInput label="Max Budget" value={filters.maxBudget} onChange={v => updateFilter('maxBudget', v)} placeholder="No limit" type="number" />
      <FilterCheckbox label="Urgent only" checked={filters.urgentOnly} onChange={v => updateFilter('urgentOnly', v)} />
    </>
  );

  return (
    <>
      <SEO title="Browse Freelance Jobs" description="Find your next freelance project." />
      <BrowseLayout
        title="Browse Jobs"
        subtitle="Find your next freelance opportunity"
        sidebar={sidebar}
      >
        <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search jobs, skills, or keywords..." />

        <ResultsControls
          total={pagination.total || 0}
          sortValue={filters.sortBy}
          onSortChange={v => updateFilter('sortBy', v)}
          sortOptions={SORT_OPTIONS}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {loading ? (
          <div className="browse-grid list-view">
            {[1, 2, 3].map(i => <div key={i} className="browse-card" style={{ height: 160, background: '#f9fafb', animation: 'shimmer 1.5s infinite' }} />)}
          </div>
        ) : error ? (
          <BrowseEmpty icon="⚠️" title="Error loading jobs" message={error} />
        ) : jobs.length === 0 ? (
          <BrowseEmpty icon="📋" title="No jobs found" message="Try adjusting your search criteria or filters" />
        ) : (
          <div className={`browse-grid ${viewMode === 'grid' ? 'grid-view' : 'list-view'}`}>
            {jobs.map(job => <JobCard key={job._id} job={job} />)}
          </div>
        )}

        <BrowsePagination current={page} total={pagination.pages || 0} onChange={setPage} />
      </BrowseLayout>
    </>
  );
};

export default BrowseJobs;
