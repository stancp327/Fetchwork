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
          <h2 style={{ marginBottom: '1rem', color: '#333' }}>Something went wrong</h2>
          <p style={{ color: '#666', marginBottom: '1.5rem', maxWidth: '400px' }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.6rem 1.5rem', background: '#2196f3', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              style={{
                padding: '0.6rem 1.5rem', background: '#f5f5f5', color: '#333',
                border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: 500
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
