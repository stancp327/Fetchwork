/**
 * Avatar component
 * Priority: profilePicture → Gravatar (from email) → DiceBear initials
 *
 * - Gravatar: gravatar.com — free, no key. Pulls real photo from email hash.
 *   Millions of users already have one (GitHub, WordPress, Slack all use it).
 * - DiceBear: api.dicebear.com — free, no key. Generated initials avatar.
 *
 * Usage:
 *   <Avatar user={user} size={40} />
 *   <Avatar firstName="John" lastName="Doe" email="j@example.com" size={32} />
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// Gravatar requires MD5 of the lowercase email.
// We compute it via a server-side proxy to avoid shipping a crypto library to the client.
// /api/geo/gravatar-hash?email=... returns { hash } — lightweight, cached at edge.
// Fallback: skip Gravatar if email unavailable.
function gravatarUrl(email, size = 80) {
  if (!email) return null;
  // Use the new /api/geo/gravatar-hash endpoint (returns MD5)
  // We pass the email; the server returns the correct MD5 hash as a redirect URL
  // For simplicity we use the server as a proxy to avoid client-side MD5 deps
  const encoded = encodeURIComponent(email.trim().toLowerCase());
  return `/api/geo/gravatar-img?email=${encoded}&size=${size}`;
}

function dicebearUrl(seed, size = 80) {
  const encoded = encodeURIComponent(seed || '?');
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encoded}&size=${size}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&backgroundType=solid&fontSize=40&bold=true`;
}

const Avatar = ({
  user,
  firstName,
  lastName,
  email,
  profilePicture,
  size = 40,
  className = '',
  style = {},
  alt = '',
  userId,
}) => {
  const [step, setStep] = useState(0); // 0=pic, 1=gravatar, 2=dicebear

  const first = firstName || user?.firstName || '';
  const last  = lastName  || user?.lastName  || '';
  const pic   = profilePicture || user?.profilePicture || '';
  const mail  = email || user?.email || '';
  const seed  = `${first} ${last}`.trim() || user?._id || 'user';

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'inline-block',
    flexShrink: 0,
    background: '#e2e8f0',
    ...style,
  };

  const sources = [
    pic   ? pic                           : null,
    mail  ? gravatarUrl(mail, size * 2)   : null,
    dicebearUrl(seed, size * 2),
  ].filter(Boolean);

  const src = sources[step] || sources[sources.length - 1];
  const webpSrc = pic && pic.includes('/webp/') ? pic : '/webp/default-avatar.webp';
  const resolvedUserId = userId || user?._id || user?.id;

  const picture = (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img
        src={src}
        alt={alt || `${first} ${last}`.trim() || 'User'}
        className={className}
        style={baseStyle}
        loading="lazy"
        onError={() => setStep(s => Math.min(s + 1, sources.length - 1))}
      />
    </picture>
  );

  if (resolvedUserId) {
    return (
      <Link
        to={`/freelancers/${resolvedUserId}`}
        style={{ display: 'inline-flex', flexShrink: 0, borderRadius: '50%', outline: 'none' }}
        title={`${first} ${last}`.trim() || 'View profile'}
        onClick={e => e.stopPropagation()}
      >
        {picture}
      </Link>
    );
  }

  return picture;
};

export default Avatar;
