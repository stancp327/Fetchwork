import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getApiBaseUrl } from '../../utils/api';
import './Profile.css';

const PublicProfile = () => {
  const { username } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const resp = await fetch(`${getApiBaseUrl()}/api/public-profiles/${encodeURIComponent(username)}`);
        if (!resp.ok) throw new Error('Not found');
        const json = await resp.json();
        setData(json);
      } catch (e) {
        setErr('Profile not found');
      }
    };
    run();
  }, [username]);

  if (err) return <div className="profile-container"><div className="error-message">{err}</div></div>;
  if (!data) return <div className="profile-container"><div className="loading">Loading profile...</div></div>;

  return (
    <div className="profile-container">
      {data.bannerUrl && (
        <div className="profile-banner" style={{ backgroundImage: `url(${data.bannerUrl})` }} />
      )}
      <div className="profile-header">
        <img src={data.profilePicture} alt="" className="profile-avatar" />
        <div>
          <h1>{data.firstName} {data.lastName}</h1>
          <p>{data.headline || data.tagline}</p>
          <div className="skills-list">
            {(data.skills || []).map((s, i) => <span key={i} className="skill-tag">{s}</span>)}
          </div>
        </div>
      </div>
      {data.bio && (
        <div className="profile-section">
          <h2>About</h2>
          <p>{data.bio}</p>
        </div>
      )}
      {Array.isArray(data.portfolio) && data.portfolio.length > 0 && (
        <div className="profile-section">
          <h2>Portfolio</h2>
          <div className="gallery-grid">
            {data.portfolio.flatMap((p, idx) =>
              (p.mediaUrls || []).map((url, i) => {
                const lower = String(url).toLowerCase();
                const isVideo = lower.endsWith('.mp4') || lower.endsWith('.mov');
                return (
                  <a key={`${idx}-${i}`} href={url} target="_blank" rel="noreferrer">
                    {isVideo ? (
                      <video src={url} controls style={{ width: '100%', height: 'auto' }} />
                    ) : (
                      <img src={url} alt={p.title || 'Portfolio'} />
                    )}
                  </a>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicProfile;
