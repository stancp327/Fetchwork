import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProfileStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { offersApi, Offer } from '../../api/endpoints/offersApi';
import Avatar from '../../components/common/Avatar';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import EmptyState from '../../components/common/EmptyState';
import { colors, radius, spacing, typography } from '../../theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = NativeStackScreenProps<ProfileStackParamList, 'Offers'>;

type FilterKey = 'all' | 'action_needed' | 'sent' | 'received';

interface FilterChip {
  key: FilterKey;
  label: string;
}

type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'neutral';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTERS: FilterChip[] = [
  { key: 'all', label: 'All' },
  { key: 'action_needed', label: 'Action Needed' },
  { key: 'sent', label: 'Sent' },
  { key: 'received', label: 'Received' },
];

const STATUS_BADGE_MAP: Record<Offer['status'], { label: string; variant: BadgeVariant }> = {
  pending:   { label: 'Pending',   variant: 'warning' },
  countered: { label: 'Countered', variant: 'purple' },
  accepted:  { label: 'Accepted',  variant: 'success' },
  declined:  { label: 'Declined',  variant: 'danger' },
  withdrawn: { label: 'Withdrawn', variant: 'neutral' },
  expired:   { label: 'Expired',   variant: 'neutral' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fullName(first?: string, last?: string): string {
  return `${first || ''} ${last || ''}`.trim() || 'Unknown';
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function formatAmount(amount: number, currency: string): string {
  const symbol = currency === 'USD' ? '$' : currency;
  return `${symbol}${amount.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OffersScreen(_props: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterKey>('all');

  // ── Query ───────────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['mobile-offers', filter],
    queryFn: () => offersApi.list({ type: filter }),
  });

  const offers = useMemo(() => data?.offers ?? [], [data?.offers]);

  // ── Mutations ───────────────────────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: (id: string) => offersApi.accept(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['mobile-offers'] });
      Alert.alert('Success', res.message || 'Offer accepted');
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to accept offer');
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => offersApi.decline(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['mobile-offers'] });
      Alert.alert('Declined', res.message || 'Offer declined');
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to decline offer');
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleAccept = useCallback(
    (id: string) => {
      acceptMutation.mutate(id);
    },
    [acceptMutation],
  );

  const handleDecline = useCallback(
    (id: string) => {
      Alert.alert(
        'Decline Offer',
        'Are you sure you want to decline this offer?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Decline',
            style: 'destructive',
            onPress: () => declineMutation.mutate(id),
          },
        ],
      );
    },
    [declineMutation],
  );

  // ── Render helpers ──────────────────────────────────────────────────────
  const renderFilterChip = useCallback(
    (chip: FilterChip) => {
      const isActive = filter === chip.key;
      return (
        <Pressable
          key={chip.key}
          onPress={() => setFilter(chip.key)}
          style={[styles.chip, isActive && styles.chipActive]}
        >
          <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
            {chip.label}
          </Text>
        </Pressable>
      );
    },
    [filter],
  );

  const renderOfferCard = useCallback(
    ({ item }: { item: Offer }) => {
      const currentUserId = user?._id;
      const isSender = item.sender._id === currentUserId;
      const otherParty = isSender ? item.recipient : item.sender;
      const otherName = fullName(otherParty.firstName, otherParty.lastName);
      const statusInfo = STATUS_BADGE_MAP[item.status];
      const roundCount = item.revisionHistory?.length ?? 0;
      const description = item.terms.description
        ? truncate(item.terms.description, 80)
        : '';
      const needsAction = item.awaitingResponseFrom === currentUserId;

      return (
        <Card style={styles.offerCard}>
          <View style={styles.cardHeader}>
            <Avatar
              uri={otherParty.profilePicture}
              name={otherName}
              size="md"
            />
            <View style={styles.headerInfo}>
              <Text style={styles.partyName} numberOfLines={1}>
                {otherName}
              </Text>
              <Text style={styles.amount}>
                {formatAmount(item.terms.amount, item.terms.currency)}
              </Text>
            </View>
            <View style={styles.badgeColumn}>
              <Badge
                label={statusInfo.label}
                variant={statusInfo.variant}
              />
              {roundCount > 0 && (
                <Text style={styles.roundLabel}>Round {roundCount}</Text>
              )}
            </View>
          </View>

          {description !== '' && (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          )}

          {needsAction && (
            <View style={styles.actions}>
              <Button
                label="Accept"
                variant="success"
                size="sm"
                onPress={() => handleAccept(item._id)}
                loading={acceptMutation.isPending && acceptMutation.variables === item._id}
                disabled={acceptMutation.isPending || declineMutation.isPending}
                style={styles.actionBtn}
              />
              <Button
                label="Decline"
                variant="danger"
                size="sm"
                onPress={() => handleDecline(item._id)}
                loading={declineMutation.isPending && declineMutation.variables === item._id}
                disabled={acceptMutation.isPending || declineMutation.isPending}
                style={styles.actionBtn}
              />
            </View>
          )}
        </Card>
      );
    },
    [user?._id, handleAccept, handleDecline, acceptMutation, declineMutation],
  );

  const keyExtractor = useCallback((item: Offer) => item._id, []);

  // ── Main render ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      {/* Filter tabs */}
      <View style={styles.filtersRow}>
        {FILTERS.map(renderFilterChip)}
      </View>

      {/* Loading state */}
      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Error state */}
      {!isLoading && isError && (
        <EmptyState
          emoji="⚠️"
          title="Something went wrong"
          subtitle="Could not load your offers. Please try again."
          actionLabel="Retry"
          onAction={refetch}
        />
      )}

      {/* Empty state */}
      {!isLoading && !isError && offers.length === 0 && (
        <EmptyState
          emoji="📭"
          title="No offers yet"
          subtitle="When you send or receive custom offers, they will appear here."
        />
      )}

      {/* Offers list */}
      {!isLoading && !isError && offers.length > 0 && (
        <FlatList
          data={offers}
          keyExtractor={keyExtractor}
          renderItem={renderOfferCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
  },

  // Filter chips
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.bgMuted,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.buttonSm,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },

  // List
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },

  // Centered loading
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Offer card
  offerCard: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  partyName: {
    ...typography.h4,
    color: colors.textDark,
  },
  amount: {
    ...typography.body,
    fontWeight: '700',
    color: colors.success,
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  roundLabel: {
    ...typography.caption,
    color: colors.purple,
    fontWeight: '600',
  },

  // Description
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
});
