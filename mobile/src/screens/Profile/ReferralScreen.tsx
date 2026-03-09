import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { ProfileStackParamList } from '../../types/navigation';
import { usersApi } from '../../api/endpoints/usersApi';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Referrals'>;

interface Referral {
  id: string;
  name: string;
  status: 'pending' | 'qualified' | 'rewarded';
  joinedAt?: string;
  rewardedAt?: string;
}

interface ReferralData {
  code: string;
  link: string;
  credits: number;
  total: number;
  pending: number;
  qualified: number;
  rewarded: number;
  rewardAmount: number;
  referrals: Referral[];
}

const STATUS_VARIANT: Record<Referral['status'], 'warning' | 'primary' | 'success'> = {
  pending: 'warning',
  qualified: 'primary',
  rewarded: 'success',
};

const STEPS = [
  { emoji: '\u{1F517}', text: 'Share your link with friends' },
  { emoji: '\u{1F4BC}', text: 'They sign up and complete a job' },
  { emoji: '\u{1F4B0}', text: 'You earn $25 in credits' },
] as const;

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReferralScreen(_props: Props) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<ReferralData>({
    queryKey: ['mobile-referrals'],
    queryFn: usersApi.getReferrals,
  });

  const handleCopyLink = useCallback(async () => {
    if (!data?.link) return;
    await Clipboard.setStringAsync(data.link);
    Alert.alert('Copied!', 'Referral link copied to clipboard.');
  }, [data?.link]);

  const handleShare = useCallback(async () => {
    if (!data?.link) return;
    try {
      await Share.share({
        message: `Join Fetchwork and earn! Sign up with my referral link: ${data.link}`,
        url: data.link,
      });
    } catch {
      // User cancelled or share failed silently
    }
  }, [data?.link]);

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={s.safe}>
        <EmptyState
          emoji="\u{26A0}\u{FE0F}"
          title="Failed to load referrals"
          subtitle="Something went wrong. Please try again."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header Section */}
        <View style={s.header}>
          <Text style={s.headline}>Refer & Earn</Text>
          <Text style={s.subtitle}>
            Earn ${data.rewardAmount} for every friend who completes their first job
          </Text>
        </View>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Total Referrals</Text>
            <Text style={s.statValue}>{data.total}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Pending</Text>
            <Text style={s.statValue}>{data.pending}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Credits Earned</Text>
            <Text style={[s.statValue, { color: colors.success }]}>
              ${data.credits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Share Section */}
        <Card style={s.shareCard}>
          <Text style={s.shareLabel}>Your Referral Link</Text>
          <View style={s.linkBox}>
            <Text style={s.linkText} numberOfLines={1} ellipsizeMode="middle">
              {data.link}
            </Text>
          </View>
          <View style={s.shareButtons}>
            <Button
              label="Copy Link"
              variant="secondary"
              size="sm"
              leftIcon="copy-outline"
              onPress={handleCopyLink}
              style={s.shareBtn}
            />
            <Button
              label="Share"
              variant="primary"
              size="sm"
              leftIcon="share-outline"
              onPress={handleShare}
              style={s.shareBtn}
            />
          </View>
        </Card>

        {/* How It Works Section */}
        <Card style={s.howItWorksCard}>
          <Text style={s.sectionTitle}>How It Works</Text>
          {STEPS.map((step, index) => (
            <View key={index} style={s.stepRow}>
              <View style={s.stepNumberContainer}>
                <Text style={s.stepEmoji}>{step.emoji}</Text>
              </View>
              <View style={s.stepContent}>
                <Text style={s.stepNumber}>Step {index + 1}</Text>
                <Text style={s.stepText}>{step.text}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Referral History Section */}
        <View style={s.historySection}>
          <Text style={s.sectionTitle}>Referral History</Text>
          {data.referrals.length === 0 ? (
            <Card>
              <Text style={s.emptyHistory}>
                No referrals yet. Share your link to get started!
              </Text>
            </Card>
          ) : (
            data.referrals.map((referral) => (
              <Card key={referral.id} style={s.referralCard}>
                <View style={s.referralRow}>
                  <View style={s.referralInfo}>
                    <Text style={s.referralName}>{referral.name}</Text>
                    {referral.joinedAt && (
                      <Text style={s.referralDate}>
                        Joined {formatDate(referral.joinedAt)}
                      </Text>
                    )}
                  </View>
                  <Badge
                    label={referral.status.charAt(0).toUpperCase() + referral.status.slice(1)}
                    variant={STATUS_VARIANT[referral.status]}
                  />
                </View>
              </Card>
            ))
          )}
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
  },
  scroll: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    marginBottom: spacing.lg,
  },
  headline: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textDark,
  },

  // Share Section
  shareCard: {
    marginBottom: spacing.md,
  },
  shareLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  linkBox: {
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgMuted,
    marginBottom: spacing.md,
  },
  linkText: {
    ...typography.body,
    color: colors.text,
  },
  shareButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shareBtn: {
    flex: 1,
  },

  // How It Works
  howItWorksCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stepNumberContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepEmoji: {
    fontSize: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepNumber: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  stepText: {
    ...typography.body,
    color: colors.text,
  },

  // Referral History
  historySection: {
    marginBottom: spacing.md,
  },
  referralCard: {
    marginBottom: spacing.sm,
  },
  referralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referralInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  referralName: {
    ...typography.h4,
  },
  referralDate: {
    ...typography.caption,
    marginTop: 2,
  },
  emptyHistory: {
    ...typography.bodySmall,
    textAlign: 'center',
    color: colors.textMuted,
    paddingVertical: spacing.lg,
  },
});
