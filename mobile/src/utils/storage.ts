import * as SecureStore from 'expo-secure-store';

const KEYS = {
  TOKEN: 'fetchwork_token',
  USER:  'fetchwork_user',
} as const;

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

  clearAll: async () => {
    await SecureStore.deleteItemAsync(KEYS.TOKEN);
    await SecureStore.deleteItemAsync(KEYS.USER);
  },
};
