import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TextInput, ActivityIndicator, Pressable, RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { servicesApi } from '../../api/endpoints/servicesApi';
import { ServicesStackParamList } from '../../types/navigation';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, typography, radius } from '../../theme';
import { Service } from '@fetchwork/shared';

type Props = NativeStackScreenProps<ServicesStackParamList, 'BrowseServices'>;

export default function BrowseServicesScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const numColumns = width >= 700 ? 3 : width >= 420 ? 2 : 1;

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'one_time' | 'recurring'>('all');

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage,
    isLoading, isError, refetch, isRefetching,
  } = useInfiniteQuery({
    queryKey: ['services', 'browse', query, typeFilter],
    queryFn: ({ pageParam = 1 }) =>
      servicesApi.browse({
        search: query || undefined,
        serviceType: typeFilter !== 'all' ? typeFilter : undefined,
        page: pageParam as number,
      }),
    getNextPageParam: (last) => last.page < last.pages ? last.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const services: Service[] = data?.pages.flatMap(p => p.services) ?? [];

  const renderService = useCallback(({ item: svc }: { item: Service }) => {
    const isRecurring = svc.serviceType === 'recurring';
    const price = svc.pricing?.basic?.price;
    const cycle = svc.recurring?.billingCycle;
    const priceLabel = price
      ? `$${price}${isRecurring ? ` / ${cycle === 'per_session' ? 'session' : cycle === 'weekly' ? 'wk' : 'mo'}` : ''}`
      : '—';

    return (
      <Card onPress={() => navigation.navigate('ServiceDetail', { id: svc._id })} style={styles.card}>
        {isRecurring && (
          <View style={styles.recurringBadge}><Text style={styles.recurringText}>🔄 Recurring</Text></View>
        )}
        <Text style={styles.svcTitle} numberOfLines={2}>{svc.title}</Text>
        <View style={styles.providerRow}>
          <Avatar name={`${svc.freelancer?.firstName} ${svc.freelancer?.lastName}`} size="xs" />
          <Text style={styles.providerName} numberOfLines={1}>
            {svc.freelancer?.firstName} {svc.freelancer?.lastName}
          </Text>
          {(svc.freelancer?.rating ?? 0) > 0 && (
            <Text style={styles.rating}>⭐ {svc.freelancer!.rating!.toFixed(1)}</Text>
          )}
        </View>
        <Text style={styles.svcDesc} numberOfLines={2}>{svc.description}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.price}>{priceLabel}</Text>
          {isRecurring && svc.recurring?.sessionDuration && (
            <Text style={styles.duration}>
              ⏱ {svc.recurring.sessionDuration < 60
                ? `${svc.recurring.sessionDuration}min`
                : `${svc.recurring.sessionDuration / 60}hr`}
            </Text>
          )}
        </View>
      </Card>
    );
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput style={styles.searchInput} placeholder="Search services..."
          placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch}
          onSubmitEditing={() => setQuery(search.trim())} returnKeyType="search" />
        {search.length > 0 && (
          <Pressable onPress={() => { setSearch(''); setQuery(''); }} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Type filter */}
      <View style={styles.filterRow}>
        {(['all', 'one_time', 'recurring'] as const).map(t => (
          <Pressable key={t} style={[styles.filterBtn, typeFilter === t && styles.filterBtnActive]}
            onPress={() => setTypeFilter(t)}>
            <Text style={[styles.filterText, typeFilter === t && styles.filterTextActive]}>
              {t === 'all' ? 'All' : t === 'one_time' ? '📦 One-Time' : '🔄 Recurring'}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : isError ? (
        <EmptyState emoji="⚠️" title="Couldn't load services" actionLabel="Retry" onAction={refetch} />
      ) : (
        <FlatList
          key={numColumns}
          data={services}
          keyExtractor={s => s._id}
          renderItem={renderService}
          contentContainerStyle={styles.list}
          numColumns={numColumns}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null}
          ListEmptyComponent={<EmptyState emoji="🛎️" title="No services found" subtitle="Try a different search" />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.bgSubtle },
  searchBar:      {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    margin: spacing.md, borderRadius: 12, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: colors.border, height: 44,
  },
  searchInput:    { flex: 1, fontSize: 15, color: colors.textDark },
  filterRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  filterBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  filterBtnActive:{ borderColor: colors.primary, backgroundColor: colors.primaryLight },
  filterText:     { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: colors.primary, fontWeight: '700' },
  list:           { padding: spacing.sm, paddingBottom: 80 },
  row:            { gap: spacing.sm, paddingHorizontal: spacing.sm },
  card:           { flex: 1, marginBottom: spacing.sm },
  recurringBadge: { backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 6 },
  recurringText:  { fontSize: 10, color: '#166534', fontWeight: '600' },
  svcTitle:       { ...typography.label, marginBottom: 6 },
  providerRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  providerName:   { ...typography.caption, flex: 1 },
  rating:         { ...typography.caption },
  svcDesc:        { ...typography.caption, marginBottom: 8 },
  cardFooter:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price:          { fontSize: 14, fontWeight: '700', color: colors.primary },
  duration:       { ...typography.caption },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchIcon:     { marginRight: 6 },
  footerLoader:   { margin: 20 },
});
