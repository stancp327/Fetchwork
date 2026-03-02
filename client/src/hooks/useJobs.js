import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../utils/api';

// ── Browse jobs (public) ────────────────────────────────────────
export function useBrowseJobs(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== 'all') searchParams.set(k, v);
  });
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['jobs', 'browse', qs],
    queryFn: () => apiRequest(`/api/jobs${qs ? `?${qs}` : ''}`),
  });
}

// ── Single job ──────────────────────────────────────────────────
export function useJob(id) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => apiRequest(`/api/jobs/${id}`),
    enabled: !!id,
  });
}

// ── My jobs (user-specific) ─────────────────────────────────────
export function useMyJobs(type = 'posted') {
  return useQuery({
    queryKey: ['jobs', 'my', type],
    queryFn: () => apiRequest(`/api/users/jobs?type=${type}&limit=100`),
  });
}

// ── Post job mutation ───────────────────────────────────────────
export function usePostJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => apiRequest('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

// ── Submit proposal ─────────────────────────────────────────────
export function useSubmitProposal(jobId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) => apiRequest(`/api/jobs/${jobId}/proposals`, {
      method: 'POST',
      body: formData,
      headers: {}, // let browser set content-type for FormData
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', jobId] });
    },
  });
}

// ── Job action (complete, start, begin) ─────────────────────────
export function useJobAction(jobId, action) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body = {}) => apiRequest(`/api/jobs/${jobId}/${action}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
