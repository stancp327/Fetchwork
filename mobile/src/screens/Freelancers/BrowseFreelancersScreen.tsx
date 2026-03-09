import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TextInput, ActivityIndicator, RefreshControl, Pressable, ScrollView,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { freelancersApi, FreelancerListItem } from '../../api/endpoints/freelancersApi';
import { JobsStackParamList } from '../../types/navigation';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<JobsStackParamList, 'BrowseFreelancers'>;

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'design', label: 'Design' },
  { key: 'development', label: 'Dev' },
  { key: 'writing', label: 'Writing' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'photography', label: 'Photo' },
  { key: 'video', label: 'Video' },
  { key: 'music', label: 'Music' },
];

type SortOption = 'rating' | 'reviewCount' | 'hourlyRate_asc' | 'hourlyRate_desc';
const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'rating', label: 'Top Rated' },
  { key: 'reviewCount', label: 'Most Reviews' },
  { key: 'hourlyRate_asc', label: 'Rate: Low' },
  { key: 'hourlyRate_desc', label: 'Rate: High' },
];

export default function BrowseFreelancersScreen({ navigation }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search (400ms)
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage,
    isLoading, isError, refetch, isRefetching,
  } = useInfiniteQuery({
    queryKey: ['freelancers', 'browse', debouncedSearch, category, sortBy],
    queryFn: ({ pageParam = 1 }) =>
      freelancersApi.browse({
        search: debouncedSearch || undefined,
        category: category !== 'all' ? category : undefined,
        sortBy,
        page: pageParam as number,
        limit: 20,
      }),
    getNextPageParam: (last) => last.page < last.pages ? last.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const freelancers: FreelancerListItem[] = data?.pages.flatMap(p => p.freelancers) ?? [];

  const handleClearSearch = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
  }, []);

  const renderFreelancer = useCallback(({ item }: { item: FreelancerListItem }) => {
    const fullName = `${item.firstName} ${item.lastName}`;
    const locationStr = [item.location?.city, item.location?.country].filter(Boolean).join(', ');

    return (
      <Card
        onPress={() => navigation.navigate('FreelancerProfile', { id: item._id })}
        style={styles.card}
      >
        <View style={styles.cardRow}>
          <Avatar
            uri={item.profilePicture}
            name={fullName}
            size="lg"
            online={item.isOnline}
          />
          <View style={styles.cardInfo}>
            <View style={styles.cardNameRow}>
              <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
              {item.isOnline && <View style={styles.onlineDot} />}
            </View>
            {!!item.headline && (
              <Text style={styles.headline} numberOfLines={1}>{item.headline}</Text>
            )}
            <View style={styles.ratingRow}>
              <Text style={styles.rating}>
                ⭐ {item.rating?.toFixed(1) || '0.0'}
              </Text>
              <Text style={styles.reviewCount}>({item.reviewCount || 0})</Text>
              {!!item.hourlyRate && (
                <Text style={styles.rate}>${item.hourlyRate}/hr</Text>
              )}
            </View>
            {!!locationStr && (
              <Text style={styles.location} numberOfLines={1}>📍 {locationStr}</Text>
            )}
          </View>
        </View>
        {!!item.skills?.length && (
          <View style={styles.skills}>
            {item.skills.slice(0, 3).map(s => (
              <View key={s} style={styles.skillTag}>
                <Text style={styles.skillText}>{s}</Text>
              </View>
            ))}
            {item.skills.length > 3 && (
              <Text style={styles.moreSkills}>+{item.skills.length - 3}</Text>
            )}
          </View>
        )}
      </Card>
    );
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search freelancers..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={handleClearSearch} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat.key}
            style={[styles.chip, category === cat.key && styles.chipActive]}
            onPress={() => setCategory(cat.key)}
          >
            <Text style={[styles.chipText, category === cat.key && styles.chipTextActive]}>
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Sort options */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
      >
        {SORT_OPTIONS.map(opt => (
          <Pressable
            key={opt.key}
            style={[styles.sortBtn, sortBy === opt.key && styles.sortBtnActive]}
            onPress={() => setSortBy(opt.key)}
          >
            <Text style={[styles.sortText, sortBy === opt.key && styles.sortTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <EmptyState
          emoji="⚠️"
          title="Couldn't load freelancers"
          subtitle="Pull to refresh"
          onAction={refetch}
          actionLabel="Retry"
        />
      ) : (
        <FlatList
          data={freelancers}
          keyExtractor={f => f._id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          renderItem={renderFreelancer}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyState
              emoji="👤"
              title="No freelancers found"
              subtitle={debouncedSearch ? 'Try a different search term' : 'Check back soon'}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bgSubtle },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, margin: spacing.md, marginBottom: spacing.sm,
    borderRadius: 12, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: colors.border, height: 44,
  },
  searchIcon:  { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, color: colors.textDark },
  chipRow:     { paddingHorizontal: spacing.md, gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:       { fontSize: 13, fontWeight: '500', color: colors.text },
  chipTextActive: { color: colors.white },
  sortRow:     { paddingHorizontal: spacing.md, gap: spacing.xs, marginBottom: spacing.sm },
  sortBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, backgroundColor: colors.bgMuted,
  },
  sortBtnActive:  { backgroundColor: colors.primaryLight },
  sortText:       { fontSize: 12, color: colors.textSecondary },
  sortTextActive: { color: colors.primary, fontWeight: '600' },
  list:        { padding: spacing.md, paddingTop: 0, paddingBottom: 100 },
  card:        { marginBottom: spacing.sm },
  cardRow:     { flexDirection: 'row', alignItems: 'center' },
  cardInfo:    { flex: 1, marginLeft: spacing.md },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name:        { ...typography.h4, flex: 1 },
  onlineDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.success,
  },
  headline:    { ...typography.caption, marginTop: 2 },
  ratingRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rating:      { fontSize: 13, fontWeight: '600', color: colors.textDark },
  reviewCount: { fontSize: 12, color: colors.textSecondary },
  rate:        { fontSize: 13, fontWeight: '700', color: colors.primary, marginLeft: 'auto' },
  location:    { ...typography.caption, marginTop: 2 },
  skills:      { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  skillTag:    { backgroundColor: colors.bgMuted, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  skillText:   { fontSize: 11, color: colors.textSecondary },
  moreSkills:  { fontSize: 11, color: colors.textMuted, alignSelf: 'center' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  footerLoader: { margin: 20 },
});
