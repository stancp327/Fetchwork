import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import './TeamMembersPanel.css';

export default function JoinTeam() {
  const { code } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | ready | joining | success | error
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) { setStatus('ready'); return; }
    setStatus('ready');
  }, [user]);

  const handleJoin = async () => {
    if (!user) { navigate(`/login?redirect=/teams/join/${code}`); return; }
    setStatus('joining');
    setError('');
    try {
      const data = await apiRequest(`/api/teams/join/${code}`, { method: 'POST', body: JSON.stringify({}) });
      setMessage(data.message || 'Successfully joined the team!');
      setStatus('success');
      if (data.teamId) {
        setTimeout(() => navigate(`/teams/${data.teamId}`), 2000);
      }
    } catch (err) {
      setError(err.message || 'Failed to join team');
      setStatus('error');
    }
  };

  return (
    <div className="tmp-join-page">
      <div className="tmp-join-card">
        <h2>🤝 Join Team</h2>
        {status === 'loading' && <p>Loading…</p>}

        {status === 'ready' && (
          <>
            <p>You've been invited to join a team on FetchWork.</p>
            {!user && <p className="tmp-join-note">You'll need to log in or create an account first.</p>}
            <button className="tmp-btn tmp-btn--primary tmp-join-btn" onClick={handleJoin}>
              {user ? 'Join Team' : 'Log in to Join'}
            </button>
          </>
        )}

        {status === 'joining' && <p>Joining team…</p>}

        {status === 'success' && (
          <div className="tmp-join-success">
            <p>✅ {message}</p>
            <p className="tmp-join-note">Redirecting to team page…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="tmp-join-error">
            <p>❌ {error}</p>
            <div className="tmp-join-actions">
              <button className="tmp-btn tmp-btn--primary" onClick={handleJoin}>Try Again</button>
              <Link to="/teams" className="tmp-btn tmp-btn--secondary">Go to Teams</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
