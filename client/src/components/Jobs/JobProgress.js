import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import EscrowModal from '../Payments/EscrowModal';
import './JobProgress.css';

const UPDATE_ICONS = {
  update: '💬',
  milestone_completed: '✅',
  file_delivered: '📎',
  revision_requested: '🔄',
  status_change: '🔀'
};

const MILESTONE_STATUS = {
  pending: { label: 'Pending', color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { label: 'In Progress', color: '#2563eb', bg: '#eff6ff' },
  completed: { label: 'Completed', color: '#f59e0b', bg: '#fefce8' },
  approved: { label: 'Approved', color: '#10b981', bg: '#ecfdf5' }
};

const JobProgress = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentFailed,    setPaymentFailed]    = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newUpdate, setNewUpdate] = useState('');
  const [posting, setPosting] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ title: '', amount: '', description: '', dueDate: '' });
  const [showSecurePayment, setShowSecurePayment] = useState(false);
  const [releasing,    setReleasing]    = useState(false);
  const [releaseMsg,   setReleaseMsg]   = useState('');
  // Milestone payment state: { index, clientSecret, title, amount } or null
  const [milestonePay, setMilestonePay] = useState(null);
  const [msReleasing,  setMsReleasing]  = useState(null); // index being released

  const fetchProgress = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiRequest(`/api/jobs/${id}/progress`);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  // Handle 3DS / redirect-based payment return
  useEffect(() => {
    const status = searchParams.get('redirect_status') || (searchParams.get('payment') === 'success' ? 'succeeded' : null);
    if (status === 'succeeded') {
      setPaymentConfirmed(true);
      fetchProgress(); // refresh to get updated escrow amount
      setSearchParams({}, { replace: true }); // clean URL
    } else if (status === 'failed') {
      setPaymentFailed(true);
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const postUpdate = async () => {
    if (!newUpdate.trim() || posting) return;
    setPosting(true);
    try {
      await apiRequest(`/api/jobs/${id}/progress`, {
        method: 'POST',
        body: JSON.stringify({ message: newUpdate })
      });
      setNewUpdate('');
      fetchProgress();
    } catch (err) {
      alert(err.message || 'Failed to post update');
    } finally {
      setPosting(false);
    }
  };

  const updateMilestone = async (index, status, message) => {
    try {
      await apiRequest(`/api/jobs/${id}/milestones/${index}`, {
        method: 'PUT',
        body: JSON.stringify({ status, message })
      });
      fetchProgress();
    } catch (err) {
      alert(err.message || 'Failed to update milestone');
    }
  };

  const addMilestone = async () => {
    if (!newMilestone.title || !newMilestone.amount) return;
    try {
      await apiRequest(`/api/jobs/${id}/milestones`, {
        method: 'POST',
        body: JSON.stringify({ milestones: [{ ...newMilestone, amount: parseFloat(newMilestone.amount) }] })
      });
      setNewMilestone({ title: '', amount: '', description: '', dueDate: '' });
      setShowAddMilestone(false);
      fetchProgress();
    } catch (err) {
      alert(err.message || 'Failed to add milestone');
    }
  };

  const handleFundMilestone = async (milestoneIndex) => {
    try {
      const result = await apiRequest(`/api/jobs/${id}/milestones/${milestoneIndex}/fund`, { method: 'POST' });
      setMilestonePay({
        index:        milestoneIndex,
        clientSecret: result.clientSecret,
        title:        result.milestoneTitle,
        amount:       result.amount,
        paymentIntentId: result.paymentIntentId,
      });
    } catch (err) {
      alert(err.message || 'Failed to initialize milestone payment');
    }
  };

  const handleMilestonePaymentSuccess = async (paymentIntent) => {
    if (!milestonePay) return;
    try {
      await apiRequest(`/api/jobs/${id}/milestones/${milestonePay.index}/fund/confirm`, {
        method: 'POST',
        body: JSON.stringify({ paymentIntentId: milestonePay.paymentIntentId || paymentIntent?.id }),
      });
      setMilestonePay(null);
      fetchProgress();
    } catch (err) {
      alert('Payment received but confirmation failed. Contact support.');
    }
  };

  const handleReleaseMilestone = async (milestoneIndex) => {
    if (!window.confirm('Release payment for this milestone to the freelancer?')) return;
    setMsReleasing(milestoneIndex);
    try {
      const result = await apiRequest(`/api/jobs/${id}/milestones/${milestoneIndex}/release`, { method: 'POST' });
      setReleaseMsg(`✅ $${result.payoutAmt?.toFixed(2)} released for milestone!`);
      fetchProgress();
    } catch (err) {
      alert(err.message || 'Failed to release milestone payment');
    } finally {
      setMsReleasing(null);
    }
  };

  const handleReleasePayment = async () => {
    if (!window.confirm('Release payment to the freelancer? This cannot be undone.')) return;
    setReleasing(true);
    setReleaseMsg('');
    try {
      const result = await apiRequest('/api/payments/release-escrow', {
        method: 'POST',
        body: JSON.stringify({ jobId: id })
      });
      setReleaseMsg(`✅ Payment of $${result.payoutAmt?.toFixed(2)} released!`);
      fetchProgress();
    } catch (err) {
      setReleaseMsg(`❌ ${err.message || 'Failed to release payment'}`);
    } finally {
      setReleasing(false);
    }
  };

  if (loading) return <div className="jp-container"><div className="jp-loading">Loading progress...</div></div>;
  if (error) return <div className="jp-container"><div className="jp-error">{error}</div></div>;
  if (!data) return null;

  const isClient = user?._id === data.job?.client?._id;
  const isFreelancer = user?._id === data.job?.freelancer?._id;
  const milestones = data.milestones || [];
  const updates = [...(data.progress || [])].reverse();
  const completedMilestones = milestones.filter(m => m.status === 'approved').length;
  const totalMilestones = milestones.length;
  const overallProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  return (
    <div className="jp-container">
      {/* 3DS / redirect-based payment return banners */}
      {paymentConfirmed && (
        <div className="jp-payment-banner jp-payment-funded" style={{ marginBottom: '1rem' }}>
          ✅ Payment confirmed! Funds are secured and the freelancer has been notified.
        </div>
      )}
      {paymentFailed && (
        <div className="jp-payment-banner jp-payment-unfunded" style={{ marginBottom: '1rem', borderColor: '#ef4444' }}>
          ❌ Payment was not completed. Please try again using the Secure Payment button below.
        </div>
      )}

      {/* Header */}
      <div className="jp-header">
        <div>
          <Link to={`/jobs/${id}`} className="jp-back">← Back to job</Link>
          <h1>{data.job?.title}</h1>
          <div className="jp-meta">
            {data.job?.client?.firstName && <span>Client: <strong>{data.job.client.firstName} {data.job.client.lastName}</strong></span>}
            {data.job?.freelancer?.firstName && <span> • Freelancer: <strong>{data.job.freelancer.firstName} {data.job.freelancer.lastName}</strong></span>}
            <span> • Status: <strong>{data.status}</strong></span>
          </div>
        </div>
      </div>

      {/* Secure Payment Banner */}
      {(() => {
        const job = data.job;
        const escrow = job?.escrowAmount || 0;
        const amount = job?.budget?.max || job?.budget?.min || escrow;
        if (data.status === 'completed') {
          return (
            <div className="jp-payment-banner jp-payment-released">
              💸 Payment has been released to the freelancer.
            </div>
          );
        }
        if (isClient && escrow === 0 && job?.freelancer) {
          return (
            <div className="jp-payment-banner jp-payment-unfunded">
              <div>
                <strong>🔒 Secure Payment not set up</strong>
                <p>Fund the job so the freelancer knows you're committed. Funds are only released when you approve.</p>
              </div>
              <button className="jp-btn-secure" onClick={() => setShowSecurePayment(true)}>
                Secure Payment →
              </button>
            </div>
          );
        }
        if (isClient && escrow > 0) {
          return (
            <div className="jp-payment-banner jp-payment-funded">
              <div>
                <strong>🔒 ${escrow.toFixed(2)} secured</strong>
                <p>Funds are held safely. Release to the freelancer once you're satisfied with the work.</p>
                {releaseMsg && <p className="jp-release-msg">{releaseMsg}</p>}
              </div>
              <button className="jp-btn-release" onClick={handleReleasePayment} disabled={releasing}>
                {releasing ? 'Releasing…' : 'Release Payment'}
              </button>
            </div>
          );
        }
        if (isFreelancer) {
          return escrow > 0 ? (
            <div className="jp-payment-banner jp-payment-funded">
              <strong>🔒 ${escrow.toFixed(2)} secured by client</strong>
              <p>Payment will be deposited to your Stripe account when the client releases it.</p>
            </div>
          ) : (
            <div className="jp-payment-banner jp-payment-unfunded">
              <strong>⏳ Awaiting client payment</strong>
              <p>The client hasn't secured payment yet. You can still start work, but payment isn't guaranteed until funded.</p>
            </div>
          );
        }
        return null;
      })()}

      {/* Overall Progress Bar */}
      <div className="jp-progress-card">
        <div className="jp-progress-header">
          <h2>Overall Progress</h2>
          <span className="jp-progress-pct">{overallProgress}%</span>
        </div>
        <div className="jp-progress-bar-outer">
          <div className="jp-progress-bar-inner" style={{ width: `${overallProgress}%` }} />
        </div>
        <div className="jp-progress-summary">
          {completedMilestones}/{totalMilestones} milestones approved
          {data.deadline && (
            <span> • Deadline: {new Date(data.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          )}
        </div>
      </div>

      <div className="jp-layout">
        {/* Left: Milestones */}
        <div className="jp-milestones-panel">
          <div className="jp-panel-header">
            <h2>Milestones</h2>
            {isClient && (
              <button className="jp-btn-sm" onClick={() => setShowAddMilestone(!showAddMilestone)}>+ Add</button>
            )}
          </div>

          {showAddMilestone && (
            <div className="jp-add-milestone">
              <input placeholder="Milestone title" value={newMilestone.title}
                onChange={e => setNewMilestone(prev => ({ ...prev, title: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input type="number" placeholder="Amount ($)" value={newMilestone.amount}
                  onChange={e => setNewMilestone(prev => ({ ...prev, amount: e.target.value }))} />
                <input type="date" value={newMilestone.dueDate}
                  onChange={e => setNewMilestone(prev => ({ ...prev, dueDate: e.target.value }))} />
              </div>
              <textarea placeholder="Description (optional)" value={newMilestone.description} rows={2}
                onChange={e => setNewMilestone(prev => ({ ...prev, description: e.target.value }))} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="jp-btn-primary" onClick={addMilestone}>Add Milestone</button>
                <button className="jp-btn-ghost" onClick={() => setShowAddMilestone(false)}>Cancel</button>
              </div>
            </div>
          )}

          {milestones.length === 0 ? (
            <div className="jp-empty">No milestones yet</div>
          ) : (
            <div className="jp-milestones-list">
              {milestones.map((m, i) => {
                const st = MILESTONE_STATUS[m.status];
                return (
                  <div key={i} className="jp-milestone-card">
                    <div className="jp-milestone-header">
                      <div>
                        <span className="jp-milestone-num">#{i + 1}</span>
                        <strong>{m.title}</strong>
                      </div>
                      <span className="jp-milestone-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    {m.description && <p className="jp-milestone-desc">{m.description}</p>}
                    <div className="jp-milestone-meta">
                      <span>${m.amount}</span>
                      {m.dueDate && <span>Due {new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                    </div>

                    {/* Payment status pill */}
                    {m.escrowAmount > 0 && (
                      <div className="jp-ms-funded-pill">🔒 ${m.escrowAmount} secured</div>
                    )}
                    {m.status === 'approved' && m.releasedAt && (
                      <div className="jp-ms-funded-pill released">✅ Payment released</div>
                    )}

                    {/* Actions */}
                    <div className="jp-milestone-actions">
                      {/* Progress actions */}
                      {isFreelancer && m.status === 'pending' && (
                        <button className="jp-btn-sm primary" onClick={() => updateMilestone(i, 'in_progress')}>Start Working</button>
                      )}
                      {isFreelancer && m.status === 'in_progress' && (
                        <button className="jp-btn-sm success" onClick={() => updateMilestone(i, 'completed')}>Mark Complete</button>
                      )}
                      {isClient && m.status === 'completed' && (
                        <>
                          <button className="jp-btn-sm success" onClick={() => updateMilestone(i, 'approved')}>Approve</button>
                          <button className="jp-btn-sm warning" onClick={() => {
                            const reason = prompt('What needs to be revised?');
                            if (reason) updateMilestone(i, 'in_progress', reason);
                          }}>Request Revision</button>
                        </>
                      )}

                      {/* Payment actions */}
                      {isClient && !m.escrowAmount && m.status !== 'approved' && (
                        <button className="jp-btn-sm secure" onClick={() => handleFundMilestone(i)}>
                          🔒 Fund Milestone
                        </button>
                      )}
                      {isClient && m.escrowAmount > 0 && ['completed'].includes(m.status) && (
                        <button
                          className="jp-btn-sm release"
                          disabled={msReleasing === i}
                          onClick={() => handleReleaseMilestone(i)}
                        >
                          {msReleasing === i ? 'Releasing…' : `💸 Release $${m.escrowAmount}`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Activity Timeline */}
        <div className="jp-timeline-panel">
          <h2>Activity Timeline</h2>

          {/* Post Update */}
          {(isClient || isFreelancer) && (
            <div className="jp-post-update">
              <textarea
                placeholder="Post a progress update..."
                value={newUpdate}
                onChange={e => setNewUpdate(e.target.value)}
                rows={3}
              />
              <button className="jp-btn-primary" onClick={postUpdate} disabled={posting || !newUpdate.trim()}>
                {posting ? 'Posting...' : 'Post Update'}
              </button>
            </div>
          )}

          {updates.length === 0 ? (
            <div className="jp-empty">No activity yet</div>
          ) : (
            <div className="jp-timeline">
              {updates.map((u, i) => (
                <div key={i} className="jp-timeline-item">
                  <div className="jp-timeline-dot">
                    {UPDATE_ICONS[u.type] || '💬'}
                  </div>
                  <div className="jp-timeline-content">
                    <div className="jp-timeline-header">
                      <strong>{u.author?.firstName} {u.author?.lastName}</strong>
                      <span className="jp-timeline-time">
                        {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' '}{new Date(u.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="jp-timeline-msg">{u.message}</p>
                    {u.attachments?.length > 0 && (
                      <div className="jp-timeline-attachments">
                        {u.attachments.map((a, j) => (
                          <a key={j} href={a.url} target="_blank" rel="noreferrer" className="jp-attachment">
                            📎 {a.filename || 'Attachment'}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showSecurePayment && (
        <EscrowModal
          job={data.job}
          amount={data.job?.budget?.max || data.job?.budget?.min || 0}
          onClose={() => setShowSecurePayment(false)}
          onPaid={() => { setShowSecurePayment(false); fetchProgress(); }}
        />
      )}

      {/* Milestone payment modal */}
      {milestonePay && (
        <EscrowModal
          job={{ _id: id, title: `Milestone: ${milestonePay.title}` }}
          amount={milestonePay.amount}
          preloadedSecret={milestonePay.clientSecret}
          title={`Fund Milestone — ${milestonePay.title}`}
          onClose={() => setMilestonePay(null)}
          onPaid={handleMilestonePaymentSuccess}
        />
      )}
    </div>
  );
};

export default JobProgress;
