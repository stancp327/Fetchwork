import React, { useState, useEffect } from 'react';
import LineChart from '../Charts/LineChart';
import PieChart from '../Charts/PieChart';
import { apiRequest } from '../../utils/api';

const AnalyticsTab = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30d');

  const fetchAnalyticsData = async (selectedPeriod = period) => {
    try {
      setLoading(true);
      
      const response = await apiRequest('/api/admin/analytics', {
        params: { period: selectedPeriod }
      });
      
      setAnalyticsData(response.analytics);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      setError(error.response?.data?.error || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    fetchAnalyticsData(newPeriod);
  };

  if (loading) {
    return (
      <div className="analytics-tab">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-tab">
        <div className="error-container">
          <h3>Analytics Error</h3>
          <p>{error}</p>
          <button onClick={() => fetchAnalyticsData()} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-tab">
      <div className="analytics-header">
        <h2>Platform Analytics</h2>
        <div className="period-selector">
          <label>Time Period:</label>
          <select value={period} onChange={(e) => handlePeriodChange(e.target.value)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="chart-section">
          <LineChart 
            data={analyticsData?.userGrowth || []} 
            title="User Growth" 
            color="#10b981"
            fillColor="rgba(16, 185, 129, 0.1)"
          />
        </div>

        <div className="chart-section">
          <LineChart 
            data={analyticsData?.jobsPosted || []} 
            title="Jobs Posted" 
            color="#3b82f6"
            fillColor="rgba(59, 130, 246, 0.1)"
          />
        </div>

        <div className="chart-section">
          <LineChart 
            data={analyticsData?.paymentVolume || []} 
            title="Payment Volume ($)" 
            color="#f59e0b"
            fillColor="rgba(245, 158, 11, 0.1)"
          />
        </div>

        <div className="chart-section">
          <PieChart 
            data={analyticsData?.topCategories || []} 
            title="Job Categories Distribution" 
          />
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
