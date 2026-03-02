import React from 'react';
import StatCard from '../common/StatCard';
import TracingErrorBoundary from '../common/TracingErrorBoundary';

const AdminMonitoringTab = ({ monitoringData, autoRefresh, setAutoRefresh, fetchMonitoringData }) => (
  <TracingErrorBoundary componentName="MonitoringTab">
    <div className="monitoring-tab">
      <div className="monitoring-header">
        <h2>Real-time System Monitoring</h2>
        <div className="monitoring-controls">
          <label>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh (30s)
          </label>
          <button onClick={fetchMonitoringData} className="refresh-button">Refresh Now</button>
        </div>
      </div>

      {monitoringData ? (
        <div className="monitoring-content">
          <div className="stats-grid">
            <StatCard title="Active Connections" value={monitoringData.connectionStats?.totalConnections || 0}
              subtitle={`${monitoringData.connectionStats?.uniqueUsers || 0} unique users`} className="connections-stat" />
            <StatCard title="Messages (24h)" value={monitoringData.messageStats?.totalMessages || 0}
              subtitle={`${monitoringData.messageStats?.groupMessages || 0} group, ${monitoringData.messageStats?.directMessages || 0} direct`} className="messages-stat" />
            <StatCard title="Active Rooms" value={monitoringData.roomStats?.activeRooms || 0}
              subtitle={`${monitoringData.roomStats?.totalRooms || 0} total rooms`} className="rooms-stat" />
            <StatCard title="Unread Messages" value={monitoringData.messageStats?.unreadMessages || 0}
              subtitle="Across all users" className="unread-stat" />
          </div>

          <div className="monitoring-sections">
            <div className="online-users-section">
              <h3>Online Users ({monitoringData.onlineUsers?.length || 0})</h3>
              <div className="online-users-list">
                {Array.isArray(monitoringData?.onlineUsers) && monitoringData.onlineUsers.length > 0 ? monitoringData.onlineUsers.map((user, index) => (
                  <div key={index} className="online-user-item">
                    <div className="user-info">
                      <div className="user-name">{user.firstName} {user.lastName}</div>
                      <div className="user-email">{user.email}</div>
                    </div>
                    <div className="connection-indicator online"></div>
                  </div>
                )) : <p>No users currently online</p>}
              </div>
            </div>

            <div className="system-health-section">
              <h3>System Health</h3>
              <div className="health-metrics">
                <div className="health-item">
                  <span className="metric-label">Uptime:</span>
                  <span className="metric-value">
                    {Math.floor((monitoringData.systemHealth?.uptime || 0) / 3600)}h {Math.floor(((monitoringData.systemHealth?.uptime || 0) % 3600) / 60)}m
                  </span>
                </div>
                <div className="health-item">
                  <span className="metric-label">Memory Usage:</span>
                  <span className="metric-value">
                    {Math.round((monitoringData.systemHealth?.memoryUsage?.used || 0) / 1024 / 1024)}MB
                  </span>
                </div>
                <div className="health-item">
                  <span className="metric-label">Last Updated:</span>
                  <span className="metric-value">
                    {new Date(monitoringData.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading monitoring data...</p>
        </div>
      )}
    </div>
  </TracingErrorBoundary>
);

export default AdminMonitoringTab;
