import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { User } from '@fetchwork/shared';
import { authApi } from '../api/endpoints/authApi';
import { usersApi } from '../api/endpoints/usersApi';
import { storage } from '../utils/storage';
import { getDeviceId } from '../utils/deviceId';
import { useAuthStore } from '../store/authStore';
import { disconnectSocket } from '../api/socket';
import { queryClient } from './QueryContext';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (data: {
    firstName: string; lastName: string; email: string;
    password: string; role: string; referralCode?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, setToken, setUser, setLoading, clear } = useAuthStore();

  // ── Bootstrap: rehydrate token from SecureStore ─────────────────
  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getToken();
        if (token) {
          setToken(token);
          const me = await authApi.getMe();
          setUser(me.user || me);
        }
      } catch {
        await storage.clearAll();
        clear();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const _onAuthSuccess = useCallback(async (token: string, user: User) => {
    await storage.setToken(token);
    await storage.setUser(user);
    setToken(token);
    setUser(user);

    // Register push token for this device
    try {
      const deviceId = await getDeviceId();
      await usersApi.registerPushToken('pending', deviceId); // actual token registered by usePushToken hook
    } catch { /* non-fatal */ }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    await _onAuthSuccess(data.token, data.user);
  }, [_onAuthSuccess]);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const data = await authApi.loginWithGoogle(idToken);
    await _onAuthSuccess(data.token, data.user);
  }, [_onAuthSuccess]);

  const register = useCallback(async (params: Parameters<typeof authApi.register>[0]) => {
    const data = await authApi.register(params);
    await _onAuthSuccess(data.token, data.user);
  }, [_onAuthSuccess]);

  const logout = useCallback(async () => {
    try {
      // Unregister push token
      const deviceId = await getDeviceId();
      await usersApi.unregisterPushToken(deviceId).catch(() => null);
      // Invalidate server session
      await authApi.logout().catch(() => null);
    } finally {
      disconnectSocket();
      queryClient.clear();
      await storage.clearAll();
      clear();
    }
  }, [clear]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.getMe();
      const updated = me.user || me;
      setUser(updated);
      await storage.setUser(updated);
    } catch { /* non-fatal */ }
  }, [setUser]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, loginWithGoogle, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
