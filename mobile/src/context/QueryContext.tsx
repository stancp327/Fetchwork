import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            60 * 1000,      // 1 min — serves cached data while refetching
      gcTime:               5 * 60 * 1000,  // 5 min in cache after unmount
      retry:                2,
      refetchOnWindowFocus: false,          // mobile has no "window focus"
      refetchOnReconnect:   true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function QueryContext({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
