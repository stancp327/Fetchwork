import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { categoryOptions } from '../../utils/categories';
import { getLocationDisplay, getLocationTypeBadge } from '../../utils/location';
import SEO from '../common/SEO';
import BrowseLayout, {
  SearchBar, FilterSelect, FilterInput,
  ResultsControls, BrowsePagination, BrowseEmpty
} from '../common/BrowseLayout';
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
    <div className="browse-card" onClick={() => navigate(`/services/${service._id}`)}>
      {service.images?.[0] && (
        <div style={{
          height: 160, borderRadius: '10px 10px 0 0', margin: '-1.25rem -1.25rem 1rem',
          background: `url(${service.images[0]}) center/cover no-repeat`, width: 'calc(100% + 2.5rem)'
        }} />
      )}
      <div className="browse-card-header">
        <div>
          <h3 className="browse-card-title">{service.title}</h3>
          <div className="browse-card-meta">
            {service.seller?.firstName} {service.seller?.lastName}
            {service.seller?.rating > 0 && ` • ⭐ ${service.seller.rating.toFixed(1)}`}
          </div>
        </div>
      </div>

      <p className="browse-card-desc">{service.description}</p>

      <div className="browse-card-tags">
        {service.category && <span className="browse-tag primary">{service.category.replace(/_/g, ' ')}</span>}
        {getLocationTypeBadge(service.location) && <span className="browse-tag">{getLocationTypeBadge(service.location)}</span>}
        {service.location?.locationType !== 'remote' && service.location?.city && (
          <span className="browse-tag">📍 {getLocationDisplay(service.location)}</span>
        )}
        {service.deliveryTime && <span className="browse-tag">📦 {service.deliveryTime}</span>}
        {service.tags?.slice(0, 3).map((t, i) => <span key={i} className="browse-tag">{t}</span>)}
      </div>

      <div className="browse-card-footer">
        <span style={{ fontWeight: 700, color: '#111827' }}>
          Starting at ${service.packages?.[0]?.price || service.startingPrice || '—'}
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

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 12 });
      if (search) params.set('search', search);
      Object.entries(filters).forEach(([k, v]) => {
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

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const sidebar = (
    <>
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>Filters</h3>
      <FilterSelect label="Category" value={filters.category} onChange={v => updateFilter('category', v)} options={CATEGORIES} />
      <FilterSelect label="Work Type" value={filters.locationType} onChange={v => updateFilter('locationType', v)}
        options={[{ value: 'all', label: 'All Types' }, { value: 'remote', label: '🌐 Remote' }, { value: 'local', label: '📍 Local' }, { value: 'hybrid', label: '🔄 Hybrid' }]} />
      <FilterInput label="Near (zip or city)" value={filters.near} onChange={v => updateFilter('near', v)} placeholder="e.g. 94520 or Concord" />
      {filters.near && (
        <FilterSelect label="Distance" value={filters.radius} onChange={v => updateFilter('radius', v)}
          options={[{ value: '5', label: '5 miles' }, { value: '10', label: '10 miles' }, { value: '25', label: '25 miles' }, { value: '50', label: '50 miles' }, { value: '100', label: '100 miles' }]} />
      )}
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
          <BrowseEmpty icon="🛒" title="No services found" message="Try adjusting your search or filters" />
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
