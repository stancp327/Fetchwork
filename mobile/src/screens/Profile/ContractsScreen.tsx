import React from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../theme';

export default function ContractsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.title}>Contracts</Text>
        <Text style={styles.body}>
          Contract list/detail parity is queued next. Use web for full contract management right now.
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
