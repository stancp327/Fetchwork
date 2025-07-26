import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import JobCard from './JobCard';
import FilterPanel from './FilterPanel';
import Pagination from '../common/Pagination';
import '../UserComponents.css';

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://fetchwork-1.onrender.com';
};

const BrowseJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    experienceLevel: 'all',
    duration: 'all',
    minBudget: '',
    maxBudget: '',
    workLocation: 'all',
    specificLocation: '',
    jobType: 'all',
    datePosted: 'all',
    sortBy: 'newest',
    urgentOnly: false,
    featuredOnly: false
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  const apiBaseUrl = getApiBaseUrl();

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (filters.search) params.append('search', filters.search);
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.experienceLevel !== 'all') params.append('experienceLevel', filters.experienceLevel);
      if (filters.duration !== 'all') params.append('duration', filters.duration);
      if (filters.minBudget) params.append('minBudget', filters.minBudget);
      if (filters.maxBudget) params.append('maxBudget', filters.maxBudget);
      if (filters.workLocation !== 'all') params.append('workLocation', filters.workLocation);
      if (filters.specificLocation) params.append('specificLocation', filters.specificLocation);
      if (filters.jobType !== 'all') params.append('jobType', filters.jobType);
      if (filters.datePosted !== 'all') params.append('datePosted', filters.datePosted);
      if (filters.sortBy !== 'newest') params.append('sortBy', filters.sortBy);
      if (filters.urgentOnly) params.append('urgentOnly', 'true');
      if (filters.featuredOnly) params.append('featuredOnly', 'true');

      const response = await axios.get(`${apiBaseUrl}/api/jobs?${params}`);
      setJobs(response.data.jobs);
      setPagination(response.data.pagination);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      setError(error.response?.data?.error || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

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
        <div className="loading">Loading jobs...</div>
      </div>
    );
  }

  return (
    <div className="user-container">
      <div className="user-header">
        <h1>Browse Jobs</h1>
        <p>Find your next freelance opportunity</p>
      </div>

      <FilterPanel filters={filters} onFilterChange={handleFilterChange} />

      {error && <div className="error">{error}</div>}

      <div className="main-content">
        <div className="section-title">
          {pagination.total} Jobs Found
        </div>

        {jobs.length === 0 ? (
          <div className="empty-state">
            <h3>No jobs found</h3>
            <p>Try adjusting your search criteria or filters</p>
          </div>
        ) : (
          <>
            {jobs.map((job) => (
              <JobCard key={job._id} job={job} />
            ))}

            <Pagination pagination={pagination} onPageChange={handlePageChange} />
          </>
        )}
      </div>
    </div>
  );
};

export default BrowseJobs;
