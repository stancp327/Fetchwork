import React from 'react';
import { apiRequest } from '../../utils/api';
import TracingErrorBoundary from '../common/TracingErrorBoundary';
import AdminUserDrawer from './AdminUserDrawer';

const AdminUsersTab = ({
  usersData, selectedUser, setSelectedUser, loadUserDetail,
  fetchUsersData, suspendUser, unsuspendUser, promoteUser,
  demoteUser, makeModerator, removeModerator,
}) => {
  return (
    <TracingErrorBoundary componentName="UsersTab">
      <div className="users-tab">
        <h2>User Management</h2>

        {selectedUser && (
          <AdminUserDrawer
            data={selectedUser}
            onClose={() => setSelectedUser(null)}
            onRefresh={() => loadUserDetail(selectedUser.user._id)}
          />
        )}

        {usersData ? (
          <div className="users-management">
            <div className="users-controls">
              <input
                type="text"
                placeholder="🔍 Search by name, email, username..."
                className="search-input"
                onChange={(e) => {
                  clearTimeout(window._userSearchTimeout);
                  window._userSearchTimeout = setTimeout(() => fetchUsersData(1, e.target.value), 300);
                }}
              />
              <select className="status-filter" onChange={(e) => fetchUsersData(1, '', e.target.value)}>
                <option value="all">All Users</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="users-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(usersData?.users) && usersData.users.length > 0 ? usersData.users.map((u) => (
                    <tr key={u._id} style={{ cursor: 'pointer' }} onClick={() => loadUserDetail(u._id)}>
                      <td>
                        {u.firstName} {u.lastName}
                        {u.feeWaiver?.enabled && <span title="Fee waived" style={{ marginLeft: '0.3rem' }}>💚</span>}
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span style={{
                          padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                          background: u.role === 'admin' ? '#fef2f2' : u.role === 'moderator' ? '#eff6ff' : '#f3f4f6',
                          color: u.role === 'admin' ? '#dc2626' : u.role === 'moderator' ? '#2563eb' : '#6b7280'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className={`status ${u.isSuspended ? 'suspended' : u.isActive ? 'active' : 'inactive'}`}>
                          {u.isSuspended ? 'Suspended' : u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="action-buttons" onClick={e => e.stopPropagation()}>
                          {u.isSuspended ? (
                            <button className="action-btn unsuspend" onClick={() => unsuspendUser(u._id)}>Unsuspend</button>
                          ) : (
                            <button className="action-btn suspend" onClick={() => {
                              const reason = prompt('Reason:');
                              if (reason) suspendUser(u._id, reason);
                            }}>Suspend</button>
                          )}
                          {u.role === 'moderator' ? (
                            <button className="action-btn demote" onClick={() => removeModerator(u._id)}>Remove Mod</button>
                          ) : u.isAdminPromoted ? (
                            <button className="action-btn demote" onClick={() => demoteUser(u._id)}>Remove Admin</button>
                          ) : (
                            <>
                              <button className="action-btn promote" onClick={() => promoteUser(u._id)}>Make Admin</button>
                              <button className="action-btn moderator" onClick={() => makeModerator(u._id)}>Make Moderator</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" className="no-data">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>Page {usersData?.pagination?.current || 1} of {usersData?.pagination?.pages || 1}</span>
              <span>Total: {usersData?.pagination?.total || 0} users</span>
            </div>
          </div>
        ) : (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading users...</p>
          </div>
        )}
      </div>
    </TracingErrorBoundary>
  );
};

export default AdminUsersTab;
