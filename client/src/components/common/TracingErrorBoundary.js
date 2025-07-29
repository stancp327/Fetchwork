import React from 'react';

class TracingErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`🔴 Error caught in TracingErrorBoundary for component: ${this.props.componentName}`);
    console.error('🔍 Error:', error);
    console.error('🧠 Error Info:', errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>{this.props.componentName} Error</h2>
          <p>Something went wrong in <strong>{this.props.componentName}</strong>. Please try again.</p>
          <pre>{this.state.error?.toString()}</pre>
          <button onClick={() => window.location.reload()} className="retry-button">Reload</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default TracingErrorBoundary;
