import React, { useState, useEffect } from 'react';
import './Jobs.css';

const LocalJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    city: '',
    state: '',
    budgetRange: 'all',
    experienceLevel: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const localCategories = [
    'all',
    'Home Improvement',
    'Cleaning',
    'Moving',
    'Tutoring',
    'Personal Care',
    'Event Services',
    'Automotive',
    'Pet Services'
  ];

  const budgetRanges = [
    'all',
    'Under $100',
    '$100 - $500',
    '$500 - $1,000',
    '$1,000+'
  ];

  const experienceLevels = ['all', 'entry', 'intermediate', 'expert'];

  useEffect(() => {
    fetchJobs();
  }, [filters, currentPage]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:10000'
        : 'https://user:31bfdb3e3b3497d64ac61e2dd563996c@fetchwork-verification-app-tunnel-guxp61eo.devinapps.com';

      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        locationType: 'local'
      });

      if (filters.search) params.append('search', filters.search);
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.city) params.append('city', filters.city);
      if (filters.state) params.append('state', filters.state);
      if (filters.experienceLevel !== 'all') params.append('experienceLevel', filters.experienceLevel);

      if (filters.budgetRange !== 'all') {
        switch (filters.budgetRange) {
          case 'Under $100':
            params.append('maxBudget', '100');
            break;
          case '$100 - $500':
            params.append('minBudget', '100');
            params.append('maxBudget', '500');
            break;
          case '$500 - $1,000':
            params.append('minBudget', '500');
            params.append('maxBudget', '1000');
            break;
          case '$1,000+':
            params.append('minBudget', '1000');
            break;
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/jobs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching local jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
    setCurrentPage(1);
  };

  const formatBudget = (budget) => {
    if (budget.type === 'fixed') {
      return `$${budget.amount} (Fixed)`;
    } else {
      return `$${budget.amount}/hr`;
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const posted = new Date(date);
    const diffInHours = Math.floor((now - posted) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just posted';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  return (
    <div className="browse-jobs local-jobs">
      <div className="jobs-header">
        <h1>Local Jobs & Services</h1>
        <p>Find local service providers in your area</p>
      </div>

      <div className="jobs-filters">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search local jobs..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-row">
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="filter-select"
          >
            {localCategories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="City"
            value={filters.city}
            onChange={(e) => handleFilterChange('city', e.target.value)}
            className="filter-input"
          />

          <input
            type="text"
            placeholder="State"
            value={filters.state}
            onChange={(e) => handleFilterChange('state', e.target.value)}
            className="filter-input"
          />

          <select
            value={filters.budgetRange}
            onChange={(e) => handleFilterChange('budgetRange', e.target.value)}
            className="filter-select"
          >
            {budgetRanges.map(range => (
              <option key={range} value={range}>
                {range === 'all' ? 'All Budgets' : range}
              </option>
            ))}
          </select>

          <select
            value={filters.experienceLevel}
            onChange={(e) => handleFilterChange('experienceLevel', e.target.value)}
            className="filter-select"
          >
            {experienceLevels.map(level => (
              <option key={level} value={level}>
                {level === 'all' ? 'All Experience' : level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="jobs-content">
        {loading ? (
          <div className="loading">Loading local jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="no-jobs">
            <h3>No local jobs found</h3>
            <p>Try adjusting your search criteria or check back later for new opportunities.</p>
          </div>
        ) : (
          <>
            <div className="jobs-list">
              {jobs.map(job => (
                <div key={job._id} className="job-card local-job-card">
                  <div className="job-header">
                    <h3 className="job-title">{job.title}</h3>
                    <div className="job-budget">{formatBudget(job.budget)}</div>
                  </div>
                  
                  <p className="job-description">{job.description}</p>
                  
                  {job.location && (job.location.city || job.location.state) && (
                    <div className="job-location">
                      📍 {job.location.city}{job.location.city && job.location.state ? ', ' : ''}{job.location.state}
                    </div>
                  )}
                  
                  <div className="job-skills">
                    {job.skills.map(skill => (
                      <span key={skill} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                  
                  <div className="job-meta">
                    <span className="job-category">{job.category}</span>
                    <span>•</span>
                    <span className="job-experience">{job.experienceLevel}</span>
                    <span>•</span>
                    <span className="job-time">{formatTimeAgo(job.createdAt)}</span>
                  </div>
                  
                  <div className="job-actions">
                    <button className="apply-btn">Apply Now</button>
                    <button className="save-btn">Save</button>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  Previous
                </button>
                
                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>
                
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
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

export default LocalJobs;
