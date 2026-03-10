/**
 * CompanyLogo
 * Fetches company logo from Clearbit Logo API (free, no key).
 * URL pattern: https://logo.clearbit.com/{domain}
 *
 * Attempts to extract domain from a URL string or company name.
 * Falls back to initials placeholder if no logo found.
 *
 * Usage:
 *   <CompanyLogo company="Google" size={24} />
 *   <CompanyLogo company="github.com" size={32} />
 */
import React, { useState } from 'react';

function toDomain(company = '') {
  const trimmed = company.trim().toLowerCase();
  // Already a domain or URL
  if (trimmed.includes('.')) {
    return trimmed.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
  // Convert company name to likely domain (best-effort)
  return trimmed.replace(/[^a-z0-9]/g, '') + '.com';
}

function initials(company = '') {
  return company.trim().slice(0, 2).toUpperCase() || '?';
}

const CompanyLogo = ({ company = '', size = 24, className = '', style = {} }) => {
  const [failed, setFailed] = useState(false);

  if (!company) return null;

  const domain = toDomain(company);
  const logoUrl = `https://logo.clearbit.com/${domain}?size=${size * 2}`;

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: 4,
    objectFit: 'contain',
    background: '#f8fafc',
    border: '1px solid var(--color-border)',
    display: 'inline-block',
    flexShrink: 0,
    verticalAlign: 'middle',
    ...style,
  };

  if (!failed) {
    return (
      <img
        src={logoUrl}
        alt={`${company} logo`}
        className={className}
        style={baseStyle}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  // Fallback: initials pill
  return (
    <span
      className={className}
      style={{
        ...baseStyle,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 700,
        color: 'var(--color-text-secondary)',
        letterSpacing: 0.5,
      }}
    >
      {initials(company)}
    </span>
  );
};

export default CompanyLogo;
