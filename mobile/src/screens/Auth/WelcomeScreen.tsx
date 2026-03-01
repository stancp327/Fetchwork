import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import Button from '../../components/common/Button';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
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
            label="Get Started"
            onPress={() => navigation.navigate('Register')}
            fullWidth
            size="lg"
          />
          <Button
            label="Log In"
            onPress={() => navigation.navigate('Login')}
            variant="secondary"
            fullWidth
            size="lg"
            style={{ marginTop: spacing.sm }}
          />
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
});
