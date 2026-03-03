import React from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme';

export default function PaymentsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.body}>
          Payments summary and payout actions are available on web while mobile parity is finishing.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  card: {
    margin: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { ...typography.h3, marginBottom: spacing.sm },
  body: { ...typography.bodySmall, color: colors.textSecondary },
});
