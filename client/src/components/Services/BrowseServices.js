import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { categoryOptions } from '../../utils/categories';
import { getLocationDisplay } from '../../utils/location';
import SEO from '../common/SEO';
import BrowseLayout, {
  SearchBar, FilterSelect, FilterInput,
  ResultsControls, BrowsePagination, BrowseEmpty
} from '../common/BrowseLayout';
import SaveButton from '../common/SaveButton';
import Avatar from '../common/Avatar';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useZipLookup } from '../../hooks/useZipLookup';
import '../common/BrowseLayout.css';

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  ...categoryOptions
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
];

const ServiceCard = ({ service }) => {
  const navigate = useNavigate();

  return (
    <div className="browse-card" onClick={() => navigate(`/services/${service._id}`)} style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 1 }}>
        <SaveButton itemId={service._id} itemType="service" size="sm" />
      </div>
      {service.images?.[0] && (
        <div style={{
          height: 160, borderRadius: '10px 10px 0 0', margin: '-1.25rem -1.25rem 1rem',
          background: `url(${service.images[0]}) center/cover no-repeat`, width: 'calc(100% + 2.5rem)'
        }} />
      )}
      <div className="browse-card-header" style={{ paddingRight: '2rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <a href={"/freelancers/" + ((service.freelancer || service.seller)?.username || (service.freelancer || service.seller)?._id)} onClick={e => e.stopPropagation()} className="card-avatar-link" style={{ display: 'flex', flexShrink: 0 }}>
          <Avatar user={service.freelancer || service.seller} size={36} style={{ marginTop: 2 }} />
        </a>
        <div>
          <h3 className="browse-card-title">{service.title}</h3>
          <div className="browse-card-meta">
            {service.freelancer?.firstName || service.seller?.firstName} {service.freelancer?.lastName || service.seller?.lastName}
            {(service.freelancer?.rating || service.seller?.rating) > 0 && ` • ⭐ ${(service.freelancer?.rating || service.seller?.rating).toFixed(1)}`}
          </div>
        </div>
      </div>

      <p className="browse-card-desc">{service.description}</p>

      <div className="browse-card-tags">
        {service.category && <span className="browse-tag primary">{service.category.replace(/_/g, ' ')}</span>}
        {service.serviceType === 'recurring' && (
          <span className="browse-tag" style={{ background: '#dcfce7', color: '#166534', fontWeight: 600 }}>🔄 Recurring</span>
        )}
        {service.serviceType !== 'recurring' && (!service.location || service.location?.locationType === 'remote') ? (
          <span className="browse-tag" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 600 }}>🌐 Remote</span>
        ) : service.serviceType !== 'recurring' ? (
          <span className="browse-tag" style={{ background: '#ecfdf5', color: '#059669', fontWeight: 600 }}>📍 {getLocationDisplay(service.location)}</span>
        ) : null}
        {service.serviceType === 'recurring' && service.recurring?.locationType && (
          <span className="browse-tag" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 500 }}>
            {service.recurring.locationType === 'online' ? '💻 Online' : service.recurring.locationType === 'in_person' ? '📍 In-Person' : '🔀 Online & In-Person'}
          </span>
        )}
        {service.serviceType === 'recurring' && service.recurring?.sessionDuration && (
          <span className="browse-tag" style={{ background: '#fefce8', color: '#a16207', fontWeight: 500 }}>
            ⏱ {service.recurring.sessionDuration < 60 ? `${service.recurring.sessionDuration} min` : `${service.recurring.sessionDuration / 60} hr`} sessions
          </span>
        )}
        {service.serviceType !== 'recurring' && service.pricing?.basic?.deliveryTime && (
          <span className="browse-tag" style={{ background: '#fefce8', color: '#a16207', fontWeight: 500 }}>
            ⏱️ {service.pricing.basic.deliveryTime} day{service.pricing.basic.deliveryTime > 1 ? 's' : ''} turnaround
          </span>
        )}
        {service.tags?.slice(0, 3).map((t, i) => <span key={i} className="browse-tag">{t}</span>)}
      </div>

      <div className="browse-card-footer">
        <span style={{ fontWeight: 700, color: '#111827' }}>
          {service.serviceType === 'recurring'
            ? `$${service.pricing?.basic?.price || '—'} / ${service.recurring?.billingCycle === 'per_session' ? 'session' : service.recurring?.billingCycle === 'weekly' ? 'week' : 'month'}`
            : `Starting at $${service.pricing?.basic?.price || service.packages?.[0]?.price || service.startingPrice || '—'}`
          }
        </span>
        <button className="browse-card-cta" onClick={e => { e.stopPropagation(); navigate(`/services/${service._id}`); }}>
          View Service
        </button>
      </div>
    </div>
  );
};

const BrowseServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    category: 'all', locationType: 'all', near: '', radius: '25', minPrice: '', maxPrice: '', deliveryTime: 'all', sortBy: 'newest'
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [viewMode, setViewMode] = useState('grid');
  const locationApplied = useRef(false);
  const userLocation = useUserLocation();
  const zipLookup = useZipLookup(filters.near);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 12 });
      if (search) params.set('search', search);

      const effectiveFilters = { ...filters };
      // Near/radius should only apply for local mode; otherwise it hides remote/all unexpectedly.
      if (effectiveFilters.locationType !== 'local') {
        delete effectiveFilters.near;
        delete effectiveFilters.radius;
      }

      Object.entries(effectiveFilters).forEach(([k, v]) => {
        if (v && v !== 'all') params.set(k, v);
      });

      const data = await apiRequest(`/api/services?${params}`);
      setServices(data.services || []);
      setPagination(data.pagination || {});
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, filters, page]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  // Auto-fill location once detected — only if user hasn't typed a location yet
  useEffect(() => {
    if (locationApplied.current) return;
    if (userLocation.loading) return;
    const near = userLocation.zip || (userLocation.lat ? `${userLocation.lat},${userLocation.lon}` : '');
    if (!near) return;
    locationApplied.current = true;
    setFilters(prev => prev.near ? prev : { ...prev, near });
  }, [userLocation]);

  const updateFilter = (key, value) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: value };
      // Reset near/radius when switching away from local, to avoid stale location data affecting All/Remote.
      if (key === 'locationType' && value !== 'local') {
        updated.near = '';
        updated.radius = '25';
      }
      return updated;
    });
    setPage(1);
  };

  const sidebar = (
    <>
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>Filters</h3>
      <FilterSelect label="Category" value={filters.category} onChange={v => updateFilter('category', v)} options={CATEGORIES} />
      {/* Work Type + location handled by pill bar above results */}
      <FilterInput label="Min Price" value={filters.minPrice} onChange={v => updateFilter('minPrice', v)} placeholder="$0" type="number" />
      <FilterInput label="Max Price" value={filters.maxPrice} onChange={v => updateFilter('maxPrice', v)} placeholder="No limit" type="number" />
      <FilterSelect label="Delivery Time" value={filters.deliveryTime} onChange={v => updateFilter('deliveryTime', v)}
        options={[
          { value: 'all', label: 'Any' },
          { value: '1_day', label: '24 Hours' },
          { value: '3_days', label: 'Up to 3 Days' },
          { value: '7_days', label: 'Up to 7 Days' },
          { value: '14_days', label: 'Up to 2 Weeks' },
          { value: '30_days', label: 'Up to 1 Month' },
        ]} />
    </>
  );

  return (
    <>
      <SEO title="Browse Services" description="Find ready-made freelance services." />
      <BrowseLayout
        title="Browse Services"
        subtitle="Find ready-made solutions from skilled freelancers"
        sidebar={sidebar}
      >
        <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search services, keywords, or categories..." />

        {/* ── Local / Remote / All toggle ── */}
        <div className="service-location-bar">
          {[
            { value: 'all',    label: '🌐 All' },
            { value: 'local',  label: '📍 Local' },
            { value: 'remote', label: '💻 Remote' },
          ].map(opt => (
            <button
              key={opt.value}
              className={`service-loc-pill${filters.locationType === opt.value ? ' active' : ''}`}
              onClick={() => updateFilter('locationType', opt.value)}
            >
              {opt.label}
            </button>
          ))}

          {/* Zip + radius inline when Local selected */}
          {filters.locationType === 'local' && (
            <div className="service-zip-bar">
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className={`service-zip-input${zipLookup.error ? ' zip-error' : zipLookup.result ? ' zip-ok' : ''}`}
                  placeholder="Zip or city (e.g. 94520)"
                  value={filters.near}
                  onChange={e => updateFilter('near', e.target.value)}
                  maxLength={10}
                />
                {zipLookup.result && (
                  <span className="zip-city-hint">📍 {zipLookup.result.city}, {zipLookup.result.state}</span>
                )}
                {zipLookup.error && (
                  <span className="zip-city-hint zip-city-hint--error">✕ {zipLookup.error}</span>
                )}
              </div>
              <select
                className="service-radius-select"
                value={filters.radius}
                onChange={e => updateFilter('radius', e.target.value)}
              >
                {[5, 10, 25, 50, 100].map(r => (
                  <option key={r} value={String(r)}>{r} mi</option>
                ))}
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
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="browse-card" style={{ height: 240, background: '#f9fafb' }} />)}
          </div>
        ) : error ? (
          <BrowseEmpty icon="⚠️" title="Error loading services" message={error} />
        ) : services.length === 0 ? (
          <BrowseEmpty
            icon="🛒"
            title="No services listed yet"
            message="No services listed yet. Browse our freelancers or post a job to get started."
            suggestions={[
              'Browse available freelancers',
              'Post a job to receive custom proposals',
              'Check back soon - services added daily'
            ]}
            action={
              <a href="/freelancers" className="browse-card-cta" style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none' }}>
                Browse Freelancers
              </a>
            }
          />
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="/freelancers" className="browse-card-cta" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Browse Freelancers
            </a>
            <a href="/create-service" className="browse-card-cta" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Offer a Service
            </a>
          </div>
                Offer a Service →
              </a>
            }
          />
        ) : (
          <div className={`browse-grid ${viewMode === 'grid' ? 'grid-view' : 'list-view'}`}>
            {services.map(s => <ServiceCard key={s._id} service={s} />)}
          </div>
        )}

        <BrowsePagination current={page} total={pagination.pages || 0} onChange={setPage} />
      </BrowseLayout>
    </>
  );
};

export default BrowseServices;
