import React, { useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { AuthStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import { colors, spacing, typography } from '../../theme';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const ANDROID_CLIENT_ID = '172864514556-oi6ichcg5c6j5rag79ibpid5rjuvu9td.apps.googleusercontent.com';
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

export default function WelcomeScreen({ navigation }: Props) {
  const { loginWithGoogle } = useAuth();

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: WEB_CLIENT_ID || undefined,
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.authentication?.idToken;
      const accessToken = response.authentication?.accessToken;
      const token = idToken || accessToken;
      const isAccessToken = !idToken && !!accessToken;
      if (token) {
        loginWithGoogle(token, isAccessToken).catch(err => {
          Alert.alert('Sign-in failed', err?.message || 'Google sign-in failed. Please try again.');
        });
      }
    } else if (response?.type === 'error') {
      Alert.alert('Sign-in error', response.error?.message || 'Google sign-in was cancelled.');
    }
  }, [response]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Logo / Branding */}
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>F</Text>
          </View>
          <Text style={styles.wordmark}>Fetchwork</Text>
          <Text style={styles.tagline}>Find work. Hire talent.</Text>
          <Text style={styles.sub}>
            The freelance marketplace built for real people — post jobs, book services, get paid.
          </Text>
        </View>

        {/* Feature highlights */}
        <View style={styles.features}>
          {[
            { icon: '💼', text: 'Browse thousands of local & remote jobs' },
            { icon: '⚡', text: 'Book recurring sessions — tutoring, training & more' },
            { icon: '🔒', text: 'Secure payments with Stripe escrow protection' },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <Button
            label="Continue with Google"
            onPress={() => promptAsync()}
            disabled={!request}
            fullWidth size="lg"
            style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border }}
            labelStyle={{ color: colors.textDark }}
            leftIcon="logo-google"
          />
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          <Button label="Get Started" onPress={() => navigation.navigate('Register')} fullWidth size="lg" />
          <Button label="Log In" onPress={() => navigation.navigate('Login')}
            variant="secondary" fullWidth size="lg" style={{ marginTop: spacing.sm }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.white },
  container:   { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  hero:        { alignItems: 'center', marginTop: spacing.xl },
  logoCircle:  {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  logoText:    { color: colors.white, fontSize: 40, fontWeight: '800' },
  wordmark:    { fontSize: 32, fontWeight: '800', color: colors.textDark, marginBottom: 6 },
  tagline:     { ...typography.h3, color: colors.primary, marginBottom: spacing.sm },
  sub:         { ...typography.bodySmall, textAlign: 'center', maxWidth: 300, lineHeight: 20 },
  features:    { gap: spacing.sm },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  featureIcon: { fontSize: 20 },
  featureText: { ...typography.body, flex: 1 },
  cta:         { gap: 0 },
  divider:     { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md, gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textMuted },
});
