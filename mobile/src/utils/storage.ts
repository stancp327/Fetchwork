import * as SecureStore from 'expo-secure-store';

const KEYS = {
  TOKEN: 'fetchwork_token',
  USER:  'fetchwork_user',
  ACTIVE_MODE: 'fetchwork_active_mode',
} as const;

export type AppMode = 'client' | 'freelancer';

export const storage = {
  getToken:   ()           => SecureStore.getItemAsync(KEYS.TOKEN),
  setToken:   (t: string)  => SecureStore.setItemAsync(KEYS.TOKEN, t),
  clearToken: ()           => SecureStore.deleteItemAsync(KEYS.TOKEN),

  getUser: async <T = unknown>(): Promise<T | null> => {
    const raw = await SecureStore.getItemAsync(KEYS.USER);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  setUser:  (u: object) => SecureStore.setItemAsync(KEYS.USER, JSON.stringify(u)),
  clearUser: ()          => SecureStore.deleteItemAsync(KEYS.USER),

  getActiveMode: async (): Promise<AppMode | null> => {
    const raw = await SecureStore.getItemAsync(KEYS.ACTIVE_MODE);
    return raw === 'client' || raw === 'freelancer' ? raw : null;
  },
  setActiveMode: (m: AppMode) => SecureStore.setItemAsync(KEYS.ACTIVE_MODE, m),
  clearActiveMode: () => SecureStore.deleteItemAsync(KEYS.ACTIVE_MODE),

  clearAll: async () => {
    await SecureStore.deleteItemAsync(KEYS.TOKEN);
    await SecureStore.deleteItemAsync(KEYS.USER);
    await SecureStore.deleteItemAsync(KEYS.ACTIVE_MODE);
  },
};
