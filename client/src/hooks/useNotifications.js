import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../utils/api';

// ── Notification count (for badges) ─────────────────────────────
export function useNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => apiRequest('/api/notifications/count'),
    refetchInterval: 30 * 1000, // poll every 30s
    staleTime: 10 * 1000,
  });
}

// ── Notifications list ──────────────────────────────────────────
export function useNotifications(page = 1) {
  return useQuery({
    queryKey: ['notifications', 'list', page],
    queryFn: () => apiRequest(`/api/notifications?page=${page}&limit=20`),
  });
}

// ── Mark as read ────────────────────────────────────────────────
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
