import { create } from 'zustand';
import { User } from '@fetchwork/shared';
import type { AppMode } from '../utils/storage';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  activeMode: AppMode;

  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setActiveMode: (mode: AppMode) => void;

  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token:           null,
  user:            null,
  isAuthenticated: false,
  isLoading:       true,

  activeMode: 'client',

  setToken: (token) =>
    set({ token, isAuthenticated: !!token }),

  setUser: (user) =>
    set({ user }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  setActiveMode: (activeMode) =>
    set({ activeMode }),

  clear: () =>
    set({ token: null, user: null, isAuthenticated: false }),
}));
