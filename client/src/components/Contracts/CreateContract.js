import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useFeatures } from '../../hooks/useFeatures';
import SEO from '../common/SEO';
import './Contracts.css';

const CHECKLIST_ITEMS = [
  'Scope of work clearly defined',
  'Payment schedule (upfront deposit, milestones, or upon completion)',
  'Intellectual property ownership',
  'Confidentiality / NDA',
  'Cancellation and termination policy',
  'Revision and correction policy',
  'Timeline and deadlines',
  'Dispute resolution process',
  'Tools and equipment responsibilities',
  'Travel or on-site requirements',
];

const CreateContract = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillFreelancer = searchParams.get('freelancerId');
  const prefillJob = searchParams.get('jobId');
  const { hasFeature } = useFeatures();
  const canAI = hasFeature('ai_job_description');

  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('standard_service');
  const [title, setTitle] = useState('');
  const [freelancerId, setFreelancerId] = useState(prefillFreelancer || '');
  const [freelancerSearch, setFreelancerSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [myRole, setMyRole] = useState('client'); // 'client' or 'freelancer'
  const [concerns, setConcerns] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [tools, setTools] = useState('');
  const [terms, setTerms] = useState({
    scope: '', compensation: '', paymentTerms: 'Upon completion',
    startDate: '', endDate: '', ndaDuration: '2 years',
    jurisdiction: '', terminationClause: ''
  });
  const [creating, setCreating] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMilestones, setAiMilestones] = useState([]);
  const [aiMsLoading, setAiMsLoading] = useState(false);
  const [selectedMs, setSelectedMs] = useState(new Set());
  // After creation, we need the contract ID for AI generation
  const [createdContractId, setCreatedContractId] = useState(null);
  const [aiPreview, setAiPreview] = useState(null);

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

  const toggleChecklist = (item) => {
    setChecklist(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const handleSuggestMilestones = async () => {
    setAiMsLoading(true);
    try {
      const data = await apiRequest('/api/ai/suggest-milestones', {
        method: 'POST',
        body: JSON.stringify({
          title: title || 'Service Agreement',
          description: terms.scope || concerns,
          budget: Number(terms.compensation) || 0,
          duration: terms.endDate && terms.startDate
            ? `${Math.ceil((new Date(terms.endDate) - new Date(terms.startDate)) / 86400000)} days`
            : undefined,
          category: selectedTemplate,
        }),
      });
      setAiMilestones(data.milestones || []);
      setSelectedMs(new Set(data.milestones?.map((_, i) => i) || []));
    } catch (err) {
      if (err.status === 403) alert('AI Milestone Suggestions is a Pro feature.');
      else alert('Could not suggest milestones — try again shortly.');
    } finally { setAiMsLoading(false); }
  };

  // Step 1: Create the draft contract, then trigger AI generation
  const handleCreateAndGenerate = async (e) => {
    e.preventDefault();
    if (!freelancerId) return alert('Please select a freelancer');
    if (!canAI) { alert('AI contract generation requires a Plus plan or above.'); return; }
    setAiGenerating(true);
    try {
      // Create draft first
      const contract = await apiRequest('/api/contracts', {
        method: 'POST',
        body: JSON.stringify({
          template: selectedTemplate,
          title: title || templates.find(t => t.id === selectedTemplate)?.title || 'Service Agreement',
          freelancerId,
          myRole,
          jobId: prefillJob || undefined,
          terms,
          concerns,
          checklist,
          tools,
        }),
      });
      // Now AI-generate the content
      const generated = await apiRequest(`/api/contracts/${contract._id}/ai-generate`, { method: 'POST' });
      setCreatedContractId(contract._id);
      setAiPreview(generated.content);
    } catch (err) {
      alert(err.message || 'Failed to generate contract');
    } finally { setAiGenerating(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!freelancerId) return alert(`Please select a ${myRole === 'client' ? 'freelancer' : 'client'}`);
    setCreating(true);
    try {
      const contract = await apiRequest('/api/contracts', {
        method: 'POST',
        body: JSON.stringify({
          template: selectedTemplate,
          title: title || templates.find(t => t.id === selectedTemplate)?.title || 'Service Agreement',
          freelancerId,
          myRole,
          jobId: prefillJob || undefined,
          terms,
          concerns,
          checklist,
          tools,
        }),
      });
      navigate(`/contracts/${contract._id}`);
    } catch (err) {
      alert(err.message || 'Failed to create contract');
    } finally { setCreating(false); }
  };

  if (aiPreview && createdContractId) {
    return (
      <div className="contracts-container">
        <SEO title="Review Generated Contract" noIndex />
        <h1 style={{ marginBottom: '1rem' }}>📄 Review AI-Generated Contract</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Review the generated contract below. You can request changes on the next page.
        </p>
        <div className="contract-ai-preview">
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 }}>{aiPreview}</pre>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button
            className="contract-action-btn primary"
            onClick={() => navigate(`/contracts/${createdContractId}`)}
          >
            ✅ Looks Good — View Contract
          </button>
          <button
            className="contract-action-btn"
            onClick={() => { setAiPreview(null); setCreatedContractId(null); }}
          >
            ← Back to Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="contracts-container">
      <SEO title="Create Contract" noIndex />
      <button className="contract-back-btn" onClick={() => navigate('/contracts')}>← Back</button>
      <h1 style={{ marginBottom: '1.5rem' }}>Create Contract</h1>

      <form className="contract-form" onSubmit={handleCreate}>
        {/* ── Concerns & Checklist ── */}
        <div className="contract-form-section">
          <h3>Your Concerns <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>(optional — helps AI draft a better contract)</span></h3>
          <textarea
            value={concerns}
            onChange={e => setConcerns(e.target.value)}
            placeholder="What are you most concerned about with this job? E.g. payment timing, scope creep, IP ownership, client going dark..."
            className="contract-textarea"
            rows={3}
          />

          <label style={{ marginTop: '1rem', display: 'block', fontWeight: 600 }}>What should this contract cover?</label>
          <div className="contract-checklist">
            {CHECKLIST_ITEMS.map(item => (
              <label key={item} className={`checklist-item ${checklist.includes(item) ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={checklist.includes(item)}
                  onChange={() => toggleChecklist(item)}
                />
                {item}
              </label>
            ))}
          </div>
        </div>

        {/* ── Template ── */}
        <div className="contract-form-section">
          <h3>Template</h3>
          <div className="template-options">
            {templates.map(t => (
              <button key={t.id} type="button"
                className={`template-option ${selectedTemplate === t.id ? 'selected' : ''}`}
                onClick={() => { setSelectedTemplate(t.id); if (!title) setTitle(t.title); }}>
                {t.id === 'nda' ? '🤐' : t.id === 'non_compete' ? '🔒' : '📄'} {t.title}
              </button>
            ))}
          </div>
        </div>

        {/* ── Contract Details ── */}
        <div className="contract-form-section">
          <h3>Contract Details</h3>
          <label>Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Website Development Agreement" className="contract-input" />

          <label>I am the</label>
          <div className="contract-role-toggle">
            <button type="button" className={`contract-role-btn${myRole === 'client' ? ' active' : ''}`} onClick={() => setMyRole('client')}>👤 Client (hiring)</button>
            <button type="button" className={`contract-role-btn${myRole === 'freelancer' ? ' active' : ''}`} onClick={() => setMyRole('freelancer')}>🛠 Freelancer (doing the work)</button>
          </div>
          <p className="contract-input-hint">{myRole === 'client' ? 'You are hiring someone to complete work for you.' : 'You are the one completing work for a client.'}</p>

          <label>{myRole === 'client' ? 'Freelancer' : 'Client'}</label>
          {freelancerId ? (
            <div className="selected-freelancer">
              <span>✅ {myRole === 'client' ? 'Freelancer' : 'Client'} selected</span>
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

        {/* ── Terms ── */}
        <div className="contract-form-section">
          <h3>Terms</h3>
          <label>Scope of Work</label>
          <textarea value={terms.scope} onChange={e => setTerms(p => ({ ...p, scope: e.target.value }))}
            placeholder="Describe the work to be performed..." className="contract-textarea" rows={3} />

          <div className="cc-ai-ms-wrap">
            <button type="button" className="cc-ai-ms-btn" onClick={handleSuggestMilestones} disabled={aiMsLoading}>
              {aiMsLoading ? '⏳ Generating…' : '🤖 Suggest Milestones'}
            </button>
            {aiMilestones.length > 0 && (
              <div className="cc-ai-ms-list">
                {aiMilestones.map((ms, i) => (
                  <label key={i} className={`cc-ai-ms-card ${selectedMs.has(i) ? 'selected' : ''}`}>
                    <input
                      type="checkbox" checked={selectedMs.has(i)}
                      onChange={() => setSelectedMs(prev => {
                        const next = new Set(prev);
                        next.has(i) ? next.delete(i) : next.add(i);
                        return next;
                      })}
                    />
                    <div className="cc-ai-ms-info">
                      <div className="cc-ai-ms-title">{ms.title}</div>
                      <div className="cc-ai-ms-desc">{ms.description}</div>
                      <div className="cc-ai-ms-meta">
                        <span>{ms.percentage}% of budget</span>
                        <span>~{ms.estimatedDays} days</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

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
                <option>Job acceptance (deposit)</option>
                <option>50% upfront, 50% on completion</option>
                <option>Milestone-based</option>
                <option>Net 15</option>
                <option>Net 30</option>
              </select>
              <p className="contract-input-hint">{({
                'Upon completion':             'Full payment released once all work is delivered and approved.',
                'Job acceptance (deposit)':    'Client pays a deposit upfront when accepting the job; remainder due on completion.',
                '50% upfront, 50% on completion': 'Half paid at the start, half paid when the project is finished.',
                'Milestone-based':             'Payment is split across agreed milestones — each released as work is approved.',
                'Net 15':                      'Full invoice due within 15 days of project completion.',
                'Net 30':                      'Full invoice due within 30 days of project completion.',
              })[terms.paymentTerms]}</p>
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
              <p className="contract-input-hint">How long the freelancer agrees to keep your information confidential and not compete with your business. "Indefinite" means the obligation never expires. For most projects, 1–2 years is standard.</p>
            </div>
          )}

          <label>Jurisdiction</label>
          <input type="text" value={terms.jurisdiction} onChange={e => setTerms(p => ({ ...p, jurisdiction: e.target.value }))}
            placeholder="e.g. State of California" className="contract-input" />
          <p className="contract-input-hint">The state or country whose laws govern this contract. If there's ever a dispute, this determines which court system handles it. Use your state/country if unsure — e.g. "State of California" or "United Kingdom".</p>

          <label style={{ marginTop: '1rem' }}>Tools / Equipment</label>
          <select
            value={tools}
            onChange={e => setTools(e.target.value)}
            className="contract-input"
          >
            <option value="">Not specified</option>
            <option value="Freelancer must bring own tools">Freelancer must bring own tools</option>
            <option value="Tools provided by client">Tools provided by client</option>
            <option value="Some tools provided — see scope">Some tools provided — see scope</option>
            <option value="Remote work — no tools required">Remote work — no tools required</option>
          </select>
        </div>

        {/* ── Actions ── */}
        <div className="contract-create-actions">
          {canAI ? (
            <button
              type="button"
              className="contract-action-btn ai-btn"
              disabled={aiGenerating || !freelancerId}
              onClick={handleCreateAndGenerate}
            >
              {aiGenerating ? '⏳ Generating…' : '🤖 Generate with AI'}
            </button>
          ) : (
            <div className="contract-ai-upsell">
              🤖 <strong>AI Contract Generation</strong> — upgrade to Plus to let AI draft the contract from your concerns.
            </div>
          )}
          <button type="submit" className="contract-action-btn primary" disabled={creating || !freelancerId}>
            {creating ? 'Creating...' : '📄 Create from Template'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateContract;
