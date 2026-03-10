/**
 * ShareQR
 * Shows a share bar with copy-link + QR code via api.qrserver.com (free, no key).
 * QR image is just an <img> — zero backend needed.
 *
 * Usage:
 *   <ShareQR url="https://fetchwork.net/services/123" title="My Service" />
 */
import React, { useState } from 'react';
import './ShareQR.css';

const ShareQR = ({ url, title = '' }) => {
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullUrl = url.startsWith('http') ? url : `https://fetchwork.net${url}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(fullUrl)}&size=200x200&margin=10&color=111111&bgcolor=ffffff`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('input');
      el.value = fullUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const nativeShare = () => {
    if (navigator.share) {
      navigator.share({ title, url: fullUrl }).catch(() => {});
    }
  };

  return (
    <div className="share-qr">
      <button className="share-btn" onClick={copy} title="Copy link">
        {copied ? '✓ Copied!' : '🔗 Copy link'}
      </button>

      {navigator.share && (
        <button className="share-btn" onClick={nativeShare} title="Share">
          📤 Share
        </button>
      )}

      <button
        className={`share-btn${qrOpen ? ' share-btn--active' : ''}`}
        onClick={() => setQrOpen(o => !o)}
        title="Show QR code"
      >
        ▦ QR code
      </button>

      {qrOpen && (
        <div className="share-qr-panel">
          <p className="share-qr-label">Scan to open</p>
          <img src={qrSrc} alt="QR code" className="share-qr-img" loading="lazy" />
          <a href={qrSrc} download="fetchwork-qr.png" className="share-qr-download">
            ⬇ Download
          </a>
        </div>
      )}
    </div>
  );
};

export default ShareQR;
