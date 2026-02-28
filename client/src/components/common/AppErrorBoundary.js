import React from 'react';
import reportError from '../../utils/errorReporter';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    reportError({
      message: error.message,
      stack: error.stack,
      name: error.name,
      component: errorInfo?.componentStack?.split('\n')[1]?.trim()
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '50vh', padding: '2rem', textAlign: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💥</div>
          <h2 style={{ marginBottom: '0.75rem', color: 'var(--color-text-dark, #1e293b)' }}>Something went wrong</h2>
          <p style={{ color: 'var(--color-text-secondary, #6b7280)', marginBottom: '1.5rem', maxWidth: '400px', lineHeight: 1.6 }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.55rem 1.25rem', background: 'var(--color-primary, #2563eb)', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              style={{
                padding: '0.55rem 1.25rem', background: 'var(--color-bg-muted, #f3f4f6)', color: 'var(--color-text, #374151)',
                border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem'
              }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
