import React, { useState, useEffect, useCallback } from 'react';
import './Search.css';

const UniversalSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('jobs');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: 'all',
    budgetRange: 'all',
    experienceLevel: 'all',
    skills: '',
    location: '',
    locationType: 'all'
  });

  const fetchResults = useCallback(async () => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:10000'
        : 'https://user:31bfdb3e3b3497d64ac61e2dd563996c@fetchwork-verification-app-tunnel-guxp61eo.devinapps.com';

      const params = new URLSearchParams();
      params.append('search', searchTerm);

      if (searchType === 'jobs') {
        if (filters.category !== 'all') params.append('category', filters.category);
        if (filters.experienceLevel !== 'all') params.append('experienceLevel', filters.experienceLevel);
        if (filters.locationType !== 'all') params.append('locationType', filters.locationType);
        
        if (filters.budgetRange !== 'all') {
          switch (filters.budgetRange) {
            case 'Under $500':
              params.append('maxBudget', '500');
              break;
            case '$500 - $1,000':
              params.append('minBudget', '500');
              params.append('maxBudget', '1000');
              break;
            case '$1,000 - $3,000':
              params.append('minBudget', '1000');
              params.append('maxBudget', '3000');
              break;
            case '$3,000+':
              params.append('minBudget', '3000');
              break;
          }
        }

        const response = await fetch(`${API_BASE_URL}/api/jobs?${params}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.jobs || []);
        }
      } else if (searchType === 'users') {
        if (filters.skills) params.append('skills', filters.skills);
        if (filters.location) params.append('location', filters.location);

        const response = await fetch(`${API_BASE_URL}/api/users/search?${params}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.users || []);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, searchType, filters]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchResults();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [fetchResults]);

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
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

  const categories = ['all', 'Web Development', 'Mobile Development', 'Design', 'Writing', 'Data Science', 'Marketing', 'Video & Animation', 'Music & Audio', 'Programming & Tech', 'Business'];
  const budgetRanges = ['all', 'Under $500', '$500 - $1,000', '$1,000 - $3,000', '$3,000+'];
  const experienceLevels = ['all', 'entry', 'intermediate', 'expert'];

  return (
    <div className="universal-search">
      <div className="search-header">
        <h1>Universal Search</h1>
        <p>Search for jobs, freelancers, and opportunities</p>
      </div>

      <div className="search-controls">
        <div className="search-type-tabs">
          <button 
            className={`tab-btn ${searchType === 'jobs' ? 'active' : ''}`}
            onClick={() => setSearchType('jobs')}
          >
            Jobs
          </button>
          <button 
            className={`tab-btn ${searchType === 'users' ? 'active' : ''}`}
            onClick={() => setSearchType('users')}
          >
            Freelancers
          </button>
        </div>

        <div className="search-input-container">
          <input
            type="text"
            placeholder={`Search ${searchType}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="universal-search-input"
          />
        </div>

        <div className="search-filters">
          {searchType === 'jobs' && (
            <>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="filter-select"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>

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
                    {level === 'all' ? 'All Experience Levels' : level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>

              <select
                value={filters.locationType}
                onChange={(e) => handleFilterChange('locationType', e.target.value)}
                className="filter-select"
              >
                <option value="all">All Types</option>
                <option value="remote">Remote</option>
                <option value="local">Local</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </>
          )}

          {searchType === 'users' && (
            <>
              <input
                type="text"
                placeholder="Skills (e.g. React, Node.js)"
                value={filters.skills}
                onChange={(e) => handleFilterChange('skills', e.target.value)}
                className="filter-input"
              />
              <input
                type="text"
                placeholder="Location"
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="filter-input"
              />
            </>
          )}
        </div>
      </div>

      <div className="search-results">
        {loading && <div className="loading">Searching...</div>}
        
        {!loading && searchTerm && results.length === 0 && (
          <div className="no-results">
            <h3>No {searchType} found</h3>
            <p>Try adjusting your search terms or filters.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="results-list">
            {searchType === 'jobs' ? (
              results.map(job => (
                <div key={job._id} className="result-card job-result">
                  <div className="result-header">
                    <h3 className="result-title">{job.title}</h3>
                    <div className="result-budget">{formatBudget(job.budget)}</div>
                  </div>
                  
                  <p className="result-description">{job.description}</p>
                  
                  <div className="result-skills">
                    {job.skills.map(skill => (
                      <span key={skill} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                  
                  <div className="result-meta">
                    <span className="result-category">{job.category}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(job.createdAt)}</span>
                  </div>
                </div>
              ))
            ) : (
              results.map(user => (
                <div key={user._id} className="result-card user-result">
                  <div className="result-header">
                    <h3 className="result-title">
                      {user.profile?.firstName} {user.profile?.lastName}
                    </h3>
                    <div className="result-rate">
                      ${user.profile?.hourlyRate || 'N/A'}/hr
                    </div>
                  </div>
                  
                  <p className="result-description">{user.profile?.bio}</p>
                  
                  <div className="result-skills">
                    {user.profile?.skills?.map(skill => (
                      <span key={skill} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                  
                  <div className="result-meta">
                    <span className="result-location">{user.profile?.location}</span>
                    <span>•</span>
                    <span>{user.userType}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UniversalSearch;
