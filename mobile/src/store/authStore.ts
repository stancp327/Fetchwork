import { create } from 'zustand';
import { User } from '@fetchwork/shared';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token:           null,
  user:            null,
  isAuthenticated: false,
  isLoading:       true,

  setToken: (token) =>
    set({ token, isAuthenticated: !!token }),

  setUser: (user) =>
    set({ user }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  clear: () =>
    set({ token: null, user: null, isAuthenticated: false }),
}));
