import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { formatBudget, formatDuration, formatCategory } from '../../utils/formatters';
import SEO from '../common/SEO';
import BrowseLayout, {
  SearchBar, FilterSelect, FilterInput, FilterCheckbox,
  ResultsControls, BrowsePagination, BrowseEmpty
} from '../common/BrowseLayout';
import '../common/BrowseLayout.css';

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'web_development', label: 'Web Development' },
  { value: 'mobile_development', label: 'Mobile Development' },
  { value: 'design', label: 'Design' },
  { value: 'writing', label: 'Writing' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'data_entry', label: 'Data Entry' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'translation', label: 'Translation' },
  { value: 'video_editing', label: 'Video Editing' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'other', label: 'Other' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'budget_high', label: 'Highest Budget' },
  { value: 'budget_low', label: 'Lowest Budget' },
  { value: 'most_proposals', label: 'Most Proposals' },
];

const JobCard = ({ job }) => {
  const navigate = useNavigate();
  const timeAgo = (date) => {
    const d = Math.floor((Date.now() - new Date(date)) / 86400000);
    return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d}d ago`;
  };

  return (
    <div className="browse-card" onClick={() => navigate(`/jobs/${job._id}`)}>
      <div className="browse-card-header">
        <div>
          <h3 className="browse-card-title">{job.title}</h3>
          <div className="browse-card-meta">
            {job.client?.firstName} {job.client?.lastName} • {timeAgo(job.createdAt)}
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
        {job.experienceLevel && <span className="browse-tag">{job.experienceLevel}</span>}
        {job.workLocation && job.workLocation !== 'remote' && <span className="browse-tag">{job.workLocation}</span>}
        {job.isUrgent && <span className="browse-tag danger">Urgent</span>}
        {job.skills?.slice(0, 3).map((s, i) => <span key={i} className="browse-tag">{s}</span>)}
        {job.skills?.length > 3 && <span className="browse-tag">+{job.skills.length - 3}</span>}
      </div>

      <div className="browse-card-footer">
        <span className="browse-card-stats">
          {job.proposalCount || 0} proposals • {job.views || 0} views
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
    minBudget: '', maxBudget: '', sortBy: 'newest', urgentOnly: false
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
      <FilterSelect label="Location" value={filters.workLocation} onChange={v => updateFilter('workLocation', v)}
        options={[{ value: 'all', label: 'All' }, { value: 'remote', label: 'Remote' }, { value: 'local', label: 'On-site' }, { value: 'hybrid', label: 'Hybrid' }]} />
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
