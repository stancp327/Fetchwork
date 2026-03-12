import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { categoryOptions } from '../../utils/categories';
import { getLocationDisplay } from '../../utils/location';
import SEO from '../common/SEO';
import Avatar from '../common/Avatar';
import { useUserLocation } from '../../hooks/useUserLocation';
import BrowseLayout, {
  SearchBar, FilterSelect, FilterInput,
  ResultsControls, BrowsePagination, BrowseEmpty
} from '../common/BrowseLayout';
import SaveButton from '../common/SaveButton';
import AvailabilityBadge from '../common/AvailabilityBadge';
import InviteToJob from './InviteToJob';
import { useAuth } from '../../context/AuthContext';
import '../common/BrowseLayout.css';

const CATEGORIES = [
  { value: 'all', label: 'All Skills' },
  ...categoryOptions
];

const SORT_OPTIONS = [
  { value: 'rating', label: 'Highest Rated' },
  { value: 'newest', label: 'Recently Joined' },
  { value: 'rate_low', label: 'Rate: Low to High' },
  { value: 'rate_high', label: 'Rate: High to Low' },
  { value: 'most_jobs', label: 'Most Jobs Completed' },
];

const FreelancerCard = ({ freelancer, onInvite }) => {
  const navigate = useNavigate();

  return (
    <div className="browse-card" onClick={() => navigate(`/freelancers/${freelancer._id}`)}>
      <div className="browse-card-header">
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', flexShrink: 0, overflow: 'hidden'
          }}>
            <Avatar user={freelancer} size={48} />
          </div>
          <div>
            <h3 className="browse-card-title">{freelancer.firstName} {freelancer.lastName}</h3>
            <div className="browse-card-meta">
              {freelancer.headline || freelancer.title || 'Freelancer'}
              {freelancer.location && ` • 📍 ${getLocationDisplay(freelancer.location)}`}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
          <SaveButton itemId={freelancer._id} itemType="freelancer" size="sm" />
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
        {freelancer.skills?.slice(0, 5).map((s, i) => (
          <button
            key={i}
            className="browse-tag browse-tag-clickable"
            title={`Find more freelancers skilled in ${s}`}
            onClick={e => { e.stopPropagation(); navigate(`/freelancers?search=${encodeURIComponent(s)}`); }}
          >
            {s}
          </button>
        ))}
        {freelancer.skills?.length > 5 && <span className="browse-tag">+{freelancer.skills.length - 5}</span>}
        {freelancer.availabilityStatus && <AvailabilityBadge status={freelancer.availabilityStatus} />}
        {freelancer.isVerified && <span className="browse-tag primary">Verified</span>}
      </div>

      <div className="browse-card-footer">
        <span className="browse-card-stats">
          {freelancer.completedJobs || 0} jobs completed
          {freelancer.totalEarnings > 0 && ` • $${(freelancer.totalEarnings / 1000).toFixed(0)}k+ earned`}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onInvite && (
            <button className="browse-card-cta" style={{ background: '#059669' }} onClick={e => { e.stopPropagation(); onInvite(freelancer); }}>
              📩 Invite
            </button>
          )}
          <button className="browse-card-cta" onClick={e => { e.stopPropagation(); navigate(`/freelancers/${freelancer._id}`); }}>
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
};

const FreelancerDiscovery = () => {
  const { user } = useAuth();
  const { search: urlQueryString } = useLocation();
  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inviteFreelancer, setInviteFreelancer] = useState(null);

  // Pre-populate search from URL ?search= param (e.g. clicking a skill tag)
  const [search, setSearch] = useState(() => new URLSearchParams(urlQueryString).get('search') || '');
  const [filters, setFilters] = useState({
    category: 'all', workLocation: 'all', near: '', radius: '25', minRate: '', maxRate: '', availability: 'all', sortBy: 'rating'
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [viewMode, setViewMode] = useState('grid');
  const locationApplied = useRef(false);
  const userLocation = useUserLocation();

  const fetchFreelancers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 12 });
      if (search) params.set('search', search);

      const effectiveFilters = { ...filters };
      // Near/radius should only apply for local mode; otherwise it hides remote/all unexpectedly.
      if (effectiveFilters.workLocation !== 'local') {
        delete effectiveFilters.near;
        delete effectiveFilters.radius;
      }

      Object.entries(effectiveFilters).forEach(([k, v]) => {
        if (v && v !== 'all') params.set(k, v);
      });

      const data = await apiRequest(`/api/freelancers?${params}`);
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

  // Auto-fill location once detected
  useEffect(() => {
    if (locationApplied.current) return;
    if (userLocation.loading) return;
    const near = userLocation.zip || (userLocation.lat ? `${userLocation.lat},${userLocation.lon}` : '');
    if (!near) return;
    locationApplied.current = true;
    setFilters(prev => prev.near ? prev : { ...prev, near });
  }, [userLocation]);

  // Sync search box when URL ?search= changes (e.g. clicking another skill tag)
  useEffect(() => {
    const term = new URLSearchParams(urlQueryString).get('search') || '';
    setSearch(term);
    setPage(1);
  }, [urlQueryString]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const sidebar = (
    <>
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>Filters</h3>
      <FilterSelect label="Category" value={filters.category} onChange={v => updateFilter('category', v)} options={CATEGORIES} />
      {/* Work Type + location handled by pill bar above results */}
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

        {/* ── Local / Remote / All toggle ── */}
        <div className="service-location-bar">
          {[
            { value: 'all',    label: '🌐 All' },
            { value: 'local',  label: '📍 Local' },
            { value: 'remote', label: '💻 Remote' },
          ].map(opt => (
            <button
              key={opt.value}
              className={`service-loc-pill${filters.workLocation === opt.value ? ' active' : ''}`}
              onClick={() => updateFilter('workLocation', opt.value)}
            >
              {opt.label}
            </button>
          ))}
          {filters.workLocation === 'local' && (
            <div className="service-zip-bar">
              <input
                type="text"
                className="service-zip-input"
                placeholder="Zip or city (e.g. 94520)"
                value={filters.near}
                onChange={e => updateFilter('near', e.target.value)}
                maxLength={10}
              />
              <select className="service-radius-select" value={filters.radius} onChange={e => updateFilter('radius', e.target.value)}>
                {[5, 10, 25, 50, 100].map(r => <option key={r} value={String(r)}>{r} mi</option>)}
              </select>
            </div>
          )}
        </div>

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
            {freelancers.map(f => <FreelancerCard key={f._id} freelancer={f} onInvite={user ? setInviteFreelancer : null} />)}
          </div>
        )}

        <BrowsePagination current={page} total={pagination.pages || 0} onChange={setPage} />
      </BrowseLayout>

      {inviteFreelancer && (
        <InviteToJob
          freelancer={inviteFreelancer}
          onClose={() => setInviteFreelancer(null)}
        />
      )}
    </>
  );
};

export default FreelancerDiscovery;
