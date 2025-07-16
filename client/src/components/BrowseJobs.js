import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from './Navigation';

const BrowseJobs = () => {
  const { token } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'web-development', label: 'Web Development' },
    { value: 'mobile-development', label: 'Mobile Development' },
    { value: 'design', label: 'Design' },
    { value: 'writing', label: 'Writing' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'photography', label: 'Photography' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    fetchJobs();
  }, [searchTerm, selectedCategory]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      if (searchTerm) queryParams.append('search', searchTerm);
      if (selectedCategory !== 'all') queryParams.append('category', selectedCategory);
      
      const response = await fetch(`/api/jobs?${queryParams.toString()}`);
      const data = await response.json();
      
      if (response.ok) {
        setJobs(data.jobs || []);
        setError('');
      } else {
        setError(data.message || 'Failed to fetch jobs');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatBudget = (budget) => {
    if (budget && budget.min && budget.max) {
      return `$${budget.min.toLocaleString()} - $${budget.max.toLocaleString()}`;
    }
    return 'Budget not specified';
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Less than an hour ago';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  const handleApply = async (jobId) => {
    if (!token) {
      alert('Please log in to apply for jobs');
      return;
    }
    
    const proposal = prompt('Enter your proposal for this job:');
    const bidAmount = prompt('Enter your bid amount (numbers only):');
    
    if (!proposal || !bidAmount) return;
    
    try {
      const response = await fetch(`/api/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          proposal,
          bidAmount: parseInt(bidAmount),
          estimatedDuration: '2-3 weeks'
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert('Application submitted successfully!');
        fetchJobs();
      } else {
        alert(result.message || 'Failed to submit application');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    }
  };


  return (
    <div>
      <Navigation />
      <div className="page-container">
        <div className="browse-jobs">
          <h1>Browse Jobs</h1>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="job-filters">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="category-filter">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="category-select"
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {loading ? (
            <div className="loading">Loading jobs...</div>
          ) : (
            <>
              <div className="jobs-list">
                {jobs.map(job => (
                  <div key={job._id} className="job-card">
                    <div className="job-header">
                      <h3>{job.title}</h3>
                      <span className="job-budget">{formatBudget(job.budget)}</span>
                    </div>
                    <p className="job-description">{job.description}</p>
                    <div className="job-details">
                      <span className="job-location">📍 {job.location || 'Remote'}</span>
                      <span className="job-category">🏷️ {job.category}</span>
                    </div>
                    {job.requiredSkills && job.requiredSkills.length > 0 && (
                      <div className="job-skills">
                        <strong>Skills:</strong> {job.requiredSkills.join(', ')}
                      </div>
                    )}
                    <div className="job-footer">
                      <span className="posted-by">Posted by {job.client?.name || 'Anonymous'}</span>
                      <span className="time-posted">{formatTimeAgo(job.createdAt)}</span>
                      <button 
                        className="apply-btn"
                        onClick={() => handleApply(job._id)}
                      >
                        Apply Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {jobs.length === 0 && !loading && (
                <div className="no-jobs">
                  <p>No jobs found matching your criteria.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrowseJobs;
