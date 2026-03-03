import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';

const AgencyCard = ({ agency }) => (
  <Link to={`/agency/${agency.slug}`} className="agency-card" style={{
    display: 'block', textDecoration: 'none', color: 'inherit',
    border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem',
    background: '#fff', transition: 'box-shadow 0.2s',
  }}>
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
      {agency.logo ? (
        <img src={agency.logo} alt={agency.name} style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover' }} />
      ) : (
        <div style={{ width: 56, height: 56, borderRadius: 10, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700, color: '#4f46e5' }}>
          {agency.name?.[0] || 'A'}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{agency.name}</h3>
        {agency.description && (
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agency.description}
          </p>
        )}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#9ca3af' }}>
          <span>👥 {agency.memberCount || 0} members</span>
          {agency.specialties?.length > 0 && (
            <span>🏷️ {agency.specialties.slice(0, 3).join(', ')}</span>
          )}
          {agency.website && <span>🌐 Website</span>}
        </div>
      </div>
    </div>
  </Link>
);

const AgencyDirectory = () => {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadAgencies = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 12 });
      if (search.trim()) params.set('search', search.trim());

      const data = await apiRequest(`/api/teams/agencies/public?${params}`);
      setAgencies(data.agencies || []);
      setTotalPages(data.pages || 1);
    } catch (err) {
      console.error('Failed to load agencies:', err);
      setAgencies([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadAgencies(); }, [loadAgencies]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadAgencies();
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <SEO title="Agency Directory — FetchWork" description="Browse professional agencies and teams on FetchWork" />

      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.5rem' }}>Agency Directory</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
        Browse verified agencies and teams offering professional services.
      </p>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agencies by name or specialty..."
          style={{ flex: 1, padding: '0.6rem 1rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}
        />
        <button type="submit" style={{ padding: '0.6rem 1.2rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
          Search
        </button>
      </form>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading agencies…</div>
      ) : agencies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          <p style={{ fontSize: '1.1rem' }}>No agencies found</p>
          <p style={{ fontSize: '0.85rem' }}>Try adjusting your search or check back later.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {agencies.map(a => <AgencyCard key={a._id} agency={a} />)}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                style={{ padding: '0.4rem 0.8rem', border: '1px solid #d1d5db', borderRadius: 6, background: page <= 1 ? '#f3f4f6' : '#fff', cursor: page <= 1 ? 'default' : 'pointer' }}>
                ← Prev
              </button>
              <span style={{ padding: '0.4rem 0.8rem', color: '#6b7280', fontSize: '0.85rem' }}>
                Page {page} of {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                style={{ padding: '0.4rem 0.8rem', border: '1px solid #d1d5db', borderRadius: 6, background: page >= totalPages ? '#f3f4f6' : '#fff', cursor: page >= totalPages ? 'default' : 'pointer' }}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AgencyDirectory;
