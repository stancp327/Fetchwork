import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '../../api/endpoints/authApi';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { colors, spacing, typography } from '../../theme';

const schema = z.object({ email: z.string().email('Enter a valid email') });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async ({ email }: FormData) => {
    setServerError('');
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      setServerError(err?.response?.data?.error || 'Something went wrong. Try again.');
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.success}>
          <Text style={styles.successIcon}>📬</Text>
          <Text style={styles.successTitle}>Check your inbox</Text>
          <Text style={styles.successSub}>We sent a password reset link to your email. It expires in 1 hour.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.sub}>Enter your email and we'll send you a reset link.</Text>
          <Controller control={control} name="email"
            render={({ field: { onChange, value } }) => (
              <Input label="Email" placeholder="you@example.com" value={value} onChangeText={onChange}
                keyboardType="email-address" autoCapitalize="none" leftIcon="mail-outline"
                error={errors.email?.message} />
            )} />
          {serverError ? <Text style={styles.error}>{serverError}</Text> : null}
          <Button label="Send Reset Link" onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth size="lg" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.white },
  scroll:       { padding: spacing.lg, flexGrow: 1 },
  title:        { ...typography.h2, marginTop: spacing.lg, marginBottom: spacing.sm },
  sub:          { ...typography.bodySmall, marginBottom: spacing.xl },
  error:        { color: colors.danger, fontSize: 13, marginBottom: spacing.md },
  success:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  successIcon:  { fontSize: 56, marginBottom: spacing.md },
  successTitle: { ...typography.h2, marginBottom: spacing.sm },
  successSub:   { ...typography.bodySmall, textAlign: 'center' },
});
