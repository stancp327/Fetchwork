import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TextInput, ActivityIndicator, RefreshControl, Pressable,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { jobsApi } from '../../api/endpoints/jobsApi';
import { JobsStackParamList } from '../../types/navigation';
import Card from '../../components/common/Card';
import Badge, { getJobStatusVariant } from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, typography } from '../../theme';
import { Job } from '@fetchwork/shared';

type Props = NativeStackScreenProps<JobsStackParamList, 'BrowseJobs'>;

export default function BrowseJobsScreen({ navigation }: Props) {
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage,
    isLoading, isError, refetch, isRefetching,
  } = useInfiniteQuery({
    queryKey: ['jobs', 'browse', searchQuery],
    queryFn: ({ pageParam = 1 }) =>
      jobsApi.browse({ search: searchQuery || undefined, page: pageParam as number, limit: 20 }),
    getNextPageParam: (last) => last.page < last.pages ? last.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const jobs: Job[] = data?.pages.flatMap(p => p.jobs) ?? [];

  const handleSearch = useCallback(() => setSearchQuery(search.trim()), [search]);
  const handleClearSearch = () => { setSearch(''); setSearchQuery(''); };

  const renderJob = useCallback(({ item: job }: { item: Job }) => (
    <Card
      onPress={() => navigation.navigate('JobDetail', { id: job._id })}
      style={styles.card}
    >
      <View style={styles.cardTop}>
        <Text style={styles.title} numberOfLines={2}>{job.title}</Text>
        <Badge label={job.status.replace('_', ' ')} variant={getJobStatusVariant(job.status)} />
      </View>
      <Text style={styles.meta}>
        {job.client?.firstName} {job.client?.lastName}
        {job.budget?.amount ? ` · $${job.budget.amount}${job.budget.type === 'hourly' ? '/hr' : ''}` : ''}
        {job.isRemote ? ' · 🌐 Remote' : ''}
      </Text>
      <Text style={styles.desc} numberOfLines={2}>{job.description}</Text>
      {!!job.skills?.length && (
        <View style={styles.skills}>
          {job.skills.slice(0, 3).map(s => (
            <View key={s} style={styles.skillTag}><Text style={styles.skillText}>{s}</Text></View>
          ))}
        </View>
      )}
    </Card>
  ), [navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search jobs..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={handleClearSearch} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : isError ? (
        <EmptyState emoji="⚠️" title="Couldn't load jobs" subtitle="Pull to refresh" onAction={refetch} actionLabel="Retry" />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={j => j._id}
          renderItem={renderJob}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListEmptyComponent={<EmptyState emoji="📋" title="No jobs found" subtitle={searchQuery ? 'Try a different search term' : 'Check back soon'} />}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null}
        />
      )}

      {/* Post Job FAB */}
      <Pressable style={styles.fab} onPress={() => navigation.navigate('PostJob')}>
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bgSubtle },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, margin: spacing.md,
    borderRadius: 12, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: colors.border, height: 44,
  },
  searchIcon:  { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, color: colors.textDark },
  list:        { padding: spacing.md, paddingTop: 0, paddingBottom: 100 },
  card:        { marginBottom: spacing.sm },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title:       { ...typography.h4, flex: 1, marginRight: spacing.sm },
  meta:        { ...typography.caption, marginBottom: 6 },
  desc:        { ...typography.bodySmall, marginBottom: spacing.sm },
  skills:      { flexDirection: 'row', gap: 6 },
  skillTag:    { backgroundColor: colors.bgMuted, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  skillText:   { fontSize: 11, color: colors.textSecondary },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  footerLoader: { margin: 20 },
});
