import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { storage } from '../utils/storage';
import { useAuthStore } from '../store/authStore';

export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://fetchwork-1.onrender.com';

// ── Public client (no auth — for login/register/forgot-password) ──
export const publicClient: AxiosInstance = axios.create({ baseURL: API_BASE });

// ── Authenticated client ─────────────────────────────────────────
const client: AxiosInstance = axios.create({ baseURL: API_BASE });

// Inject token on every request
client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await storage.getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(token: string | null, error: unknown = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              if (original.headers) original.headers.Authorization = `Bearer ${token}`;
              resolve(client(original));
            },
            reject,
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const currentToken = await storage.getToken();
        if (!currentToken) throw new Error('No token to refresh');

        const { data } = await publicClient.post('/api/auth/refresh', {}, {
          headers: { Authorization: `Bearer ${currentToken}` },
        });

        const newToken: string = data.token;
        await storage.setToken(newToken);
        processQueue(newToken);

        if (original.headers) original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      } catch (refreshError) {
        processQueue(null, refreshError);
        await storage.clearAll();
        // Clear zustand auth state → triggers RootNavigator to show login
        useAuthStore.getState().clear();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;
