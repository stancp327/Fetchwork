import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName:  z.string().min(1, 'Required'),
  email:     z.string().email('Enter a valid email'),
  password:  z.string().min(8, 'At least 8 characters'),
  role:      z.enum(['freelancer', 'client']),
});
type FormData = z.infer<typeof schema>;
type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation, route }: Props) {
  const { register } = useAuth();
  const [serverError, setServerError] = useState('');
  const referralCode = route.params?.ref;

  const { control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', role: 'freelancer' },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      await register({ ...data, referralCode });
    } catch (err: any) {
      setServerError(err?.response?.data?.error || 'Registration failed. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Create an account</Text>
            <Text style={styles.sub}>Join Fetchwork — it's free</Text>
          </View>

          {/* Role Selector */}
          <View style={styles.roleRow}>
            {(['freelancer', 'client'] as const).map(r => (
              <Pressable
                key={r}
                style={[styles.roleCard, selectedRole === r && styles.roleCardActive]}
                onPress={() => setValue('role', r)}
              >
                <Text style={styles.roleIcon}>{r === 'freelancer' ? '💼' : '🏢'}</Text>
                <Text style={[styles.roleLabel, selectedRole === r && styles.roleLabelActive]}>
                  {r === 'freelancer' ? 'I want to work' : 'I want to hire'}
                </Text>
                <Text style={styles.roleSub}>
                  {r === 'freelancer' ? 'Find jobs & clients' : 'Post jobs & hire talent'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.nameRow}>
            <Controller control={control} name="firstName"
              render={({ field: { onChange, value } }) => (
                <Input label="First Name" placeholder="Jane" value={value} onChangeText={onChange}
                  error={errors.firstName?.message} containerStyle={{ flex: 1 }} />
              )} />
            <Controller control={control} name="lastName"
              render={({ field: { onChange, value } }) => (
                <Input label="Last Name" placeholder="Smith" value={value} onChangeText={onChange}
                  error={errors.lastName?.message} containerStyle={{ flex: 1 }} />
              )} />
          </View>

          <Controller control={control} name="email"
            render={({ field: { onChange, value } }) => (
              <Input label="Email" placeholder="you@example.com" value={value} onChangeText={onChange}
                keyboardType="email-address" autoCapitalize="none" leftIcon="mail-outline"
                error={errors.email?.message} />
            )} />

          <Controller control={control} name="password"
            render={({ field: { onChange, value } }) => (
              <Input label="Password" placeholder="At least 8 characters" value={value}
                onChangeText={onChange} secureTextEntry leftIcon="lock-closed-outline"
                error={errors.password?.message}
                hint="Must be at least 8 characters" />
            )} />

          {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

          <Button label="Create Account" onPress={handleSubmit(onSubmit)} loading={isSubmitting} fullWidth size="lg" />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Log in</Text>
            </Pressable>
          </View>
          <Text style={styles.terms}>
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.white },
  scroll:          { padding: spacing.lg, flexGrow: 1 },
  header:          { marginTop: spacing.lg, marginBottom: spacing.lg },
  title:           { ...typography.h1, marginBottom: 6 },
  sub:             { ...typography.bodySmall },
  roleRow:         { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  roleCard:        {
    flex: 1, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 2, borderColor: colors.border, alignItems: 'center',
  },
  roleCardActive:  { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roleIcon:        { fontSize: 28, marginBottom: 6 },
  roleLabel:       { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: 2 },
  roleLabelActive: { color: colors.primary },
  roleSub:         { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  nameRow:         { flexDirection: 'row', gap: spacing.sm },
  serverError:     { color: colors.danger, fontSize: 13, marginBottom: spacing.md, textAlign: 'center' },
  footer:          { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  footerText:      { ...typography.bodySmall },
  footerLink:      { fontSize: 13, color: colors.primary, fontWeight: '600' },
  terms:           { ...typography.caption, textAlign: 'center', marginTop: spacing.md, paddingBottom: spacing.lg },
});
