import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../utils/api';

// ── Current user profile ────────────────────────────────────────
export function useCurrentUser() {
  return useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => apiRequest('/api/auth/me'),
    staleTime: 60 * 1000, // 1 min
  });
}

// ── User profile (public) ───────────────────────────────────────
export function useUserProfile(id) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => apiRequest(`/api/users/${id}`),
    enabled: !!id,
  });
}

// ── Update profile ──────────────────────────────────────────────
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => apiRequest('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

// ── User features/entitlements ──────────────────────────────────
export function useUserFeatures() {
  return useQuery({
    queryKey: ['user', 'features'],
    queryFn: () => apiRequest('/api/auth/me/features'),
    staleTime: 5 * 60 * 1000, // 5 min — features don't change often
  });
}

// ── Boost credits ───────────────────────────────────────────────
export function useBoostCredits() {
  return useQuery({
    queryKey: ['boosts', 'credits'],
    queryFn: () => apiRequest('/api/boosts/credits'),
    staleTime: 60 * 1000,
  });
}
