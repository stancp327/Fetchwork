import client, { publicClient } from '../client';

export const authApi = {
  login: (email: string, password: string) =>
    publicClient.post('/api/auth/login', { email, password }).then(r => r.data),

  register: (data: {
    firstName: string; lastName: string; email: string;
    password: string; role: string; referralCode?: string;
  }) => publicClient.post('/api/auth/register', data).then(r => r.data),

  loginWithGoogle: (idToken: string) =>
    publicClient.post('/api/auth/google/mobile', { idToken }).then(r => r.data),

  getMe: () =>
    client.get('/api/auth/me').then(r => r.data),

  logout: () =>
    client.post('/api/auth/logout').then(r => r.data).catch(() => null),

  forgotPassword: (email: string) =>
    publicClient.post('/api/auth/forgot-password', { email }).then(r => r.data),
};
