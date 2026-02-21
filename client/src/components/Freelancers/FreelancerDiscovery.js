import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import BrowseLayout, {
  SearchBar, FilterSelect, FilterInput,
  ResultsControls, BrowsePagination, BrowseEmpty
} from '../common/BrowseLayout';
import '../common/BrowseLayout.css';

const CATEGORIES = [
  { value: 'all', label: 'All Skills' },
  { value: 'web_development', label: 'Web Development' },
  { value: 'mobile_development', label: 'Mobile Development' },
  { value: 'design', label: 'Design' },
  { value: 'writing', label: 'Writing' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'video_editing', label: 'Video Editing' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'other', label: 'Other' },
];

const SORT_OPTIONS = [
  { value: 'rating', label: 'Highest Rated' },
  { value: 'newest', label: 'Recently Joined' },
  { value: 'rate_low', label: 'Rate: Low to High' },
  { value: 'rate_high', label: 'Rate: High to Low' },
  { value: 'most_jobs', label: 'Most Jobs Completed' },
];

const FreelancerCard = ({ freelancer }) => {
  const navigate = useNavigate();

  return (
    <div className="browse-card" onClick={() => navigate(`/freelancers/${freelancer._id}`)}>
      <div className="browse-card-header">
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', fontWeight: 700, color: '#2563eb', flexShrink: 0,
            overflow: 'hidden'
          }}>
            {freelancer.profilePicture
              ? <img src={freelancer.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : `${freelancer.firstName?.[0] || ''}${freelancer.lastName?.[0] || ''}`
            }
          </div>
          <div>
            <h3 className="browse-card-title">{freelancer.firstName} {freelancer.lastName}</h3>
            <div className="browse-card-meta">
              {freelancer.headline || freelancer.title || 'Freelancer'}
              {freelancer.location && ` • 📍 ${freelancer.location}`}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {freelancer.rating > 0 && (
            <div style={{ fontWeight: 600, color: '#f59e0b' }}>⭐ {freelancer.rating.toFixed(1)}</div>
          )}
          {freelancer.hourlyRate > 0 && (
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827' }}>${freelancer.hourlyRate}/hr</div>
          )}
        </div>
      </div>

      {freelancer.bio && <p className="browse-card-desc">{freelancer.bio}</p>}

      <div className="browse-card-tags">
        {freelancer.skills?.slice(0, 5).map((s, i) => <span key={i} className="browse-tag">{s}</span>)}
        {freelancer.skills?.length > 5 && <span className="browse-tag">+{freelancer.skills.length - 5}</span>}
        {freelancer.isAvailable && <span className="browse-tag success">Available</span>}
        {freelancer.isVerified && <span className="browse-tag primary">Verified</span>}
      </div>

      <div className="browse-card-footer">
        <span className="browse-card-stats">
          {freelancer.completedJobs || 0} jobs completed
          {freelancer.totalEarnings > 0 && ` • $${(freelancer.totalEarnings / 1000).toFixed(0)}k+ earned`}
        </span>
        <button className="browse-card-cta" onClick={e => { e.stopPropagation(); navigate(`/freelancers/${freelancer._id}`); }}>
          View Profile
        </button>
      </div>
    </div>
  );
};

const FreelancerDiscovery = () => {
  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    category: 'all', minRate: '', maxRate: '', availability: 'all', sortBy: 'rating'
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [viewMode, setViewMode] = useState('grid');

  const fetchFreelancers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 12 });
      if (search) params.set('search', search);
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v !== 'all') params.set(k, v);
      });

      const data = await apiRequest(`/api/users/freelancers?${params}`);
      setFreelancers(data.freelancers || data.users || []);
      setPagination(data.pagination || {});
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, filters, page]);

  useEffect(() => { fetchFreelancers(); }, [fetchFreelancers]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const sidebar = (
    <>
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>Filters</h3>
      <FilterSelect label="Category" value={filters.category} onChange={v => updateFilter('category', v)} options={CATEGORIES} />
      <FilterInput label="Min Rate ($/hr)" value={filters.minRate} onChange={v => updateFilter('minRate', v)} placeholder="$0" type="number" />
      <FilterInput label="Max Rate ($/hr)" value={filters.maxRate} onChange={v => updateFilter('maxRate', v)} placeholder="No limit" type="number" />
      <FilterSelect label="Availability" value={filters.availability} onChange={v => updateFilter('availability', v)}
        options={[
          { value: 'all', label: 'Any' },
          { value: 'available', label: 'Available Now' },
          { value: 'busy', label: 'Currently Busy' },
        ]} />
    </>
  );

  return (
    <>
      <SEO title="Discover Freelancers" description="Find skilled freelancers for your project." />
      <BrowseLayout
        title="Discover Freelancers"
        subtitle="Find skilled professionals for your next project"
        sidebar={sidebar}
      >
        <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by name, skills, or expertise..." />

        <ResultsControls
          total={pagination.total || 0}
          sortValue={filters.sortBy}
          onSortChange={v => updateFilter('sortBy', v)}
          sortOptions={SORT_OPTIONS}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {loading ? (
          <div className={`browse-grid ${viewMode === 'grid' ? 'grid-view' : 'list-view'}`}>
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="browse-card" style={{ height: 200, background: '#f9fafb' }} />)}
          </div>
        ) : error ? (
          <BrowseEmpty icon="⚠️" title="Error loading freelancers" message={error} />
        ) : freelancers.length === 0 ? (
          <BrowseEmpty icon="👥" title="No freelancers found" message="Try adjusting your search or filters" />
        ) : (
          <div className={`browse-grid ${viewMode === 'grid' ? 'grid-view' : 'list-view'}`}>
            {freelancers.map(f => <FreelancerCard key={f._id} freelancer={f} />)}
          </div>
        )}

        <BrowsePagination current={page} total={pagination.pages || 0} onChange={setPage} />
      </BrowseLayout>
    </>
  );
};

export default FreelancerDiscovery;
