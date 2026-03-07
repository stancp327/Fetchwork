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
import EscrowModal from '../Payments/EscrowModal';
import { apiRequest } from '../../utils/api';
import './JobDetails.css';
import { getApiBaseUrl } from '../../utils/api';
import { aiApi } from '../../api/ai';

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
  const [showSecurePayment, setShowSecurePayment] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [offerRecipient, setOfferRecipient] = useState(null);
  const [proposal, setProposal] = useState({
    coverLetter: '',
    proposedBudget: '',
    proposedDuration: '',
    attachments: []
  });
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [showMilestones, setShowMilestones] = useState(false);
  const [proposedMilestones, setProposedMilestones] = useState([
    { title: '', amount: '', description: '' }
  ]);
  const [aiMatches, setAiMatches]           = useState(null);
  const [aiMatchLoading, setAiMatchLoading] = useState(false);
  const [aiMatchError, setAiMatchError]     = useState('');

  const API_BASE_URL = getApiBaseUrl();

  const loadMatches = async () => {
    if (!job?._id) return;
    setAiMatchLoading(true);
    setAiMatchError('');
    try {
      const data = await aiApi.matchFreelancers(job._id);
      setAiMatches(data);
    } catch (err) {
      setAiMatchError(err.message || 'Failed to load matches');
    } finally {
      setAiMatchLoading(false);
    }
  };

  const fetchJobDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/jobs/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to fetch job details: ${response.status}`);
      }

      const data = await response.json();
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

      // Attach milestone proposals if any were added
      if (showMilestones) {
        const validMilestones = proposedMilestones.filter(m => m.title.trim() && parseFloat(m.amount) > 0);
        if (validMilestones.length > 0) {
          formData.append('proposedMilestones', JSON.stringify(validMilestones));
        }
      }
      
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

      alert('Proposal submitted! Check your messages for updates.');
      navigate('/browse-jobs');
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

  const handleReleasePayment = async () => {
    if (!window.confirm('Release payment to the freelancer? This cannot be undone.')) return;
    setReleasing(true);
    try {
      await apiRequest('/api/payments/release-escrow', {
        method: 'POST',
        body: JSON.stringify({ jobId: id })
      });
      alert('Payment released successfully!');
      fetchJobDetails();
    } catch (err) {
      alert(err.message || 'Failed to release payment. Please try again.');
    } finally {
      setReleasing(false);
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

  const isOwnJob = user && job.client && (
    job.client._id?.toString() === (user._id || user.id || user.userId)?.toString() ||
    job.client?.toString() === (user._id || user.id || user.userId)?.toString()
  );
  const myUserId = (user?._id || user?.id || user?.userId)?.toString();
  const myProposal = job.proposals?.find(p => {
    const flId = p.freelancer?._id?.toString() || p.freelancer?.toString();
    return flId && flId === myUserId;
  }) || null;
  const hasApplied = !!myProposal;
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
              {job.scheduledDate && (
                <div className="job-stat-item">
                  <span className="stat-label">Scheduled</span>
                  <span className="stat-value">{new Date(job.scheduledDate).toLocaleString()}</span>
                </div>
              )}
              {job.cancellationPolicy && job.cancellationPolicy !== 'flexible' && (
                <div className="job-stat-item">
                  <span className="stat-label">Cancellation</span>
                  <span className="stat-value" style={{ textTransform: 'capitalize' }}>{job.cancellationPolicy}</span>
                </div>
              )}
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
                    {myProposal?.status === 'accepted' ? (
                      <>
                        <h3>🎉 Proposal Accepted!</h3>
                        <p>You've been hired for this job. Check your active work.</p>
                      </>
                    ) : myProposal?.status === 'declined' ? (
                      <>
                        <h3>❌ Proposal Declined</h3>
                        <p>The client didn't move forward with your proposal this time.</p>
                      </>
                    ) : (
                      <>
                        <h3>✅ Proposal Submitted</h3>
                        <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
                          Awaiting the client's review.
                        </p>
                      </>
                    )}
                    {myProposal && (
                      <div className="my-proposal-summary">
                        <div className="my-proposal-row">
                          <span className="my-proposal-label">Your Bid</span>
                          <strong>${myProposal.proposedBudget}</strong>
                        </div>
                        <div className="my-proposal-row">
                          <span className="my-proposal-label">Timeline</span>
                          <strong>{myProposal.proposedDuration?.replace(/_/g, ' ')}</strong>
                        </div>
                        {myProposal.coverLetter && (
                          <div className="my-proposal-cover">
                            <span className="my-proposal-label">Cover Letter</span>
                            <p>{myProposal.coverLetter.substring(0, 200)}{myProposal.coverLetter.length > 200 ? '…' : ''}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <Link to="/messages" className="btn-full btn-secondary-jd" style={{ marginTop: '0.75rem', textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                      💬 Message the Client
                    </Link>
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

                      {/* Optional milestone breakdown */}
                      <div className="form-group">
                        {!showMilestones ? (
                          <button
                            type="button"
                            className="milestone-toggle-btn"
                            onClick={() => setShowMilestones(true)}
                          >
                            📋 Break this into milestones <span className="ms-toggle-hint">— optional, helps build trust</span>
                          </button>
                        ) : (
                          <div className="milestone-proposal-block">
                            <div className="ms-header">
                              <label>Proposed Milestones</label>
                              <button type="button" className="ms-remove-all" onClick={() => setShowMilestones(false)}>Remove</button>
                            </div>
                            <p className="ms-tip">Break your work into clear checkpoints. Client funds each milestone separately.</p>
                            {proposedMilestones.map((ms, i) => (
                              <div key={i} className="ms-row">
                                <input
                                  type="text"
                                  placeholder={`Milestone ${i + 1} title`}
                                  value={ms.title}
                                  onChange={e => {
                                    const updated = [...proposedMilestones];
                                    updated[i] = { ...updated[i], title: e.target.value };
                                    setProposedMilestones(updated);
                                  }}
                                />
                                <input
                                  type="number"
                                  placeholder="$"
                                  value={ms.amount}
                                  min="1"
                                  onChange={e => {
                                    const updated = [...proposedMilestones];
                                    updated[i] = { ...updated[i], amount: e.target.value };
                                    setProposedMilestones(updated);
                                  }}
                                />
                                {proposedMilestones.length > 1 && (
                                  <button
                                    type="button"
                                    className="ms-delete-btn"
                                    onClick={() => setProposedMilestones(proposedMilestones.filter((_, j) => j !== i))}
                                  >×</button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              className="ms-add-btn"
                              onClick={() => setProposedMilestones([...proposedMilestones, { title: '', amount: '', description: '' }])}
                            >
                              + Add milestone
                            </button>
                          </div>
                        )}
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

            {isOwnJob && job.status === 'open' && (
              <div className="sidebar-card ai-matches-panel">
                <div className="ai-matches-header">
                  <h3>🤖 Smart Matches</h3>
                  <p className="ai-matches-sub">Top freelancers for this job</p>
                </div>
                {!aiMatches && !aiMatchLoading && (
                  <button className="ai-matches-btn" onClick={loadMatches}>
                    ✨ Find Top Matches
                  </button>
                )}
                {aiMatchLoading && <p className="ai-matches-loading">Finding best matches…</p>}
                {aiMatchError && <p className="ai-matches-error">{aiMatchError}</p>}
                {aiMatches && (
                  <>
                    <p className="ai-matches-meta">
                      {aiMatches.aiPowered ? '✨ AI-ranked' : '📊 Algorithmically ranked'}
                      {' · '}{aiMatches.total} freelancers compared
                    </p>
                    <div className="ai-matches-list">
                      {(aiMatches.matches || []).map((m, i) => (
                        <div key={m.userId} className="ai-match-card">
                          <span className="ai-match-rank">#{i + 1}</span>
                          {m.profilePicture
                            ? <img src={m.profilePicture} alt={m.name} className="ai-match-avatar" />
                            : <div className="ai-match-avatar ai-match-avatar-placeholder">{m.name[0]}</div>
                          }
                          <div className="ai-match-info">
                            <Link to={`/profile/${m.userId}`} className="ai-match-name">{m.name}</Link>
                            {m.rating > 0 && <span className="ai-match-rating">⭐ {m.rating.toFixed(1)}</span>}
                            {m.matchReason && <p className="ai-match-reason">{m.matchReason}</p>}
                          </div>
                          <div className="ai-match-score">{m.aiScore ?? m.algorithmicScore}</div>
                        </div>
                      ))}
                    </div>
                    <button className="ai-matches-refresh" onClick={loadMatches}>↻ Refresh</button>
                  </>
                )}
              </div>
            )}

            {isOwnJob && job.status === 'open' && (() => {
              const pending = (job.proposals || []).filter(p => p.status === 'pending');
              const allProposals = job.proposals || [];
              return (
                <div className="sidebar-card owner-proposals-panel">
                  <div className="owner-proposals-header">
                    <h3>
                      {pending.length > 0
                        ? `🔔 ${pending.length} Proposal${pending.length !== 1 ? 's' : ''} to Review`
                        : `📋 Proposals (${allProposals.length})`}
                    </h3>
                  </div>

                  {allProposals.length === 0 ? (
                    <p className="owner-proposals-empty">
                      No proposals yet. Share this job to attract freelancers.
                    </p>
                  ) : (
                    <>
                      {/* Show top 3 inline, link to full page for more */}
                      {pending.slice(0, 3).map(p => {
                        const fl = p.freelancer || {};
                        const initials = `${(fl.firstName || '?')[0]}${(fl.lastName || '')[0] || ''}`.toUpperCase();
                        return (
                          <div key={p._id} className="owner-proposal-row">
                            <div className="opr-avatar">{fl.profilePhoto ? <img src={fl.profilePhoto} alt="" /> : initials}</div>
                            <div className="opr-info">
                              <div className="opr-name">{fl.firstName} {fl.lastName}</div>
                              <div className="opr-terms">${p.proposedBudget} · {p.proposedDuration?.replace(/_/g, ' ')}</div>
                              {fl.rating > 0 && <div className="opr-rating">⭐ {fl.rating.toFixed(1)}</div>}
                            </div>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => navigate(`/jobs/${id}/proposals`)}
                        className="btn-full btn-primary-jd"
                        style={{ marginTop: '0.75rem' }}
                      >
                        Review All Proposals →
                      </button>
                    </>
                  )}
                </div>
              );
            })()}

            {isOwnJob && job.status === 'in_progress' && (
              <div className="sidebar-card">
                <h3>💼 Job In Progress</h3>
                {job.escrowAmount === 0 && (
                  <button className="btn-full btn-primary-jd" style={{ marginBottom: '0.5rem' }} onClick={() => setShowSecurePayment(true)}>
                    🔒 Secure Payment ({formatBudget(job.budget)})
                  </button>
                )}
                {job.escrowAmount > 0 && (
                  <button className="btn-full btn-success-jd" style={{ marginBottom: '0.5rem' }} onClick={handleReleasePayment} disabled={releasing}>
                    {releasing ? 'Releasing…' : `Release Payment ($${job.escrowAmount})`}
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

      {showSecurePayment && job && (
        <EscrowModal
          job={job}
          amount={job.budget?.max || job.budget?.min || job.budget?.amount || 0}
          onClose={() => setShowSecurePayment(false)}
          onPaid={() => { setShowSecurePayment(false); fetchJobDetails(); }}
        />
      )}
    </>
  );
};

export default JobDetails;
