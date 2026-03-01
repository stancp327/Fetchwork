import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme';
import { BadgeType } from '@fetchwork/shared';

const BADGE_CONFIG: Record<BadgeType, { icon: string; label: string; color: string }> = {
  email_verified: { icon: '✉️', label: 'Email Verified',       color: colors.emailVerified },
  id_verified:    { icon: '🪪', label: 'ID Verified',          color: colors.idVerified    },
  top_rated:      { icon: '⭐', label: 'Top Rated',            color: colors.topRated      },
  bg_checked:     { icon: '🔍', label: 'Background Checked',   color: colors.bgChecked     },
};

type BadgeSize = 'xs' | 'sm' | 'md';

interface TrustBadgeProps {
  type: BadgeType;
  size?: BadgeSize;
  showLabel?: boolean;
}

export default function TrustBadge({ type, size = 'sm', showLabel = true }: TrustBadgeProps) {
  const cfg = BADGE_CONFIG[type];
  if (!cfg) return null;

  const isXs = size === 'xs';
  const bg = cfg.color + '1a'; // 10% opacity background

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: cfg.color + '40' }]}>
      <Text style={[styles.icon, isXs && styles.iconXs]}>{cfg.icon}</Text>
      {showLabel && !isXs && (
        <Text style={[styles.label, { color: cfg.color }, size === 'md' && styles.labelMd]}>
          {cfg.label}
        </Text>
      )}
    </View>
  );
}

export function TrustBadgeRow({ badges }: { badges: BadgeType[] }) {
  if (!badges?.length) return null;
  return (
    <View style={styles.row}>
      {badges.map(b => <TrustBadge key={b} type={b} size="sm" />)}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: radius.sm, borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon:    { fontSize: 11 },
  iconXs:  { fontSize: 9 },
  label:   { fontSize: 11, fontWeight: '600' },
  labelMd: { fontSize: 13 },
  row:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
