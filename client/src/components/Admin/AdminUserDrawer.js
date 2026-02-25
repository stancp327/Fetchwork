import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import { formatBudget } from '../../utils/formatters';
import './AdminUserDrawer.css';

const AdminUserDrawer = ({ data, onClose, onRefresh }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [actionLoading, setActionLoading] = useState('');
  const u = data?.user;
  if (!u) return null;

  const initials = `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase();
  const isWaived = u.feeWaiver?.enabled;
  const accountAge = data.summary?.accountAge || 0;

  const doAction = async (label, fn) => {
    setActionLoading(label);
    try { await fn(); onRefresh?.(); } catch (e) { alert(e.message || 'Action failed'); }
    setActionLoading('');
  };

  const handleSuspend = () => {
    const reason = prompt('Reason for suspension:');
    if (!reason) return;
    const days = prompt('Suspension duration in days (blank = indefinite):');
    doAction('suspend', () => apiRequest(`/api/admin/users/${u._id}/suspend`, {
      method: 'PUT', body: JSON.stringify({ reason, duration: days ? parseInt(days) : undefined })
    }));
  };

  const handleUnsuspend = () => doAction('unsuspend', () =>
    apiRequest(`/api/admin/users/${u._id}/unsuspend`, { method: 'PUT' })
  );

  const handleMakeMod = () => doAction('moderator', () =>
    apiRequest(`/api/admin/users/${u._id}/make-moderator`, {
      method: 'PUT', body: JSON.stringify({ permissions: ['job_management', 'content_moderation', 'dispute_management'] })
    })
  );

  const handleRemoveMod = () => doAction('remove-mod', () =>
    apiRequest(`/api/admin/users/${u._id}/remove-moderator`, { method: 'PUT' })
  );

  const handleFeeWaiver = () => {
    if (isWaived) {
      if (window.confirm('Remove fee waiver?')) {
        doAction('waiver', () => apiRequest(`/api/admin/users/${u._id}/fee-waiver`, {
          method: 'PUT', body: JSON.stringify({ enabled: false })
        }));
      }
    } else {
      const reason = prompt('Reason:', 'New user promo') || 'New user promo';
      const maxJobs = prompt('Max free jobs (blank = unlimited):', '10');
      const days = prompt('Duration in days (blank = 30):', '30');
      const expiresAt = new Date(Date.now() + (parseInt(days) || 30) * 86400000).toISOString();
      doAction('waiver', () => apiRequest(`/api/admin/users/${u._id}/fee-waiver`, {
        method: 'PUT', body: JSON.stringify({ enabled: true, reason, expiresAt, maxJobs: maxJobs ? parseInt(maxJobs) : null })
      }));
    }
  };

  const handleDelete = () => {
    if (!window.confirm(`Permanently delete ${u.firstName}'s account? This cannot be undone.`)) return;
    const reason = prompt('Reason for deletion:');
    if (!reason) return;
    doAction('delete', () => apiRequest(`/api/admin/users/${u._id}`, {
      method: 'DELETE', body: JSON.stringify({ reason })
    }));
  };

  const handlePromoteAdmin = () => doAction('admin', () =>
    apiRequest(`/api/admin/users/${u._id}/promote`, { method: 'PUT' })
  );

  const sections = [
    { id: 'overview', label: '👤 Overview' },
    { id: 'jobs', label: `📋 Jobs (${(data.jobsAsClient?.length || 0) + (data.jobsAsFreelancer?.length || 0)})` },
    { id: 'portfolio', label: `📁 Portfolio (${u.portfolio?.length || 0})` },
    { id: 'services', label: `🛍️ Services (${data.services?.length || 0})` },
    { id: 'reviews', label: `⭐ Reviews (${data.reviews?.length || 0})` },
    { id: 'actions', label: '⚡ Actions' }
  ];

  return (
    <div className="aud-overlay" onClick={onClose}>
      <div className="aud-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="aud-drawer-header">
          <button className="aud-back" onClick={onClose}>← Back</button>
          <a href={`/freelancers/${u._id}`} target="_blank" rel="noopener noreferrer" className="aud-view-public">View Public →</a>
        </div>

        {/* Profile card */}
        <div className="aud-profile-card">
          <div className="aud-avatar-lg">
            {u.profilePicture ? <img src={u.profilePicture} alt="" /> : initials}
          </div>
          <div className="aud-profile-info">
            <h2 className="aud-fullname">
              {u.firstName} {u.lastName}
              {u.isVerified && <span className="aud-verified" title="Verified">✓</span>}
            </h2>
            <p className="aud-headline">{u.headline || u.accountType || 'User'}</p>
            <p className="aud-email-line">{u.email}</p>
            <div className="aud-badges">
              <span className={`aud-badge aud-badge-${u.role}`}>{u.role}</span>
              <span className={`aud-badge ${u.isSuspended ? 'aud-badge-danger' : u.isActive ? 'aud-badge-success' : 'aud-badge-muted'}`}>
                {u.isSuspended ? 'Suspended' : u.isActive ? 'Active' : 'Inactive'}
              </span>
              {isWaived && <span className="aud-badge aud-badge-success">💚 Fee Waived</span>}
            </div>
            {isWaived && (
              <p className="aud-waiver-detail">
                {u.feeWaiver.reason} · {u.feeWaiver.jobsUsed || 0}/{u.feeWaiver.maxJobs || '∞'} jobs
                {u.feeWaiver.expiresAt && ` · Exp ${new Date(u.feeWaiver.expiresAt).toLocaleDateString()}`}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="aud-stat-row">
          <div className="aud-mini-stat"><strong>{data.summary?.totalJobsPosted || 0}</strong><span>Posted</span></div>
          <div className="aud-mini-stat"><strong>{data.summary?.totalJobsWorked || 0}</strong><span>Worked</span></div>
          <div className="aud-mini-stat"><strong>{data.services?.length || 0}</strong><span>Services</span></div>
          <div className="aud-mini-stat"><strong>{u.rating?.toFixed(1) || '—'}</strong><span>Rating</span></div>
          <div className="aud-mini-stat"><strong>{accountAge}d</strong><span>Age</span></div>
        </div>

        {/* Section tabs */}
        <div className="aud-section-tabs">
          {sections.map(s => (
            <button key={s.id} className={`aud-sec-tab ${activeSection === s.id ? 'active' : ''}`}
              onClick={() => setActiveSection(s.id)}>{s.label}</button>
          ))}
        </div>

        {/* Content */}
        <div className="aud-content">
          {activeSection === 'overview' && (
            <div className="aud-overview">
              <div className="aud-info-grid">
                <div className="aud-info-row"><span>Username</span><strong>{u.username || '—'}</strong></div>
                <div className="aud-info-row"><span>Account Type</span><strong>{u.accountType || '—'}</strong></div>
                <div className="aud-info-row"><span>Joined</span><strong>{new Date(u.createdAt).toLocaleDateString()}</strong></div>
                <div className="aud-info-row"><span>Last Login</span><strong>{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '—'}</strong></div>
                <div className="aud-info-row"><span>Location</span><strong>{u.location?.city ? `${u.location.city}, ${u.location.state || u.location.country}` : '—'}</strong></div>
                <div className="aud-info-row"><span>Hourly Rate</span><strong>{u.hourlyRate ? `$${u.hourlyRate}/hr` : '—'}</strong></div>
                <div className="aud-info-row"><span>Completed Jobs</span><strong>{u.completedJobs || 0}</strong></div>
                <div className="aud-info-row"><span>Profile Completion</span><strong>{u.profileCompletion || 0}%</strong></div>
                <div className="aud-info-row"><span>Email Verified</span><strong>{u.isEmailVerified ? '✅' : '❌'}</strong></div>
                <div className="aud-info-row"><span>Stripe Connected</span><strong>{u.stripeAccountId ? '✅' : '❌'}</strong></div>
              </div>
              {u.skills?.length > 0 && (
                <div className="aud-skills">
                  <h4>Skills</h4>
                  <div className="aud-tag-list">{u.skills.map((s, i) => <span key={i} className="aud-tag">{s}</span>)}</div>
                </div>
              )}
              {u.bio && <div className="aud-bio"><h4>Bio</h4><p>{u.bio}</p></div>}
            </div>
          )}

          {activeSection === 'jobs' && (
            <div>
              {data.jobsAsClient?.length > 0 && (
                <>
                  <h4 className="aud-list-title">Jobs Posted ({data.jobsAsClient.length})</h4>
                  {data.jobsAsClient.map(j => (
                    <div key={j._id} className="aud-list-item">
                      <a href={`/jobs/${j._id}`} target="_blank" rel="noopener noreferrer">{j.title}</a>
                      <div className="aud-list-meta">
                        <span className={`status ${j.status}`}>{j.status?.replace(/_/g, ' ')}</span>
                        <span>{formatBudget(j.budget)}</span>
                        <span>{j.category?.replace(/_/g, ' ')}</span>
                        <span>{new Date(j.createdAt).toLocaleDateString()}</span>
                        {j.freelancer && <span>→ {j.freelancer.firstName} {j.freelancer.lastName}</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {data.jobsAsFreelancer?.length > 0 && (
                <>
                  <h4 className="aud-list-title" style={{ marginTop: '1rem' }}>Jobs Worked ({data.jobsAsFreelancer.length})</h4>
                  {data.jobsAsFreelancer.map(j => (
                    <div key={j._id} className="aud-list-item">
                      <a href={`/jobs/${j._id}`} target="_blank" rel="noopener noreferrer">{j.title}</a>
                      <div className="aud-list-meta">
                        <span className={`status ${j.status}`}>{j.status?.replace(/_/g, ' ')}</span>
                        <span>{formatBudget(j.budget)}</span>
                        {j.client && <span>Client: {j.client.firstName} {j.client.lastName}</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {!data.jobsAsClient?.length && !data.jobsAsFreelancer?.length && (
                <p className="aud-empty">No jobs found</p>
              )}
            </div>
          )}

          {activeSection === 'portfolio' && (
            <div>
              {u.portfolio?.length > 0 ? (
                <div className="aud-portfolio">
                  {u.portfolio.map((p, i) => (
                    <div key={i} className="aud-portfolio-card">
                      {p.mediaUrls?.[0] && (
                        <a href={p.mediaUrls[0]} target="_blank" rel="noopener noreferrer">
                          <img src={p.mediaUrls[0]} alt={p.title} />
                        </a>
                      )}
                      <div className="aud-portfolio-body">
                        <h5>{p.title || `Item ${i + 1}`}</h5>
                        {p.description && <p>{p.description.substring(0, 200)}{p.description.length > 200 ? '...' : ''}</p>}
                        {p.links?.filter(Boolean).length > 0 && (
                          <div className="aud-portfolio-links">
                            {p.links.filter(Boolean).map((link, li) => (
                              <a key={li} href={link} target="_blank" rel="noopener noreferrer">{new URL(link).hostname}</a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="aud-empty">No portfolio items</p>}
            </div>
          )}

          {activeSection === 'services' && (
            <div>
              {data.services?.length > 0 ? data.services.map(s => (
                <div key={s._id} className="aud-list-item">
                  <span style={{ fontWeight: 500 }}>{s.title}</span>
                  <div className="aud-list-meta">
                    <span className={`status ${s.isActive ? 'active' : 'inactive'}`}>{s.isActive ? 'Active' : 'Inactive'}</span>
                    <span>{s.category?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              )) : <p className="aud-empty">No services</p>}
            </div>
          )}

          {activeSection === 'reviews' && (
            <div>
              {data.reviews?.length > 0 ? data.reviews.map(r => (
                <div key={r._id} className="aud-list-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500 }}>{'⭐'.repeat(Math.round(r.rating || 0))}</span>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  {r.comment && <p style={{ fontSize: '0.85rem', color: '#4b5563', margin: '0.25rem 0 0' }}>{r.comment}</p>}
                  <div className="aud-list-meta">
                    <span>From: {r.client?.firstName || r.freelancer?.firstName || 'Unknown'}</span>
                  </div>
                </div>
              )) : <p className="aud-empty">No reviews</p>}
            </div>
          )}

          {activeSection === 'actions' && (
            <div className="aud-actions-grid">
              <h4>Account</h4>
              {u.isSuspended ? (
                <button className="aud-action-btn success" onClick={handleUnsuspend} disabled={actionLoading === 'unsuspend'}>
                  ✅ Unsuspend Account
                </button>
              ) : (
                <button className="aud-action-btn warning" onClick={handleSuspend} disabled={actionLoading === 'suspend'}>
                  ⛔ Suspend Account
                </button>
              )}
              <button className="aud-action-btn danger" onClick={handleDelete} disabled={actionLoading === 'delete'}>
                🗑️ Delete Account
              </button>

              <h4>Roles</h4>
              {u.role === 'moderator' ? (
                <button className="aud-action-btn" onClick={handleRemoveMod} disabled={actionLoading === 'remove-mod'}>
                  🛡️ Remove Moderator
                </button>
              ) : (
                <button className="aud-action-btn primary" onClick={handleMakeMod} disabled={actionLoading === 'moderator'}>
                  🛡️ Make Moderator
                </button>
              )}
              {u.role !== 'admin' && (
                <button className="aud-action-btn" onClick={handlePromoteAdmin} disabled={actionLoading === 'admin'}>
                  👑 Promote to Admin
                </button>
              )}

              <h4>Fees</h4>
              <button className={`aud-action-btn ${isWaived ? 'warning' : 'success'}`} onClick={handleFeeWaiver} disabled={actionLoading === 'waiver'}>
                {isWaived ? '💔 Remove Fee Waiver' : '💚 Waive Fees (10 jobs / 30 days)'}
              </button>

              <h4>Communication</h4>
              <a href={`/messages?to=${u._id}`} className="aud-action-btn primary" target="_blank" rel="noopener noreferrer">
                💬 Send Message
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUserDrawer;
