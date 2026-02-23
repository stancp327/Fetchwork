import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getLocationDisplay } from '../../utils/location';
import { formatBudget } from '../../utils/formatters';
import SEO from '../common/SEO';
import { createJobPostingSchema } from '../../utils/structuredData';
import CustomOfferModal from '../Offers/CustomOfferModal';
import DisputeFilingForm from '../Disputes/DisputeFilingForm';
import FileUpload from '../common/FileUpload';
import './JobDetails.css';
import { getApiBaseUrl } from '../../utils/api';

const JobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerRecipient, setOfferRecipient] = useState(null);
  const [proposal, setProposal] = useState({
    coverLetter: '',
    proposedBudget: '',
    proposedDuration: '',
    attachments: []
  });
  const [selectedAttachments, setSelectedAttachments] = useState([]);

  const API_BASE_URL = getApiBaseUrl();

  const fetchJobDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      
      console.log('Fetching job details for ID:', id);
      console.log('API_BASE_URL:', API_BASE_URL);
      console.log('Token:', token ? 'Present' : 'Missing');
      const response = await fetch(`${API_BASE_URL}/api/jobs/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to fetch job details: ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response:', data);
      console.log('Job data extracted:', data.job);
      
      if (!data.job) {
        throw new Error('Job data not found in response');
      }
      
      setJob(data.job);
    } catch (error) {
      console.error('Error fetching job details:', error);
      setError(error.message || 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  }, [id, API_BASE_URL]);

  useEffect(() => {
    fetchJobDetails();
  }, [fetchJobDetails]);

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
      const formData = new FormData();
      
      formData.append('coverLetter', proposal.coverLetter);
      formData.append('proposedBudget', proposal.proposedBudget);
      formData.append('proposedDuration', proposal.proposedDuration);
      
      selectedAttachments.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await fetch(`${API_BASE_URL}/api/jobs/${id}/proposals`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit proposal');
      }

      alert('Proposal submitted successfully! Check your messages for updates.');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting proposal:', error);
      setError(error.message);
    } finally {
      setApplying(false);
    }
  };

  const handleDisputeFiled = (dispute) => {
    setJob({...job, status: 'disputed', disputeStatus: 'pending'});
    alert('Dispute filed successfully. An admin will review your case.');
  };

  const handleFundEscrow = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/payments/fund-escrow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobId: id,
          amount: job.budget.amount
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fund escrow');
      }

      const data = await response.json();
      if (data.paymentIntent) {
        window.location.href = `/payments/checkout?payment_intent=${data.paymentIntent.id}`;
      }
    } catch (error) {
      console.error('Error funding escrow:', error);
      alert('Failed to fund escrow. Please try again.');
    }
  };

  const handleReleaseEscrow = async () => {
    if (!window.confirm('Are you sure you want to release the escrow payment to the freelancer?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/payments/release-escrow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobId: id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to release escrow');
      }

      await response.json();
      alert('Payment released successfully!');
      fetchJobDetails();
    } catch (error) {
      console.error('Error releasing escrow:', error);
      alert('Failed to release payment. Please try again.');
    }
  };


  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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

  if (loading) {
    return (
      <div className="jd-state-page">
        <div className="loading-spinner-jd"></div>
        <p>Loading job details...</p>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="jd-state-page">
        <h2>Error Loading Job</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/browse-jobs')} className="btn-back">
          Back to Browse Jobs
        </button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="jd-state-page">
        <h2>Job Not Found</h2>
        <p>The job you're looking for doesn't exist or has been removed.</p>
        <button onClick={() => navigate('/browse-jobs')} className="btn-back">
          Back to Browse Jobs
        </button>
      </div>
    );
  }

  const isOwnJob = user && job.client && job.client._id === user._id;
  const hasApplied = job.proposals && job.proposals.some(p => p.freelancer._id === user._id);
  const jobStructuredData = job && job.client ? createJobPostingSchema(job, job.client) : null;

  return (
    <>
      <SEO 
        title={job.title}
        description={job.description.substring(0, 160)}
        keywords={job.skills?.join(', ')}
        type="article"
        structuredData={jobStructuredData}
      />
      <div className="job-details-page">
        <button onClick={() => navigate('/browse-jobs')} className="back-button">
          ← Back to Jobs
        </button>
        <div className="job-meta">
          <span className="job-category">{job.category}</span>
          <span className="job-posted">Posted {formatDate(job.createdAt)}</span>
        </div>

        <div className="job-content-grid">
          <div className="job-main-card">
            <div className="job-title-row">
              <h1>{job.title}</h1>
              <span className={`status-badge ${job.status}`}>{formatJobStatus(job.status)}</span>
            </div>
            
            <div className="job-stats-row">
              <div className="job-stat-item">
                <span className="stat-label">Budget</span>
                <span className="stat-value">{formatBudget(job.budget)}</span>
              </div>
              <div className="job-stat-item">
                <span className="stat-label">Duration</span>
                <span className="stat-value">{job.duration}</span>
              </div>
              <div className="job-stat-item">
                <span className="stat-label">Experience</span>
                <span className="stat-value">{job.experienceLevel}</span>
              </div>
              <div className="job-stat-item">
                <span className="stat-label">Proposals</span>
                <span className="stat-value">{job.proposals?.length || 0}</span>
              </div>
            </div>

            <div className="job-section">
              <h3>Job Description</h3>
              {job.description.split('\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            {job.skills && job.skills.length > 0 && (
              <div className="job-section">
                <h3>Required Skills</h3>
                <div className="skills-list">
                  {job.skills.map((skill, index) => (
                    <span key={index} className="skill-tag">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="job-section">
              <div className="job-info-list">
                <div className="job-info-item">
                  <strong>📍 Location:</strong> {getLocationDisplay(job.location)}
                </div>
                {job.deadline && (
                  <div className="job-info-item">
                    <strong>⏰ Deadline:</strong> {new Date(job.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {(() => {
                      const days = Math.ceil((new Date(job.deadline) - new Date()) / 86400000);
                      if (days < 0) return <span style={{ color: '#dc2626', marginLeft: '0.5rem' }}>(Overdue)</span>;
                      if (days <= 7) return <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>({days}d left)</span>;
                      return null;
                    })()}
                  </div>
                )}
                <div className="job-info-item">
                  <strong>👀 Interest:</strong> {job.proposalCount || 0} applicants • {job.views || 0} views
                  {(job.proposalCount >= 10 || job.views >= 50) && <span style={{ color: '#dc2626', marginLeft: '0.5rem' }}>🔥 High demand</span>}
                </div>
                {job.isUrgent && (
                  <div className="job-info-item urgent">
                    <strong>🚨 Urgent Project</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="job-sidebar-col">
            <div className="sidebar-card">
              <h3>About the Client</h3>
              <div className="client-name">
                {job.client.firstName} {job.client.lastName}
              </div>
              <div className="client-stats">
                <div className="client-stat">⭐ {job.client.rating || 'No rating'}</div>
                <div className="client-stat">📋 {job.client.totalJobs || 0} jobs posted</div>
                {job.client.memberSince && (
                  <div className="client-stat">📅 Member since {formatDate(job.client.memberSince)}</div>
                )}
              </div>
            </div>

            {!isOwnJob && job.status === 'open' && (
              <div className="sidebar-card">
                {hasApplied ? (
                  <div className="already-applied">
                    <h3>✅ Application Submitted</h3>
                    <p>You have already submitted a proposal for this job.</p>
                  </div>
                ) : (
                  <>
                    <h3>Submit a Proposal</h3>
                    <form onSubmit={handleApply}>
                      <div className="form-group">
                        <label htmlFor="coverLetter">Cover Letter *</label>
                        <textarea
                          id="coverLetter"
                          value={proposal.coverLetter}
                          onChange={(e) => setProposal({...proposal, coverLetter: e.target.value})}
                          placeholder="Explain why you're the best fit..."
                          rows="5"
                          required
                        />
                      </div>
                      
                      <div className="form-row-2">
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
                            <option value="">Select</option>
                            <option value="1-3 days">1-3 days</option>
                            <option value="1 week">1 week</option>
                            <option value="2 weeks">2 weeks</option>
                            <option value="1 month">1 month</option>
                            <option value="2-3 months">2-3 months</option>
                            <option value="3+ months">3+ months</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Attachments (Optional)</label>
                        <FileUpload
                          onFileSelect={setSelectedAttachments}
                          accept=".pdf,.doc,.docx,.txt,image/*"
                          maxSize={10 * 1024 * 1024}
                          multiple={true}
                          label="Upload Portfolio or Documents"
                        />
                      </div>

                      {error && <div className="error-banner-jd">{error}</div>}
                      
                      <button 
                        type="submit" 
                        className="btn-submit-proposal"
                        disabled={applying}
                      >
                        {applying ? '⏳ Submitting...' : '📝 Submit Proposal'}
                      </button>

                      <div className="custom-offer-divider">
                        <p>Want to propose different terms?</p>
                        <button
                          type="button"
                          className="btn-full btn-secondary-jd"
                          onClick={() => {
                            setOfferRecipient({
                              id: job.client._id,
                              name: `${job.client.firstName} ${job.client.lastName}`
                            });
                            setShowOfferModal(true);
                          }}
                        >
                          📋 Send Custom Offer
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            )}

            {isOwnJob && (
              <div className="sidebar-card">
                <h3>Your Job</h3>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>You posted this job.</p>
                <button 
                  onClick={() => navigate(`/jobs/${id}/proposals`)}
                  className="btn-full btn-secondary-jd"
                  style={{ marginBottom: '0.5rem' }}
                >
                  View Proposals ({job.proposals?.length || 0})
                </button>
                
                {job.proposals?.length > 0 && (
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.5rem 0' }}>
                    💡 Send a counter offer from the proposals page
                  </p>
                )}
                
                {job.status === 'in_progress' && job.escrowAmount === 0 && (
                  <button className="btn-full btn-primary-jd" style={{ marginTop: '0.5rem' }} onClick={handleFundEscrow}>
                    Fund Escrow ({formatBudget(job.budget)})
                  </button>
                )}
                
                {job.status === 'completed' && job.escrowAmount > 0 && (
                  <button className="btn-full btn-success-jd" style={{ marginTop: '0.5rem' }} onClick={handleReleaseEscrow}>
                    Release Payment (${job.escrowAmount})
                  </button>
                )}
              </div>
            )}

            {job.status === 'disputed' && 
             user && (job.client._id === user._id || job.freelancer?._id === user._id) && (
              <div className="sidebar-card">
                <h3>⚠️ Dispute Active</h3>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
                  This job has an active dispute. An admin is reviewing the case.
                </p>
                <Link to={`/disputes`} className="btn-full btn-danger-jd" style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                  View My Disputes
                </Link>
              </div>
            )}

            {(job.status === 'in_progress' || job.status === 'completed') && 
             user && (job.client._id === user._id || job.freelancer?._id === user._id) && (
              <div className="sidebar-card">
                <Link to={`/jobs/${job._id}/progress`} className="btn-full btn-primary-jd" style={{ textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>
                  📊 Track Progress
                </Link>
                <button 
                  className="btn-full btn-danger-jd"
                  onClick={() => setShowDisputeModal(true)}
                >
                  ⚠️ File Dispute
                </button>
              </div>
            )}
          </div>
        </div>

      {showDisputeModal && (
        <DisputeFilingForm
          jobId={job._id}
          onClose={() => setShowDisputeModal(false)}
          onSubmit={handleDisputeFiled}
        />
      )}

      {showOfferModal && offerRecipient && (
        <CustomOfferModal
          isOpen={true}
          onClose={() => { setShowOfferModal(false); setOfferRecipient(null); }}
          recipientId={offerRecipient.id}
          recipientName={offerRecipient.name}
          jobId={job._id}
          offerType="custom_order"
          prefillTerms={{
            amount: job.budget?.amount || '',
            deliveryTime: '',
            description: `Custom offer for: ${job.title}`
          }}
          onSuccess={() => alert('Offer sent! Check your offers page.')}
        />
      )}
    </div>
    </>
  );
};

export default JobDetails;
