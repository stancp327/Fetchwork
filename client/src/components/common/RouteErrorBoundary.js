import React from 'react';
import reportError from '../../utils/errorReporter';

/**
 * RouteErrorBoundary — wraps the <Routes> block inside <Suspense>.
 *
 * Why this exists:
 *   The outer AppErrorBoundary catches everything but hides the whole app
 *   (including Navigation) on error.  This boundary catches errors that happen
 *   inside the route content area only, so Navigation stays visible and the
 *   user isn't stranded on a blank page.
 *
 * Handles two scenarios:
 *   1. Chunk load failure — network blip caused the lazy import() to reject
 *   2. Runtime render error — a component threw during render
 */
class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error) {
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /loading chunk|failed to fetch dynamically imported|importing a module script failed/i.test(
        error?.message || ''
      );
    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error, errorInfo) {
    reportError({
      message: error.message,
      stack: error.stack,
      name: error.name,
      component: errorInfo?.componentStack?.split('\n')[1]?.trim(),
      context: 'RouteErrorBoundary',
    });
  }

  handleRetry = () => {
    if (this.state.isChunkError) {
      // Hard reload clears the stale chunk cache
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null, isChunkError: false });
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { isChunkError } = this.state;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '2rem',
        textAlign: 'center',
        gap: '1rem',
      }}>
        <div style={{ fontSize: '2.5rem' }}>{isChunkError ? '📶' : '⚠️'}</div>

        <h2 style={{ margin: 0, color: 'var(--color-text-dark, #1e293b)', fontSize: '1.25rem' }}>
          {isChunkError ? 'Failed to load this page' : 'Something went wrong'}
        </h2>

        <p style={{
          color: 'var(--color-text-secondary, #6b7280)',
          maxWidth: '360px',
          margin: 0,
          fontSize: '0.9rem',
          lineHeight: 1.6,
        }}>
          {isChunkError
            ? 'A file failed to download — usually a network hiccup. Reload to try again.'
            : 'An unexpected error occurred on this page. Our team has been notified.'}
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '0.55rem 1.25rem',
              background: 'var(--color-primary, #2563eb)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            {isChunkError ? 'Reload page' : 'Try again'}
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            style={{
              padding: '0.55rem 1.25rem',
              background: 'var(--color-bg-muted, #f3f4f6)',
              color: 'var(--color-text, #374151)',
              border: '1px solid var(--color-border, #e5e7eb)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.875rem',
            }}
          >
            Go home
          </button>
        </div>
      </div>
    );
  }
}

export default RouteErrorBoundary;
