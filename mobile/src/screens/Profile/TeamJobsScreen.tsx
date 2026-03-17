import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl,
  SafeAreaView, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Badge from '../../components/common/Badge';
import Card from '../../components/common/Card';
import EmptyState from '../../components/common/EmptyState';
import { teamsApi } from '../../api/endpoints/teamsApi';
import { ProfileStackParamList } from '../../types/navigation';
import { colors, radius, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TeamJobs'>;
type TabKey = 'active' | 'pending';

// ── Local types based on API shape ──────────────────────────────────────────

type JobClient = { _id: string; firstName?: string; lastName?: string; username?: string };
type JobAssignee = { _id: string; firstName?: string; lastName?: string; username?: string };

type AssignedJob = {
  _id: string;
  title: string;
  status: string;
  budget?: { min?: number; max?: number };
  client?: JobClient;
  assignedTo?: JobAssignee;
  autoReleaseAt?: string;
};

type TeamProposal = {
  _id: string;
  proposedBudget?: number;
  proposedDuration?: string;
  status?: string;
};

type PendingProposalJob = {
  _id: string;
  title: string;
  status: string;
  budget?: { min?: number; max?: number };
  client?: JobClient;
  teamProposal?: TeamProposal;
};

const STATUS_LABELS: Record<string, { label: string; variant: 'primary' | 'purple' | 'warning' | 'success' | 'neutral' }> = {
  accepted:      { label: 'Accepted',    variant: 'primary' },
  pending_start: { label: 'Starting',    variant: 'purple' },
  in_progress:   { label: 'In Progress', variant: 'warning' },
  delivered:     { label: 'Delivered',    variant: 'success' },
  completed:     { label: 'Completed',   variant: 'success' },
  open:          { label: 'Open',        variant: 'neutral' },
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending Proposals' },
];

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
}

function daysLeft(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

export default function TeamJobsScreen({ route, navigation }: Props) {
  const { teamId } = route.params;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('active');

  const { data, refetch, isRefetching, isLoading, isError } = useQuery({
    queryKey: ['mobile-team-jobs', teamId],
    queryFn: () => teamsApi.getTeamJobs(teamId),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const activeJobs = (data?.assignedJobs || []) as AssignedJob[];
  const pendingJobs = (data?.pendingProposals || []) as PendingProposalJob[];

  const onWithdraw = useCallback((proposalId: string) => {
    Alert.alert('Withdraw proposal?', 'This will remove your team\'s proposal from this job.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          try {
            await teamsApi.withdrawTeamProposal(teamId, proposalId);
            queryClient.invalidateQueries({ queryKey: ['mobile-team-jobs', teamId] });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to withdraw';
            Alert.alert('Error', msg);
          }
        },
      },
    ]);
  }, [teamId, queryClient]);

  const navigateToJob = useCallback((jobId: string) => {
    // Navigate to job detail via the Jobs stack
    (navigation as unknown as { push: (screen: string, params: Record<string, string>) => void }).push('TeamJobs', { teamId });
    // For now, just show an alert since job detail lives in another stack
  }, [navigation, teamId]);

  // ── Loading / Error ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={s.safe}>
        <EmptyState title="Could not load jobs" subtitle="Something went wrong. Tap below to retry." actionLabel="Retry" onAction={() => refetch()} />
      </SafeAreaView>
    );
  }

  // ── Active tab ────────────────────────────────────────────────────────────

  const renderActive = () => {
    if (!activeJobs.length) {
      return <EmptyState title="No active jobs" subtitle="When a client accepts a team proposal, the job will appear here." />;
    }
    return (
      <View style={s.list}>
        {activeJobs.map((job) => {
          const sl = STATUS_LABELS[job.status] || { label: job.status, variant: 'neutral' as const };
          const auto = job.autoReleaseAt ? daysLeft(job.autoReleaseAt) : null;
          return (
            <Card key={job._id} style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.jobTitle} numberOfLines={2}>{job.title}</Text>
                <Badge label={sl.label} variant={sl.variant} />
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaText}>{fmt(job.budget?.max || job.budget?.min || 0)}</Text>
                {job.client && <Text style={s.metaText}>{job.client.firstName} {job.client.lastName}</Text>}
              </View>
              {job.assignedTo && (
                <Text style={s.leadText}>Lead: {job.assignedTo.firstName} {job.assignedTo.lastName}</Text>
              )}
              {auto !== null && auto >= 0 && (
                <Text style={s.autoRelease}>Auto-release in {auto}d</Text>
              )}
              {auto !== null && auto < 0 && (
                <Text style={[s.autoRelease, s.overdue]}>Auto-release overdue</Text>
              )}
            </Card>
          );
        })}
      </View>
    );
  };

  // ── Pending tab ───────────────────────────────────────────────────────────

  const renderPending = () => {
    if (!pendingJobs.length) {
      return <EmptyState title="No pending proposals" subtitle="Submit proposals on jobs using the &quot;Bid as Team&quot; option." />;
    }
    return (
      <View style={s.list}>
        {pendingJobs.map((job) => {
          const tp = job.teamProposal;
          return (
            <Card key={job._id} style={[s.card, s.cardPending]}>
              <View style={s.cardHeader}>
                <Text style={s.jobTitle} numberOfLines={2}>{job.title}</Text>
                <Badge label="Awaiting Response" variant="neutral" />
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaText}>Proposed: {tp ? fmt(tp.proposedBudget || 0) : '—'}</Text>
                {job.client && <Text style={s.metaText}>{job.client.firstName} {job.client.lastName}</Text>}
              </View>
              {tp?.proposedDuration && <Text style={s.metaText}>{tp.proposedDuration}</Text>}
              {tp && tp.status === 'pending' && (
                <Pressable style={s.withdrawButton} onPress={() => onWithdraw(tp._id)}>
                  <Text style={s.withdrawText}>Withdraw</Text>
                </Pressable>
              )}
            </Card>
          );
        })}
      </View>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const count = tab.key === 'active' ? activeJobs.length : pendingJobs.length;
          return (
            <Pressable key={tab.key} style={[s.tabButton, active && s.tabButtonActive]} onPress={() => setActiveTab(tab.key)}>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label} ({count})</Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
      >
        {activeTab === 'active' ? renderActive() : renderPending()}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.bgSubtle },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:   { padding: spacing.md, paddingBottom: spacing.xxl },
  list:     { gap: spacing.sm },

  // Tab bar
  tabBar:          { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabButton:       { flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 2, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: colors.primary },
  tabLabel:        { ...typography.label, color: colors.textMuted },
  tabLabelActive:  { color: colors.primary },

  // Cards
  card:        { marginBottom: 0 },
  cardPending: { borderColor: '#fbbf24' },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  jobTitle:    { ...typography.body, fontWeight: '600', color: colors.textDark, flex: 1 },
  metaRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  metaText:    { ...typography.caption, color: colors.textSecondary },
  leadText:    { ...typography.caption, color: colors.primary, fontWeight: '500', marginBottom: spacing.xs },
  autoRelease: { ...typography.caption, color: '#d97706', fontWeight: '500' },
  overdue:     { color: colors.danger },

  // Withdraw button
  withdrawButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  withdrawText: { ...typography.label, color: colors.danger, fontWeight: '600' },
});
