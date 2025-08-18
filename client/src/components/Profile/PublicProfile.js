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
        {data.profilePicture ? <img src={data.profilePicture} alt="" className="profile-avatar" /> : null}
        <div>
          <h1>{data.firstName} {data.lastName}</h1>
          <p>{data.headline || data.tagline}</p>
          <div className="skills-list">
            {(data.skills || []).map((s, i) => <span key={i} className="skill-tag">{s}</span>)}
          </div>
          <div className="profile-stats">
            <span className="stat-badge">⭐ {Number(data.rating || 0).toFixed(1)}</span>
            <span className="stat-badge">✓ {data.completedJobs || 0} jobs</span>
          </div>

        </div>
      </div>

      {data.bio && (
        <div className="profile-section">
          <h2>About</h2>
          <p>{data.bio}</p>
        </div>
      )}

      {Array.isArray(data.languages) && data.languages.length > 0 && (
        <div className="profile-section">
          <h2>Languages</h2>
          <ul className="list">
            {data.languages.map((l, idx) => (
              <li key={idx}>{l.name} — {l.level}</li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(data.experience) && data.experience.length > 0 && (
        <div className="profile-section">
          <h2>Experience</h2>
          <ul className="list">
            {data.experience.map((e, idx) => (
              <li key={idx}>
                <strong>{e.role}</strong> at {e.company}
                <div className="muted">{e.startDate} — {e.endDate}</div>
                {e.description && <div>{e.description}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(data.education) && data.education.length > 0 && (
        <div className="profile-section">
          <h2>Education</h2>
          <ul className="list">
            {data.education.map((ed, idx) => (
              <li key={idx}>
                <strong>{ed.degree}</strong> at {ed.school}
                <div className="muted">{ed.startDate} — {ed.endDate}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(data.certifications) && data.certifications.length > 0 && (
        <div className="profile-section">
          <h2>Certifications</h2>
          <ul className="list">
            {data.certifications.map((c, idx) => (
              <li key={idx}>
                <strong>{c.name}</strong> — {c.issuer}
                {c.credentialUrl ? (
                  <div><a href={c.credentialUrl} target="_blank" rel="noreferrer">View credential</a></div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(data.portfolio) && data.portfolio.length > 0 && (
        <div className="profile-section">
          <h2>Portfolio</h2>
          <div className="gallery-grid">
            {data.portfolio.map((p, idx) => (
              <div key={idx} className="gallery-item">
                <div className="gallery-media">
                  {(p.mediaUrls || []).map((url, i) => {
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
                  })}
                </div>
                {(p.title || p.description) && (
                  <div className="gallery-meta">
                    {p.title && <div className="title">{p.title}</div>}
                    {p.description && <div className="desc">{p.description}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicProfile;
