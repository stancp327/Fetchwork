import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'neutral';

const VARIANTS: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: colors.primaryLight, text: colors.primary },
  success: { bg: colors.successLight, text: colors.success },
  warning: { bg: colors.warningLight, text: colors.warning },
  danger:  { bg: colors.dangerLight,  text: colors.danger },
  purple:  { bg: colors.purpleLight,  text: colors.purple },
  neutral: { bg: colors.bgMuted,      text: colors.textSecondary },
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function getJobStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    open: 'success', draft: 'neutral', accepted: 'primary',
    pending_start: 'warning', in_progress: 'primary',
    completed: 'success', cancelled: 'danger',
  };
  return map[status] ?? 'neutral';
}

export default function Badge({ label, variant = 'neutral' }: BadgeProps) {
  const v = VARIANTS[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }]}>
      <Text style={[styles.label, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, alignSelf: 'flex-start' },
  label: { fontSize: 11, fontWeight: '600' },
});
