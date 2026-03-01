import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { jobsApi } from '../../api/endpoints/jobsApi';
import { JobsStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Badge, { getJobStatusVariant } from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, typography, radius } from '../../theme';
import { Job } from '@fetchwork/shared';

type Props = NativeStackScreenProps<JobsStackParamList, 'MyJobs'>;

const STATUS_TABS = ['all', 'open', 'in_progress', 'completed'];

export default function MyJobsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');

  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-jobs', activeTab],
    queryFn: () => jobsApi.myJobs(activeTab !== 'all' ? { status: activeTab } : {}),
  });

  const jobs: Job[] = Array.isArray(data) ? data : [];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Status tabs */}
      <View style={styles.tabs}>
        {STATUS_TABS.map(t => (
          <Pressable key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'all' ? 'All' : t.replace('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={j => j._id}
          contentContainerStyle={styles.list}
          renderItem={({ item: job }) => (
            <Card onPress={() => navigation.navigate('JobDetail', { id: job._id })} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.title} numberOfLines={1}>{job.title}</Text>
                <Badge label={job.status.replace(/_/g, ' ')} variant={getJobStatusVariant(job.status)} />
              </View>
              <Text style={styles.meta}>
                ${job.budget?.amount}{job.budget?.type === 'hourly' ? '/hr' : ''} · {new Date(job.createdAt).toLocaleDateString()}
              </Text>
              {user?.role === 'client' && typeof job.proposalCount === 'number' && (
                <Text style={styles.proposals}>{job.proposalCount} proposal{job.proposalCount !== 1 ? 's' : ''}</Text>
              )}
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState emoji="📋" title="No jobs yet"
              subtitle={user?.role === 'client' ? 'Post your first job to get started' : 'Apply to jobs to see them here'}
              actionLabel={user?.role === 'client' ? 'Post a Job' : 'Browse Jobs'}
              onAction={() => navigation.navigate(user?.role === 'client' ? 'PostJob' : 'BrowseJobs')}
            />
          }
          onRefresh={refetch}
          refreshing={isRefetching}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.bgSubtle },
  tabs:          { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:           { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText:       { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  list:          { padding: spacing.md, paddingBottom: 80 },
  card:          { marginBottom: spacing.sm },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title:         { ...typography.h4, flex: 1, marginRight: spacing.sm },
  meta:          { ...typography.caption },
  proposals:     { ...typography.bodySmall, color: colors.primary, marginTop: 4 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
