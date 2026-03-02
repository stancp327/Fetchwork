import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,        // 30s — data considered fresh
      gcTime: 5 * 60 * 1000,       // 5min — cache kept after unmount
      retry: 1,                     // retry once on failure
      refetchOnWindowFocus: false,  // don't spam API on tab switch
    },
  },
});

export function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

export { queryClient };
