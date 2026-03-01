import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import TrustBadge from '../../components/common/TrustBadge';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';
import { BadgeType } from '@fetchwork/shared';

type BadgeDef = {
  key: BadgeType; icon: string; label: string;
  color: string; earned: boolean; how: string;
};

export default function VerificationScreen() {
  const { user } = useAuth();

  const defs: BadgeDef[] = [
    {
      key: 'email_verified', icon: '✉️', label: 'Email Verified', color: colors.emailVerified,
      earned: !!(user?.isEmailVerified || user?.isVerified),
      how: 'Verify your email address via the link sent on signup.',
    },
    {
      key: 'id_verified', icon: '🪪', label: 'ID Verified', color: colors.idVerified,
      earned: user?.verificationLevel === 'identity' || user?.verificationLevel === 'full',
      how: 'Submit a government-issued ID in your profile settings on the web app. Usually approved in 1–2 days.',
    },
    {
      key: 'top_rated', icon: '⭐', label: 'Top Rated', color: colors.topRated,
      earned: (user?.rating ?? 0) >= 4.5 && (user?.totalReviews ?? 0) >= 5,
      how: `Maintain a 4.5+ star rating with at least 5 reviews. You're at ${user?.rating?.toFixed(1) ?? '—'} ⭐ with ${user?.totalReviews ?? 0} reviews.`,
    },
    {
      key: 'bg_checked', icon: '🔍', label: 'Background Checked', color: colors.bgChecked,
      earned: false,
      how: 'Background checks are coming soon.',
    },
  ];

  const earnedCount = defs.filter(b => b.earned).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Summary */}
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Your Badges</Text>
          <Text style={styles.summarySub}>
            {earnedCount} of {defs.length} earned — badges appear on your public profile and build client trust.
          </Text>
          {earnedCount > 0 && (
            <View style={styles.badgeRow}>
              {defs.filter(b => b.earned).map(b => (
                <TrustBadge key={b.key} type={b.key} size="md" />
              ))}
            </View>
          )}
        </Card>

        {/* Badge grid */}
        <View style={styles.grid}>
          {defs.map(b => (
            <Card key={b.key} style={b.earned ? [styles.badgeCard, styles.badgeCardEarned] : styles.badgeCard}>
              <View style={[styles.iconWrap, b.earned && { borderColor: b.color + '60', shadowColor: b.color }]}>
                <Text style={[styles.badgeIcon, !b.earned && styles.badgeIconLocked]}>{b.icon}</Text>
                {b.earned && (
                  <View style={[styles.check, { backgroundColor: colors.success }]}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={styles.badgeLabel}>{b.label}</Text>
              {b.earned ? (
                <Text style={styles.earnedText}>Earned ✓</Text>
              ) : (
                <Text style={styles.howText}>{b.how}</Text>
              )}
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.bgSubtle },
  scroll:          { padding: spacing.md, paddingBottom: spacing.xxl },
  summaryCard:     { marginBottom: spacing.md },
  summaryTitle:    { ...typography.h3, marginBottom: 4 },
  summarySub:      { ...typography.bodySmall, marginBottom: spacing.md },
  badgeRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  grid:            { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badgeCard:       { width: '47%', padding: spacing.md, alignItems: 'center' },
  badgeCardEarned: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  iconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.border, marginBottom: spacing.sm,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  badgeIcon:       { fontSize: 28 },
  badgeIconLocked: { opacity: 0.3 },
  check: {
    position: 'absolute', bottom: -3, right: -3,
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.white,
  },
  checkText:    { color: colors.white, fontSize: 10, fontWeight: '800' },
  badgeLabel:   { ...typography.label, textAlign: 'center', marginBottom: 4 },
  earnedText:   { fontSize: 12, color: colors.success, fontWeight: '600' },
  howText:      { fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 16 },
});
