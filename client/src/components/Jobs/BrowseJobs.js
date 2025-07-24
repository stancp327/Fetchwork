import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../UserComponents.css';

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://fetchwork-1.onrender.com';
};

const BrowseJobs = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    experienceLevel: 'all',
    duration: 'all',
    minBudget: '',
    maxBudget: ''
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

  const formatBudget = (budget) => {
    return `$${budget.amount.toLocaleString()} ${budget.type === 'hourly' ? '/hr' : 'fixed'}`;
  };

  const formatDuration = (duration) => {
    const durationMap = {
      'less_than_1_week': 'Less than 1 week',
      '1_2_weeks': '1-2 weeks',
      '1_month': '1 month',
      '2_3_months': '2-3 months',
      '3_6_months': '3-6 months',
      'more_than_6_months': 'More than 6 months'
    };
    return durationMap[duration] || duration;
  };

  const formatCategory = (category) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatJobStatus = (status) => {
    const statusMap = {
      'draft': 'Draft',
      'open': 'Open',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'disputed': 'Disputed'
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status) => {
    const statusClasses = {
      'draft': 'status-tag draft',
      'open': 'status-tag open',
      'in_progress': 'status-tag in-progress',
      'completed': 'status-tag completed',
      'cancelled': 'status-tag cancelled',
      'disputed': 'status-tag disputed'
    };
    return statusClasses[status] || 'status-tag';
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

      <div className="filters">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search jobs, skills, or keywords..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Category</label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="web_development">Web Development</option>
            <option value="mobile_development">Mobile Development</option>
            <option value="design">Design</option>
            <option value="writing">Writing</option>
            <option value="marketing">Marketing</option>
            <option value="data_entry">Data Entry</option>
            <option value="customer_service">Customer Service</option>
            <option value="translation">Translation</option>
            <option value="video_editing">Video Editing</option>
            <option value="photography">Photography</option>
            <option value="consulting">Consulting</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Experience Level</label>
          <select
            value={filters.experienceLevel}
            onChange={(e) => handleFilterChange('experienceLevel', e.target.value)}
          >
            <option value="all">All Levels</option>
            <option value="entry">Entry Level</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Duration</label>
          <select
            value={filters.duration}
            onChange={(e) => handleFilterChange('duration', e.target.value)}
          >
            <option value="all">Any Duration</option>
            <option value="less_than_1_week">Less than 1 week</option>
            <option value="1_2_weeks">1-2 weeks</option>
            <option value="1_month">1 month</option>
            <option value="2_3_months">2-3 months</option>
            <option value="3_6_months">3-6 months</option>
            <option value="more_than_6_months">More than 6 months</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Min Budget</label>
          <input
            type="number"
            placeholder="$0"
            value={filters.minBudget}
            onChange={(e) => handleFilterChange('minBudget', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Max Budget</label>
          <input
            type="number"
            placeholder="No limit"
            value={filters.maxBudget}
            onChange={(e) => handleFilterChange('maxBudget', e.target.value)}
          />
        </div>
      </div>

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
              <div key={job._id} className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">{job.title}</h3>
                    <div className="card-meta">
                      Posted by {job.client.firstName} {job.client.lastName} • {formatBudget(job.budget)} • {formatDuration(job.duration)}
                    </div>
                  </div>
                  <div className="tags">
                    <span className={getStatusClass(job.status)}>{formatJobStatus(job.status)}</span>
                    <span className="tag primary">{formatCategory(job.category)}</span>
                    <span className="tag">{job.experienceLevel}</span>
                    {job.isUrgent && <span className="tag warning">Urgent</span>}
                    {job.isFeatured && <span className="tag success">Featured</span>}
                  </div>
                </div>

                <div className="card-content">
                  <p>{job.description.substring(0, 300)}{job.description.length > 300 ? '...' : ''}</p>
                  
                  {job.skills && job.skills.length > 0 && (
                    <div className="tags">
                      {job.skills.slice(0, 5).map((skill, index) => (
                        <span key={index} className="tag">{skill}</span>
                      ))}
                      {job.skills.length > 5 && <span className="tag">+{job.skills.length - 5} more</span>}
                    </div>
                  )}
                </div>

                <div className="card-footer">
                  <div className="card-meta">
                    {job.proposalCount} proposals • {job.views} views • {job.location}
                  </div>
                  <button 
                    onClick={() => navigate(`/jobs/${job._id}`)}
                    className="btn btn-primary"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}

            {pagination.pages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  Previous
                </button>
                
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={pagination.page === page ? 'active' : ''}
                    >
                      {page}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BrowseJobs;
