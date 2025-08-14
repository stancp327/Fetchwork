import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import SEO from '../common/SEO';
import FreelancerCard from './FreelancerCard';
import FreelancerFilterPanel from './FreelancerFilterPanel';
import Pagination from '../common/Pagination';
import '../UserComponents.css';
import { getApiBaseUrl } from '../../utils/api';

const FreelancerDiscovery = () => {
  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    skills: '',
    location: '',
    minRate: '',
    maxRate: '',
    rating: 'all',
    availability: 'all',
    sortBy: 'rating'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0
  });

  const apiBaseUrl = getApiBaseUrl();

  const fetchFreelancers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (filters.search) params.append('search', filters.search);
      if (filters.skills) params.append('skills', filters.skills);
      if (filters.location) params.append('location', filters.location);
      if (filters.minRate) params.append('minRate', filters.minRate);
      if (filters.maxRate) params.append('maxRate', filters.maxRate);
      if (filters.rating !== 'all') params.append('rating', filters.rating);
      if (filters.availability !== 'all') params.append('availability', filters.availability);
      if (filters.sortBy !== 'rating') params.append('sortBy', filters.sortBy);

      const response = await axios.get(`${apiBaseUrl}/api/freelancers?${params}`);
      setFreelancers(response.data.freelancers);
      setPagination(response.data.pagination);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch freelancers:', error);
      setError(error.response?.data?.error || 'Failed to load freelancers');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchFreelancers();
  }, [fetchFreelancers]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  if (loading) {
    return (
      <div className="user-container">
        <div className="loading">Loading freelancers...</div>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Discover Freelancers"
        description="Find skilled freelancers for your projects. Browse profiles, portfolios, and reviews to hire the perfect professional."
        keywords="hire freelancers, skilled professionals, remote workers, freelance talent"
      />
      <div className="user-container">
        <div className="user-header">
        <h1>Discover Freelancers</h1>
        <p>Find skilled professionals for your projects</p>
      </div>

      <FreelancerFilterPanel filters={filters} onFilterChange={handleFilterChange} />

      {error && <div className="error">{error}</div>}

      <div className="main-content">
        <div className="section-title">
          {pagination.total} Freelancers Found
        </div>

        {freelancers.length === 0 ? (
          <div className="empty-state">
            <h3>No freelancers found</h3>
            <p>Try adjusting your search criteria or filters</p>
          </div>
        ) : (
          <>
            <div className="freelancer-grid">
              {freelancers.map((freelancer) => (
                <FreelancerCard key={freelancer._id} freelancer={freelancer} />
              ))}
            </div>

            <Pagination pagination={pagination} onPageChange={handlePageChange} />
          </>
        )}
      </div>
    </div>
    </>
  );
};

export default FreelancerDiscovery;
