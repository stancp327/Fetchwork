import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bookingsApi, BookingRole, BookingStatus } from '../../api/endpoints/bookingsApi';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, typography, radius } from '../../theme';
import { ProfileStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Bookings'>;

type Tab = BookingStatus;
const TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming',  label: 'Upcoming'  },
  { key: 'past',      label: 'Past'      },
  { key: 'cancelled', label: 'Cancelled' },
];

function bid(b: Record<string, unknown>): string {
  return (b.id as string) || (b._id as string) || '';
}

function formatTime12(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

interface StatusMeta { label: string; bg: string; color: string }
const STATUS_META: Record<string, StatusMeta> = {
  pending:   { label: 'Pending',   bg: '#fffbeb', color: '#92400e' },
  hold:      { label: 'Hold',      bg: '#fffbeb', color: '#92400e' },
  confirmed: { label: 'Confirmed', bg: '#ecfdf5', color: '#166534' },
  cancelled: { label: 'Cancelled', bg: colors.dangerLight, color: '#991b1b' },
  completed: { label: 'Completed', bg: colors.bgMuted, color: colors.textMuted },
  no_show:   { label: 'No Show',   bg: colors.dangerLight, color: '#991b1b' },
};

export default function BookingListScreen({ navigation }: Props) {
  const { user } = useAuthStore();
  const role: BookingRole = (user as { role?: string })?.role === 'freelancer' ? 'freelancer' : 'client';

  const [tab, setTab] = useState<Tab>('upcoming');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bookings', role, tab],
    queryFn:  () => bookingsApi.getMyBookings(role, tab),
  });

  const bookings: Record<string, unknown>[] =
    (data as { bookings?: Record<string, unknown>[] } | undefined)?.bookings ?? [];

  const renderBooking = useCallback(({ item: b }: { item: Record<string, unknown> }) => {
    const id        = bid(b);
    const statusKey = b.status as string;
    const meta      = STATUS_META[statusKey] ?? { label: statusKey, bg: colors.bgMuted, color: colors.textMuted };
    const service   = b.service as Record<string, unknown> | undefined;
    const title     = (service?.title as string) ?? (b.serviceTitle as string) ?? 'Service';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('BookingDetail', { id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
            {!!b.date && (
              <Text style={styles.cardMeta}>📅 {formatDate(b.date as string)}</Text>
            )}
            {!!b.startTime && (
              <Text style={styles.cardMeta}>
                🕐 {formatTime12(b.startTime as string)} — {formatTime12(b.endTime as string)}
              </Text>
            )}
            {!!b.bookingRef && (
              <Text style={styles.cardRef}>#{b.bookingRef as string}</Text>
            )}
          </View>
          <View style={[styles.badge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation]);

  const ListEmpty = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>📅</Text>
      <Text style={styles.emptyTitle}>No {tab} bookings</Text>
      <Text style={styles.emptySubtitle}>
        {tab === 'upcoming' ? 'Book a service to get started!' : `No ${tab} bookings yet.`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={{ ...typography.bodySmall, color: colors.danger }}>Failed to load bookings.</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={b => bid(b) || String(Math.random())}
          renderItem={renderBooking}
          ListEmptyComponent={<ListEmpty />}
          contentContainerStyle={[styles.listContent, bookings.length === 0 && { flex: 1 }]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
  },
  tabBar: {
    flexDirection:     'row',
    backgroundColor:   colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  tab: {
    flex:              1,
    paddingVertical:   spacing.md,
    alignItems:        'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    minHeight:         44,
    justifyContent:    'center',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.label,
    color: colors.textMuted,
  },
  tabTextActive: {
    color:      colors.primary,
    fontWeight: '700',
  },
  loader: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  listContent: {
    padding:   spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    marginBottom:    spacing.sm,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  cardTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    gap:            spacing.sm,
  },
  cardInfo: { flex: 1, gap: 4 },
  cardTitle: { ...typography.h4 },
  cardMeta:  { ...typography.bodySmall },
  cardRef:   { ...typography.caption },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
    borderRadius:      radius.full,
    flexShrink:        0,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  empty: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    padding:        spacing.xl,
  },
  emptyIcon:     { fontSize: 40, marginBottom: spacing.md },
  emptyTitle:    { ...typography.h3, marginBottom: spacing.xs, textAlign: 'center' },
  emptySubtitle: { ...typography.bodySmall, textAlign: 'center' },
});
