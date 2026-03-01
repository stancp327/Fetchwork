import client from '../client';
import { User } from '@fetchwork/shared';

export const usersApi = {
  getProfile: (id: string) =>
    client.get(`/api/freelancers/${id}`).then(r => r.data),

  updateProfile: (data: Partial<User> & { [key: string]: unknown }) =>
    client.put('/api/users/profile', data).then(r => r.data),

  registerPushToken: (token: string, deviceId: string) =>
    client.post('/api/users/push-token', { token, deviceId }).then(r => r.data),

  unregisterPushToken: (deviceId: string) =>
    client.delete('/api/users/push-token', { data: { deviceId } }).then(r => r.data),

  getNotifications: (params?: { page?: number }) =>
    client.get('/api/notifications', { params }).then(r => r.data),

  markNotificationRead: (id: string) =>
    client.put(`/api/notifications/${id}/read`).then(r => r.data),

  markAllNotificationsRead: () =>
    client.put('/api/notifications/read-all').then(r => r.data),

  getAnalytics: () =>
    client.get('/api/analytics/me').then(r => r.data),

  getReferrals: () =>
    client.get('/api/referrals/me').then(r => r.data),
};
