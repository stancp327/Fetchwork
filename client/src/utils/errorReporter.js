import { getApiBaseUrl } from './api';

const reportError = async (errorData) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return; // Don't report if not logged in

    await fetch(`${getApiBaseUrl()}/api/errors/client`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message: errorData.message,
        stack: errorData.stack,
        name: errorData.name,
        url: window.location.href,
        component: errorData.component,
        viewport: `${window.innerWidth}x${window.innerHeight}`
      })
    });
  } catch (e) {
    // Silently fail — don't cause more errors trying to report errors
    console.warn('Failed to report error:', e.message);
  }
};

// Global unhandled error listener
export const setupGlobalErrorHandlers = () => {
  window.addEventListener('error', (event) => {
    reportError({
      message: event.message,
      stack: event.error?.stack,
      name: event.error?.name || 'WindowError'
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError({
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      name: 'UnhandledPromiseRejection'
    });
  });
};

export default reportError;
