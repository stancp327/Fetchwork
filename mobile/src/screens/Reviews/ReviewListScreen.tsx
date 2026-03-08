import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  Pressable, RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { reviewsApi, Review } from '../../api/endpoints/reviewsApi';
import { ProfileStackParamList } from '../../types/navigation';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ReviewList'>;

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(s => (
        <Ionicons
          key={s}
          name={s <= rating ? 'star' : 'star-outline'}
          size={size}
          color={s <= rating ? colors.warning : colors.textMuted}
        />
      ))}
    </View>
  );
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? count / total : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={styles.barCount}>{count}</Text>
    </View>
  );
}

export default function ReviewListScreen({ route, navigation }: Props) {
  const { freelancerId, serviceId, targetName } = route.params;
  const [refreshing, setRefreshing] = useState(false);

  const { data: reviews = [], refetch, isLoading } = useQuery({
    queryKey: ['reviews', freelancerId, serviceId],
    queryFn: () => reviewsApi.list({ freelancerId, serviceId }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  const dist = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
  }));

  const renderReview = ({ item }: { item: Review }) => (
    <Card style={styles.card}>
      <View style={styles.reviewHeader}>
        <Avatar
          uri={item.reviewer.avatar}
          name={`${item.reviewer.firstName} ${item.reviewer.lastName}`}
          size={36}
        />
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewerName}>
            {item.reviewer.firstName} {item.reviewer.lastName}
          </Text>
          <View style={styles.reviewSubRow}>
            <StarRow rating={item.rating} />
            <Text style={styles.reviewDate}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <Pressable onPress={() => reviewsApi.markHelpful(item._id)} hitSlop={8} style={styles.helpfulBtn}>
          <Ionicons name="thumbs-up-outline" size={14} color={colors.textMuted} />
          {(item.helpfulCount ?? 0) > 0 && (
            <Text style={styles.helpfulCount}>{item.helpfulCount}</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.comment}>{item.comment}</Text>

      {item.response && (
        <View style={styles.response}>
          <Text style={styles.responseLabel}>Response from {targetName}</Text>
          <Text style={styles.responseText}>{item.response.comment}</Text>
        </View>
      )}
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={reviews}
        keyExtractor={r => r._id}
        renderItem={renderReview}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={reviews.length > 0 ? (
          <Card style={styles.summary}>
            <View style={styles.summaryTop}>
              <Text style={styles.avgNumber}>{avg.toFixed(1)}</Text>
              <View>
                <StarRow rating={Math.round(avg)} size={20} />
                <Text style={styles.reviewCount}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            <View style={styles.bars}>
              {dist.map(d => (
                <RatingBar key={d.star} label={`${d.star}★`} count={d.count} total={reviews.length} />
              ))}
            </View>
          </Card>
        ) : null}
        ListEmptyComponent={
          !isLoading ? <EmptyState icon="star-outline" title="No reviews yet" message="Be the first to leave a review" /> : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, flexGrow: 1 },

  summary: { marginBottom: spacing.md },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  avgNumber: { fontSize: 48, fontWeight: '700', color: colors.text },
  reviewCount: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },

  bars: { gap: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { ...typography.caption, color: colors.textMuted, width: 20, textAlign: 'right' },
  barTrack: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.warning, borderRadius: 3 },
  barCount: { ...typography.caption, color: colors.textMuted, width: 20 },

  card: { marginBottom: spacing.sm },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  reviewMeta: { flex: 1 },
  reviewerName: { ...typography.body, fontWeight: '600', color: colors.text },
  reviewSubRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  reviewDate: { ...typography.caption, color: colors.textMuted },
  helpfulBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: spacing.xs },
  helpfulCount: { ...typography.caption, color: colors.textMuted },
  starRow: { flexDirection: 'row', gap: 1 },
  comment: { ...typography.body, color: colors.text, lineHeight: 20 },

  response: {
    marginTop: spacing.sm, padding: spacing.sm,
    backgroundColor: colors.background, borderRadius: 6,
    borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  responseLabel: { ...typography.caption, color: colors.primary, fontWeight: '600', marginBottom: 2 },
  responseText: { ...typography.bodySmall, color: colors.text },
});
