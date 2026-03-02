import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './Contracts.css';

const CreateContract = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillFreelancer = searchParams.get('freelancerId');
  const prefillJob = searchParams.get('jobId');

  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('standard_service');
  const [title, setTitle] = useState('');
  const [freelancerId, setFreelancerId] = useState(prefillFreelancer || '');
  const [freelancerSearch, setFreelancerSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [terms, setTerms] = useState({
    scope: '', compensation: '', paymentTerms: 'Upon completion',
    startDate: '', endDate: '', ndaDuration: '2 years',
    jurisdiction: '', terminationClause: ''
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiRequest('/api/contracts/templates').then(d => setTemplates(d.templates || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!freelancerSearch || freelancerSearch.length < 2) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      try {
        const data = await apiRequest(`/api/users/search?q=${encodeURIComponent(freelancerSearch)}&limit=5`);
        setSearchResults(data.users || []);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [freelancerSearch]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!freelancerId) return alert('Please select a freelancer');
    setCreating(true);
    try {
      const contract = await apiRequest('/api/contracts', {
        method: 'POST',
        body: JSON.stringify({
          template: selectedTemplate,
          title: title || templates.find(t => t.id === selectedTemplate)?.title || 'Service Agreement',
          freelancerId,
          jobId: prefillJob || undefined,
          terms,
        }),
      });
      navigate(`/contracts/${contract._id}`);
    } catch (err) {
      alert(err.message || 'Failed to create contract');
    } finally { setCreating(false); }
  };

  return (
    <div className="contracts-container">
      <SEO title="Create Contract" noIndex />
      <button className="contract-back-btn" onClick={() => navigate('/contracts')}>← Back</button>
      <h1 style={{ marginBottom: '1.5rem' }}>Create Contract</h1>

      <form className="contract-form" onSubmit={handleCreate}>
        <div className="contract-form-section">
          <h3>Template</h3>
          <div className="template-options">
            {templates.map(t => (
              <button key={t.id} type="button"
                className={`template-option ${selectedTemplate === t.id ? 'selected' : ''}`}
                onClick={() => { setSelectedTemplate(t.id); if (!title) setTitle(t.title); }}>
                {t.id === 'nda' ? '🔒' : t.id === 'non_compete' ? '🚫' : '📋'} {t.title}
              </button>
            ))}
          </div>
        </div>

        <div className="contract-form-section">
          <h3>Contract Details</h3>
          <label>Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Website Development Agreement" className="contract-input" />

          <label>Freelancer</label>
          {freelancerId ? (
            <div className="selected-freelancer">
              <span>✅ Freelancer selected</span>
              <button type="button" onClick={() => { setFreelancerId(''); setFreelancerSearch(''); }}>Change</button>
            </div>
          ) : (
            <>
              <input type="text" value={freelancerSearch} onChange={e => setFreelancerSearch(e.target.value)}
                placeholder="Search by name or email..." className="contract-input" />
              {searchResults.length > 0 && (
                <div className="freelancer-results">
                  {searchResults.map(u => (
                    <button key={u._id} type="button" className="freelancer-result"
                      onClick={() => { setFreelancerId(u._id); setFreelancerSearch(`${u.firstName} ${u.lastName}`); setSearchResults([]); }}>
                      {u.firstName} {u.lastName} — {u.email}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="contract-form-section">
          <h3>Terms</h3>
          <label>Scope of Work</label>
          <textarea value={terms.scope} onChange={e => setTerms(p => ({ ...p, scope: e.target.value }))}
            placeholder="Describe the work to be performed..." className="contract-textarea" rows={3} />

          <div className="contract-form-row">
            <div>
              <label>Compensation ($)</label>
              <input type="number" value={terms.compensation} onChange={e => setTerms(p => ({ ...p, compensation: e.target.value }))}
                placeholder="0.00" className="contract-input" min="0" step="0.01" />
            </div>
            <div>
              <label>Payment Terms</label>
              <select value={terms.paymentTerms} onChange={e => setTerms(p => ({ ...p, paymentTerms: e.target.value }))} className="contract-input">
                <option>Upon completion</option>
                <option>Net 15</option>
                <option>Net 30</option>
                <option>50% upfront, 50% on completion</option>
                <option>Milestone-based</option>
              </select>
            </div>
          </div>

          <div className="contract-form-row">
            <div>
              <label>Start Date</label>
              <input type="date" value={terms.startDate} onChange={e => setTerms(p => ({ ...p, startDate: e.target.value }))} className="contract-input" />
            </div>
            <div>
              <label>End Date</label>
              <input type="date" value={terms.endDate} onChange={e => setTerms(p => ({ ...p, endDate: e.target.value }))} className="contract-input" />
            </div>
          </div>

          {(selectedTemplate === 'nda' || selectedTemplate === 'non_compete') && (
            <div>
              <label>NDA/Non-Compete Duration</label>
              <select value={terms.ndaDuration} onChange={e => setTerms(p => ({ ...p, ndaDuration: e.target.value }))} className="contract-input">
                <option>1 year</option>
                <option>2 years</option>
                <option>3 years</option>
                <option>5 years</option>
                <option>Indefinite</option>
              </select>
            </div>
          )}

          <label>Jurisdiction</label>
          <input type="text" value={terms.jurisdiction} onChange={e => setTerms(p => ({ ...p, jurisdiction: e.target.value }))}
            placeholder="e.g. State of California" className="contract-input" />
        </div>

        <button type="submit" className="contract-action-btn primary" disabled={creating || !freelancerId}>
          {creating ? 'Creating...' : '📋 Create Contract'}
        </button>
      </form>
    </div>
  );
};

export default CreateContract;
