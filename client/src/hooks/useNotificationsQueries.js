// React Query hooks for notifications — kept in a separate file so that
// @tanstack/react-query is NOT pulled into the main bundle via useNotifications.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../utils/api';

export function useNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => apiRequest('/api/notifications/count'),
    refetchInterval: 30 * 1000,
    staleTime: 10 * 1000,
  });
}

export function useNotificationsList(page = 1) {
  return useQuery({
    queryKey: ['notifications', 'list', page],
    queryFn: () => apiRequest(`/api/notifications?page=${page}&limit=20`),
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids) => apiRequest('/api/notifications/read', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
