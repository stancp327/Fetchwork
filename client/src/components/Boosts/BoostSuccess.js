import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SEO from '../common/SEO';

const BoostSuccess = () => {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'job';

  return (
    <div className="boost-checkout-container">
      <SEO title="Boost Activated" noIndex />
      <div className="boost-checkout-card">
        <div className="boost-success-state">
          <span className="boost-success-icon">🚀</span>
          <h2>Boost Activated</h2>
          <p>
            Your {type === 'service' ? 'service' : 'job'} boost payment completed successfully.
            Your listing should now receive boosted placement.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            <Link to="/projects" className="boost-back-link">Go to Projects</Link>
            <Link to="/analytics" className="boost-back-link">View Analytics</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoostSuccess;
