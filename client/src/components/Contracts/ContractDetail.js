import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import SEO from '../common/SEO';
import './Contracts.css';

const ContractDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signName, setSignName] = useState('');
  const [signing, setSigning] = useState(false);
  const [sending, setSending] = useState(false);

  const userId = user?._id || user?.id;

  useEffect(() => {
    apiRequest(`/api/contracts/${id}`)
      .then(data => setContract(data))
      .catch(() => navigate('/contracts'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleSend = async () => {
    setSending(true);
    try {
      const data = await apiRequest(`/api/contracts/${id}/send`, { method: 'POST' });
      setContract(data.contract);
    } catch (err) {
      alert(err.message || 'Failed to send contract');
    } finally { setSending(false); }
  };

  const handleSign = async (e) => {
    e.preventDefault();
    if (!signName.trim()) return;
    setSigning(true);
    try {
      const data = await apiRequest(`/api/contracts/${id}/sign`, {
        method: 'POST',
        body: JSON.stringify({ name: signName.trim() }),
      });
      setContract(data.contract);
      setSignName('');
    } catch (err) {
      alert(err.message || 'Failed to sign contract');
    } finally { setSigning(false); }
  };

  const handleCancel = async () => {
    const reason = window.prompt('Reason for cancellation (optional):');
    if (reason === null) return;
    try {
      const data = await apiRequest(`/api/contracts/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setContract(data.contract);
    } catch (err) {
      alert(err.message || 'Failed to cancel');
    }
  };

  if (loading) return <div className="contracts-container"><div className="contracts-loading">Loading...</div></div>;
  if (!contract) return null;

  const isCreator = contract.createdBy === userId || contract.createdBy?._id === userId;
  const mySigned = contract.signatures?.some(s => (s.user?._id || s.user) === userId);
  const canSign = (contract.status === 'pending' || contract.status === 'active') && !mySigned;
  const canSend = contract.status === 'draft' && isCreator;
  const canCancel = !['cancelled', 'completed'].includes(contract.status);

  return (
    <div className="contracts-container">
      <SEO title={contract.title} noIndex />
      <button className="contract-back-btn" onClick={() => navigate('/contracts')}>← Back to Contracts</button>

      <div className="contract-detail-card">
        <div className="contract-detail-header">
          <h1>{contract.title}</h1>
          <span className={`contract-status-pill ${contract.status}`}>{contract.status}</span>
        </div>

        <div className="contract-parties">
          <div className="contract-party">
            <label>Client</label>
            <span>{contract.client?.firstName} {contract.client?.lastName}</span>
          </div>
          <div className="contract-party">
            <label>Freelancer</label>
            <span>{contract.freelancer?.firstName} {contract.freelancer?.lastName}</span>
          </div>
          {contract.job && (
            <div className="contract-party">
              <label>Job</label>
              <span>{contract.job.title}</span>
            </div>
          )}
        </div>

        <div className="contract-content" dangerouslySetInnerHTML={{
          __html: contract.content?.replace(/\n/g, '<br>').replace(/^# (.*)/gm, '<h2>$1</h2>').replace(/^## (.*)/gm, '<h3>$1</h3>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        }} />

        {/* Signatures */}
        <div className="contract-signatures">
          <h3>Signatures</h3>
          {contract.signatures?.length > 0 ? (
            contract.signatures.map((sig, i) => (
              <div key={i} className="contract-signature">
                <div className="signature-name">{sig.name}</div>
                <div className="signature-meta">
                  {sig.user?.firstName} {sig.user?.lastName} — Signed {new Date(sig.signedAt).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <p className="contract-no-signatures">No signatures yet</p>
          )}
        </div>

        {/* Actions */}
        <div className="contract-actions">
          {canSend && (
            <button className="contract-action-btn primary" onClick={handleSend} disabled={sending}>
              {sending ? 'Sending...' : '📩 Send for Signing'}
            </button>
          )}

          {canSign && (
            <form className="contract-sign-form" onSubmit={handleSign}>
              <p className="sign-instruction">Type your full legal name to sign this contract:</p>
              <input
                type="text" value={signName} onChange={e => setSignName(e.target.value)}
                placeholder="Your full name" className="sign-input" required minLength={2}
              />
              <button type="submit" className="contract-action-btn success" disabled={signing || signName.trim().length < 2}>
                {signing ? 'Signing...' : '✍️ Sign Contract'}
              </button>
            </form>
          )}

          {canCancel && (
            <button className="contract-action-btn danger" onClick={handleCancel}>
              Cancel Contract
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractDetail;
