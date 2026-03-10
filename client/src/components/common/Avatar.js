/**
 * Avatar component
 * Shows profile picture if available, otherwise a DiceBear generated avatar.
 * DiceBear is free, no API key, URL-based: https://api.dicebear.com
 *
 * Usage:
 *   <Avatar user={user} size={40} className="my-class" />
 *   <Avatar firstName="John" lastName="Doe" size={32} />
 */
import React, { useState } from 'react';

const DICEBEAR_STYLES = 'initials'; // clean initial-based avatars

function dicebearUrl(seed, size = 80) {
  const encoded = encodeURIComponent(seed || '?');
  return `https://api.dicebear.com/9.x/${DICEBEAR_STYLES}/svg?seed=${encoded}&size=${size}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&backgroundType=solid&fontSize=40&bold=true`;
}

const Avatar = ({
  user,
  firstName,
  lastName,
  profilePicture,
  size = 40,
  className = '',
  style = {},
  alt = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const first = firstName || user?.firstName || '';
  const last  = lastName  || user?.lastName  || '';
  const pic   = profilePicture || user?.profilePicture || '';
  const seed  = `${first} ${last}`.trim() || user?._id || 'user';

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'inline-block',
    flexShrink: 0,
    ...style,
  };

  if (pic && !imgFailed) {
    return (
      <img
        src={pic}
        alt={alt || `${first} ${last}`}
        className={className}
        style={baseStyle}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // Fallback: DiceBear initials avatar (SVG URL, no request on server side)
  return (
    <img
      src={dicebearUrl(seed, size * 2)} // 2× for retina
      alt={alt || `${first} ${last}`}
      className={className}
      style={baseStyle}
      loading="lazy"
    />
  );
};

export default Avatar;
