import api from '../client';

export const notificationsApi = {
  list: async (page = 1, limit = 20) => {
    const { data } = await api.get('/api/notifications', { params: { page, limit } });
    return data;
  },
  markRead: async (id: string) => {
    const { data } = await api.put(`/api/notifications/${id}/read`);
    return data;
  },
  markAllRead: async () => {
    const { data } = await api.put('/api/notifications/read-all');
    return data;
  },
  unreadCount: async () => {
    const { data } = await api.get('/api/notifications/unread-count');
    return data;
  },
};
