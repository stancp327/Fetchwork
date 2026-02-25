import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Lightweight client-side page view tracker
// Sends a beacon to the backend on each route change
const usePageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Fire and forget — don't await, don't handle errors
    const path = location.pathname;
    try {
      const API_URL = process.env.REACT_APP_API_URL || '';
      // Use sendBeacon for non-blocking, survives page unload
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `${API_URL}/api/analytics/track`,
          new Blob([JSON.stringify({ path })], { type: 'application/json' })
        );
      } else {
        fetch(`${API_URL}/api/analytics/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
          keepalive: true
        }).catch(() => {}); // Silent
      }
    } catch (e) { /* never break the app */ }
  }, [location.pathname]);
};

export default usePageTracker;
