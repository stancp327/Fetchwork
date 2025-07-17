import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './Jobs.css';

const BrowseJobs = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [budgetRange, setBudgetRange] = useState('all');
  const [experienceLevel, setExperienceLevel] = useState('all');
  const [locationType, setLocationType] = useState('all');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:10000'
        : 'https://user:31bfdb3e3b3497d64ac61e2dd563996c@fetchwork-verification-app-tunnel-guxp61eo.devinapps.com';

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (experienceLevel !== 'all') params.append('experienceLevel', experienceLevel);
      if (locationType !== 'all') params.append('locationType', locationType);
      
      if (budgetRange !== 'all') {
        switch (budgetRange) {
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
      
      params.append('page', currentPage);
      params.append('limit', '10');

      const response = await fetch(`${API_BASE_URL}/api/jobs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
        setTotalPages(data.totalPages || 1);
      } else {
        console.error('Failed to fetch jobs');
        setJobs([]);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory, budgetRange, experienceLevel, locationType, currentPage]);

  const debouncedSearchTerm = useMemo(() => {
    const timeoutId = setTimeout(() => searchTerm, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchTerm, selectedCategory, budgetRange, experienceLevel, locationType]);


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

  const filteredJobs = jobs;

  return (
    <div className="browse-jobs">
      <div className="jobs-header">
        <h1>Browse Jobs</h1>
        <p>Find your next opportunity from {jobs.length} available projects</p>
      </div>

      <div className="jobs-filters">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search jobs by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-row">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>

          <select
            value={budgetRange}
            onChange={(e) => setBudgetRange(e.target.value)}
            className="filter-select"
          >
            {budgetRanges.map(range => (
              <option key={range} value={range}>
                {range === 'all' ? 'All Budgets' : range}
              </option>
            ))}
          </select>

          <select
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            className="filter-select"
          >
            {experienceLevels.map(level => (
              <option key={level} value={level}>
                {level === 'all' ? 'All Experience Levels' : level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={locationType}
            onChange={(e) => setLocationType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="remote">Remote</option>
            <option value="local">Local</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
      </div>

      <div className="jobs-list">
        {loading ? (
          <div className="loading">Loading jobs...</div>
        ) : (
          filteredJobs.map(job => (
            <div key={job._id} className="job-card">
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
                <div className="job-client">
                  <strong>Client:</strong> {job.client?.profile?.firstName || 'Anonymous'} {job.client?.profile?.lastName || ''}
                </div>
                <div className="job-stats">
                  <span>{job.applications?.length || 0} proposals</span>
                  <span>•</span>
                  <span>{formatTimeAgo(job.createdAt)}</span>
                </div>
              </div>
              
              <div className="job-actions">
                <button className="apply-btn">Apply Now</button>
                <button className="save-btn">Save Job</button>
              </div>
            </div>
          ))
        )}
      </div>

      {filteredJobs.length === 0 && !loading && (
        <div className="no-jobs">
          <h3>No jobs found</h3>
          <p>Try adjusting your search criteria or check back later for new opportunities.</p>
        </div>
      )}

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
    </div>
  );
};

export default BrowseJobs;
