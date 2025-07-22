import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../UserComponents.css';

const JobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [proposal, setProposal] = useState({
    coverLetter: '',
    proposedBudget: '',
    proposedDuration: '',
    attachments: []
  });

  const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://fetchwork-1.onrender.com' 
    : 'http://localhost:10000';

  useEffect(() => {
    fetchJobDetails();
  }, [id]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/jobs/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch job details');
      }

      const data = await response.json();
      setJob(data.job);
    } catch (error) {
      console.error('Error fetching job details:', error);
      setError('Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    
    if (!proposal.coverLetter || !proposal.proposedBudget || !proposal.proposedDuration) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setApplying(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/jobs/${id}/proposals`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(proposal)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit proposal');
      }

      alert('Proposal submitted successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting proposal:', error);
      setError(error.message);
    } finally {
      setApplying(false);
    }
  };

  const formatBudget = (budget) => {
    if (typeof budget === 'object' && budget.amount) {
      return `$${budget.amount.toLocaleString()} ${budget.type || 'fixed'}`;
    }
    return `$${budget}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="user-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="user-container">
        <div className="error-state">
          <h2>Error Loading Job</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/browse-jobs')} className="btn btn-primary">
            Back to Browse Jobs
          </button>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="user-container">
        <div className="error-state">
          <h2>Job Not Found</h2>
          <p>The job you're looking for doesn't exist or has been removed.</p>
          <button onClick={() => navigate('/browse-jobs')} className="btn btn-primary">
            Back to Browse Jobs
          </button>
        </div>
      </div>
    );
  }

  const isOwnJob = user && job.client && job.client._id === user._id;
  const hasApplied = job.proposals && job.proposals.some(p => p.freelancer._id === user._id);

  return (
    <div className="user-container">
      <div className="job-details">
        <div className="job-header">
          <button onClick={() => navigate('/browse-jobs')} className="back-button">
            ← Back to Jobs
          </button>
          <div className="job-meta">
            <span className="job-category">{job.category}</span>
            <span className="job-posted">Posted {formatDate(job.createdAt)}</span>
          </div>
        </div>

        <div className="job-content">
          <div className="job-main">
            <h1 className="job-title">{job.title}</h1>
            
            <div className="job-overview">
              <div className="job-stat">
                <span className="stat-label">Budget</span>
                <span className="stat-value">{formatBudget(job.budget)}</span>
              </div>
              <div className="job-stat">
                <span className="stat-label">Duration</span>
                <span className="stat-value">{job.duration}</span>
              </div>
              <div className="job-stat">
                <span className="stat-label">Experience Level</span>
                <span className="stat-value">{job.experienceLevel}</span>
              </div>
              <div className="job-stat">
                <span className="stat-label">Proposals</span>
                <span className="stat-value">{job.proposals?.length || 0}</span>
              </div>
            </div>

            <div className="job-description">
              <h3>Job Description</h3>
              <div className="description-content">
                {job.description.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>

            {job.skills && job.skills.length > 0 && (
              <div className="job-skills">
                <h3>Required Skills</h3>
                <div className="skills-list">
                  {job.skills.map((skill, index) => (
                    <span key={index} className="skill-tag">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="job-details-info">
              <div className="info-item">
                <strong>Location:</strong> {job.location || 'Remote'}
              </div>
              {job.isUrgent && (
                <div className="info-item urgent">
                  <strong>🔥 Urgent Project</strong>
                </div>
              )}
            </div>
          </div>

          <div className="job-sidebar">
            <div className="client-info">
              <h3>About the Client</h3>
              <div className="client-details">
                <div className="client-name">
                  {job.client.firstName} {job.client.lastName}
                </div>
                <div className="client-stats">
                  <div className="client-stat">
                    <span>⭐ {job.client.rating || 'No rating'}</span>
                  </div>
                  <div className="client-stat">
                    <span>📋 {job.client.totalJobs || 0} jobs posted</span>
                  </div>
                  {job.client.memberSince && (
                    <div className="client-stat">
                      <span>📅 Member since {formatDate(job.client.memberSince)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!isOwnJob && job.status === 'open' && (
              <div className="apply-section">
                {hasApplied ? (
                  <div className="already-applied">
                    <h3>✅ Application Submitted</h3>
                    <p>You have already submitted a proposal for this job.</p>
                  </div>
                ) : (
                  <div className="apply-form">
                    <h3>Submit a Proposal</h3>
                    <form onSubmit={handleApply}>
                      <div className="form-group">
                        <label htmlFor="coverLetter">Cover Letter *</label>
                        <textarea
                          id="coverLetter"
                          value={proposal.coverLetter}
                          onChange={(e) => setProposal({...proposal, coverLetter: e.target.value})}
                          placeholder="Explain why you're the best fit for this project..."
                          rows="6"
                          required
                        />
                      </div>
                      
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="proposedBudget">Your Bid ($) *</label>
                          <input
                            type="number"
                            id="proposedBudget"
                            value={proposal.proposedBudget}
                            onChange={(e) => setProposal({...proposal, proposedBudget: e.target.value})}
                            placeholder="0"
                            min="1"
                            required
                          />
                        </div>
                        
                        <div className="form-group">
                          <label htmlFor="proposedDuration">Timeline *</label>
                          <select
                            id="proposedDuration"
                            value={proposal.proposedDuration}
                            onChange={(e) => setProposal({...proposal, proposedDuration: e.target.value})}
                            required
                          >
                            <option value="">Select timeline</option>
                            <option value="1-3 days">1-3 days</option>
                            <option value="1 week">1 week</option>
                            <option value="2 weeks">2 weeks</option>
                            <option value="1 month">1 month</option>
                            <option value="2-3 months">2-3 months</option>
                            <option value="3+ months">3+ months</option>
                          </select>
                        </div>
                      </div>

                      {error && <div className="error-message">{error}</div>}
                      
                      <button 
                        type="submit" 
                        className="btn btn-primary btn-full"
                        disabled={applying}
                      >
                        {applying ? 'Submitting...' : 'Submit Proposal'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {isOwnJob && (
              <div className="job-owner-actions">
                <h3>Your Job</h3>
                <p>You posted this job.</p>
                <button 
                  onClick={() => navigate(`/jobs/${id}/proposals`)}
                  className="btn btn-secondary btn-full"
                >
                  View Proposals ({job.proposals?.length || 0})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetails;
