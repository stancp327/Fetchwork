import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const ANDROID_CLIENT_ID = '172864514556-oi6ichcg5c6j5rag79ibpid5rjuvu9td.apps.googleusercontent.com';
const WEB_CLIENT_ID = '172864514556-eelidki0hadeg4t4us9n6bumhqnvqgp7.apps.googleusercontent.com';

export function useGoogleAuth() {
  const { loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        handleGoogleToken(authentication.accessToken);
      }
    } else if (response?.type === 'error') {
      setError('Google sign-in failed. Please try again.');
    }
  }, [response]);

  const handleGoogleToken = async (accessToken: string) => {
    setIsLoading(true);
    setError('');
    try {
      await loginWithGoogle(accessToken, true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Google sign-in failed. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return { request, promptAsync, isLoading, error, setError };
}
