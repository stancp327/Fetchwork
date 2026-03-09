import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { request, promptAsync, isLoading: googleLoading, error: googleError } = useGoogleAuth();
  const [serverError, setServerError] = useState('');

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      await login(data.email.trim(), data.password);
    } catch (err: any) {
      setServerError(err?.response?.data?.error || 'Login failed. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.sub}>Log in to your Fetchwork account</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Controller
              control={control} name="email"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Email"
                  placeholder="you@example.com"
                  value={value}
                  onChangeText={onChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  leftIcon="mail-outline"
                  error={errors.email?.message}
                />
              )}
            />
            <Controller
              control={control} name="password"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Password"
                  placeholder="Your password"
                  value={value}
                  onChangeText={onChange}
                  secureTextEntry
                  leftIcon="lock-closed-outline"
                  error={errors.password?.message}
                />
              )}
            />

            <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotWrap}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

            <Button
              label="Log In"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              fullWidth
              size="lg"
            />

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-In */}
            {googleError ? <Text style={styles.serverError}>{googleError}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.googleBtn,
                pressed && { opacity: 0.8 },
                (!request || googleLoading) && { opacity: 0.5 },
              ]}
              onPress={() => promptAsync()}
              disabled={!request || googleLoading}
            >
              <Ionicons name="logo-google" size={20} color="#4285F4" style={{ marginRight: 10 }} />
              <Text style={styles.googleBtnText}>
                {googleLoading ? 'Signing in…' : 'Continue with Google'}
              </Text>
            </Pressable>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}>Sign up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.white },
  scroll:      { padding: spacing.lg, flexGrow: 1 },
  header:      { marginTop: spacing.xl, marginBottom: spacing.xl },
  title:       { ...typography.h1, marginBottom: 6 },
  sub:         { ...typography.bodySmall },
  form:        { gap: 0 },
  forgotWrap:  { alignSelf: 'flex-end', marginBottom: spacing.lg, marginTop: -spacing.sm },
  forgotText:  { color: colors.primary, fontSize: 13, fontWeight: '500' },
  serverError: { color: colors.danger, fontSize: 13, marginBottom: spacing.md, textAlign: 'center' },
  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: spacing.sm, fontSize: 13, color: colors.textMuted },
  googleBtn:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: '100%', minHeight: 52, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderMedium, backgroundColor: colors.white,
  },
  googleBtnText: { fontSize: 16, fontWeight: '600', color: colors.text },
  footer:      { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText:  { ...typography.bodySmall },
  footerLink:  { fontSize: 13, color: colors.primary, fontWeight: '600' },
});
