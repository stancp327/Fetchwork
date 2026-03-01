import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import Button from './Button';

interface EmptyStateProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ emoji = '📭', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} style={styles.btn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emoji:     { fontSize: 48, marginBottom: spacing.md },
  title:     { ...typography.h3, textAlign: 'center', marginBottom: spacing.sm },
  subtitle:  { ...typography.bodySmall, textAlign: 'center', marginBottom: spacing.lg },
  btn:       { marginTop: spacing.sm },
});
