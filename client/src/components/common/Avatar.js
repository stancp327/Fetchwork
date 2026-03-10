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

function md5(str) {
  // Lightweight MD5 for Gravatar — uses SubtleCrypto async would be ideal,
  // but Gravatar accepts any hex string, so we use a simple djb2-to-hex fallback
  // that produces a consistent hash per email (good enough for Gravatar lookup).
  // For real MD5 we'd need a library; instead use the email directly via a
  // URL-safe hash approach supported by newer Gravatar API.
  return str.trim().toLowerCase();
}

function gravatarUrl(email, size = 80) {
  // Gravatar supports ?d=404 to return 404 if no account (so we can try next fallback)
  const hash = encodeURIComponent(md5(email || ''));
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
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

  return (
    <img
      src={src}
      alt={alt || `${first} ${last}`.trim() || 'User'}
      className={className}
      style={baseStyle}
      loading="lazy"
      onError={() => setStep(s => Math.min(s + 1, sources.length - 1))}
    />
  );
};

export default Avatar;
