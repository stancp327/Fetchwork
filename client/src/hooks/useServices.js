import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../utils/api';

// ── Browse services (public) ────────────────────────────────────
export function useBrowseServices(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== 'all') searchParams.set(k, v);
  });
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['services', 'browse', qs],
    queryFn: () => apiRequest(`/api/services${qs ? `?${qs}` : ''}`),
  });
}

// ── Single service ──────────────────────────────────────────────
export function useService(id) {
  return useQuery({
    queryKey: ['services', id],
    queryFn: () => apiRequest(`/api/services/${id}`),
    enabled: !!id,
  });
}

// ── My services (freelancer) ────────────────────────────────────
export function useMyServices() {
  return useQuery({
    queryKey: ['services', 'mine'],
    queryFn: () => apiRequest('/api/services/me'),
  });
}

// ── Create/update service ───────────────────────────────────────
export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => apiRequest('/api/services', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
}
