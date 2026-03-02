import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../utils/api';

const AdminTeamsTab = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/admin/teams');
      setTeams(data.teams || []);
    } catch (err) {
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTeams(); }, []);

  if (loading) return <div style={{ padding: '1rem' }}>Loading teams…</div>;

  return (
    <div>
      <h2>Teams</h2>
      {teams.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No teams found.</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {teams.map((team) => (
            <div key={team._id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.75rem 1rem', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{team.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    {team.type === 'agency' ? 'Agency' : 'Client Team'} · Owner: {team.owner?.firstName} {team.owner?.lastName}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#374151' }}>
                  <div>{team.activeMembers || 0} active members</div>
                  <div>Created {new Date(team.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminTeamsTab;
