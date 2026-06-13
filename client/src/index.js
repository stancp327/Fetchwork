import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.REACT_APP_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  replaysOnErrorSampleRate: 1.0, // always replay on error
  replaysSessionSampleRate: 0.05, // 5% of sessions
  integrations: [
    Sentry.replayIntegration(),
  ],
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ── Auto-reload on stale chunk errors after deploys ─────────────
// When a new deploy changes chunk hashes, cached main.js references
// old chunks that no longer exist. Catch and reload once.
window.addEventListener('error', (e) => {
  if (e.message && /Loading chunk .* failed/i.test(e.message)) {
    const reloaded = sessionStorage.getItem('chunk_reload');
    if (!reloaded) {
      sessionStorage.setItem('chunk_reload', '1');
      window.location.reload();
    }
  }
});
// Clear the flag on successful load so future deploys can trigger reload
sessionStorage.removeItem('chunk_reload');
