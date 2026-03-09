import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl,
  SafeAreaView, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Avatar from '../../components/common/Avatar';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import EmptyState from '../../components/common/EmptyState';
import Input from '../../components/common/Input';
import { teamsApi, TeamMember, TeamAuditLog, MobileTeam } from '../../api/endpoints/teamsApi';
import { useAuth } from '../../context/AuthContext';
import { ProfileStackParamList } from '../../types/navigation';
import { colors, radius, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TeamDetail'>;
type TabKey = 'dashboard' | 'members' | 'wallet' | 'settings';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'members', label: 'Members' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'settings', label: 'Settings' },
];

const ROLE_OPTIONS: Array<{ label: string; value: 'member' | 'manager' | 'admin' }> = [
  { label: 'Member', value: 'member' },
  { label: 'Manager', value: 'manager' },
  { label: 'Admin', value: 'admin' },
];

function getMemberName(m: TeamMember): string {
  if (typeof m.user === 'string') return m.user;
  const u = m.user;
  return `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || u?.email || 'Member';
}

function getMemberId(m: TeamMember): string {
  return typeof m.user === 'string' ? m.user : m.user?._id || '';
}

function getMemberImage(m: TeamMember): string | undefined {
  return typeof m.user === 'string' ? undefined : m.user?.profileImage ?? undefined;
}

function formatTimeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function roleBadgeVariant(role: string): 'purple' | 'danger' | 'warning' | 'neutral' {
  if (role === 'owner') return 'purple';
  if (role === 'admin') return 'danger';
  if (role === 'manager') return 'warning';
  return 'neutral';
}

type ApiError = { response?: { data?: { error?: string } } };

export default function TeamDetailScreen({ route }: Props) {
  const { teamId } = route.params;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'manager' | 'admin'>('member');
  const [transferTargetUserId, setTransferTargetUserId] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────

  const { data, refetch, isRefetching, isLoading, isError } = useQuery({
    queryKey: ['mobile-team-detail', teamId],
    queryFn: () => teamsApi.getTeam(teamId),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const team: MobileTeam | undefined = data?.team;

  const myMember = useMemo(() => {
    if (!team?.members || !user?._id) return null;
    return team.members.find((m) => getMemberId(m) === user._id) ?? null;
  }, [team?.members, user?._id]);

  const myRole = team?.currentUserRole || myMember?.role || 'member';
  const isOwner = Boolean(team?.currentUserIsOwner || team?.currentUserCanDelete || myRole === 'owner');
  const isAdmin = myRole === 'admin';
  const canManageMembers = Boolean(team?.currentUserCanManageMembers || isOwner || isAdmin || myRole === 'manager');

  const activeMembers = useMemo(
    () => (team?.members || []).filter((m) => m.status === 'active'),
    [team?.members],
  );
  const transferCandidates = useMemo(
    () => activeMembers.filter((m) => m.role !== 'owner'),
    [activeMembers],
  );

  const { data: auditData, refetch: refetchAudit, isFetching: auditFetching } = useQuery({
    queryKey: ['mobile-team-audit', teamId],
    queryFn: () => teamsApi.getAuditLogs(teamId, { page: 1, limit: 5 }),
    enabled: isOwner || isAdmin,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const auditLogs: TeamAuditLog[] = auditData?.logs || [];

  const { data: spendControlsData, refetch: refetchSpendControls } = useQuery({
    queryKey: ['mobile-team-spend-controls', teamId],
    queryFn: () => teamsApi.getSpendControls(teamId),
    enabled: isOwner,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────

  const invalidateTeam = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mobile-team-detail', teamId] });
    queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
  }, [queryClient, teamId]);

  const inviteMutation = useMutation({
    mutationFn: () => teamsApi.inviteMember(teamId, { email: inviteEmail.trim(), role: inviteRole }),
    onSuccess: (res) => { Alert.alert('Success', res.message || 'Invitation sent'); setInviteEmail(''); invalidateTeam(); },
    onError: (err: ApiError) => { Alert.alert('Error', err?.response?.data?.error || 'Failed to send invitation'); },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => teamsApi.removeMember(teamId, userId),
    onSuccess: () => invalidateTeam(),
    onError: (err: ApiError) => { Alert.alert('Error', err?.response?.data?.error || 'Failed to remove member'); },
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: (targetUserId: string) => teamsApi.transferOwnership(teamId, targetUserId),
    onSuccess: (res) => { Alert.alert('Success', res.message || 'Ownership transferred'); setTransferTargetUserId(''); invalidateTeam(); },
    onError: (err: ApiError) => { Alert.alert('Error', err?.response?.data?.error || 'Failed to transfer ownership'); },
  });

  // ── Actions ────────────────────────────────────────────────────────────

  const onInvite = useCallback(() => {
    if (!inviteEmail.trim()) { Alert.alert('Validation', 'Email is required'); return; }
    inviteMutation.mutate();
  }, [inviteEmail, inviteMutation]);

  const onRemoveMember = useCallback((member: TeamMember) => {
    const id = getMemberId(member);
    if (!id) return;
    Alert.alert('Remove member?', 'This user will lose access to the team.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMemberMutation.mutate(id) },
    ]);
  }, [removeMemberMutation]);

  const onTransferOwnership = useCallback(() => {
    if (!transferTargetUserId) return;
    Alert.alert('Transfer ownership?', 'This will remove your owner privileges and cannot be auto-reverted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Transfer', style: 'destructive', onPress: () => transferOwnershipMutation.mutate(transferTargetUserId) },
    ]);
  }, [transferTargetUserId, transferOwnershipMutation]);

  const onRefreshAll = useCallback(() => {
    refetch();
    if (isOwner || isAdmin) refetchAudit();
    if (isOwner) refetchSpendControls();
  }, [refetch, refetchAudit, refetchSpendControls, isOwner, isAdmin]);

  // ── Loading / Error ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (isError || !team) {
    return (
      <SafeAreaView style={s.safe}>
        <EmptyState title="Could not load team" subtitle="Something went wrong. Tap below to retry." actionLabel="Retry" onAction={() => refetch()} />
      </SafeAreaView>
    );
  }

  // ── Tab: Dashboard ─────────────────────────────────────────────────────

  const renderDashboard = () => (
    <View style={s.tabContent}>
      <Card>
        <Text style={s.teamName}>{team.name}</Text>
        <Badge label={team.type === 'agency' ? 'Agency' : 'Client Team'} variant={team.type === 'agency' ? 'purple' : 'primary'} />
        {team.description ? <Text style={s.description}>{team.description}</Text> : null}
      </Card>

      <View style={s.statsGrid}>
        {[
          { value: String(activeMembers.length), label: 'Members' },
          { value: '0', label: 'Active Jobs' },
          { value: '$0', label: 'Balance' },
          { value: '0', label: 'Pending' },
        ].map((stat) => (
          <Card key={stat.label} style={s.statCard}>
            <Text style={s.statValue}>{stat.value}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </Card>
        ))}
      </View>

      {(isOwner || isAdmin) && (
        <Card>
          <Text style={s.sectionTitle}>Recent Activity</Text>
          {auditFetching && !auditLogs.length ? (
            <ActivityIndicator size="small" color={colors.primary} style={s.activityLoading} />
          ) : null}
          {!auditFetching && !auditLogs.length ? <Text style={s.emptyText}>No activity recorded yet.</Text> : null}
          {auditLogs.map((log) => (
            <View key={log._id} style={s.activityRow}>
              <View style={s.activityDot} />
              <View style={s.activityContent}>
                <Text style={s.activityAction}>{String(log.action || '').replace(/_/g, ' ')}</Text>
                <Text style={s.activityMeta}>
                  {log.actor?.firstName || 'User'} {log.actor?.lastName || ''} {'\u00B7'} {formatTimeAgo(log.createdAt)}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}
    </View>
  );

  // ── Tab: Members ───────────────────────────────────────────────────────

  const renderMembers = () => (
    <View style={s.tabContent}>
      <Card>
        <Text style={s.sectionTitle}>Team Members ({activeMembers.length})</Text>
        {!activeMembers.length ? <Text style={s.emptyText}>No active members.</Text> : null}
        {activeMembers.map((member) => {
          const memberId = getMemberId(member);
          const name = getMemberName(member);
          const canRemove = canManageMembers && member.role !== 'owner' && memberId !== user?._id;
          return (
            <View key={`${memberId}-${member.role}`} style={s.memberRow}>
              <Avatar uri={getMemberImage(member)} name={name} size="sm" />
              <View style={s.memberInfo}>
                <Text style={s.memberName}>{name}</Text>
                <Badge label={member.role} variant={roleBadgeVariant(member.role)} />
              </View>
              {canRemove ? (
                <Button label="Remove" variant="danger" size="sm" onPress={() => onRemoveMember(member)} loading={removeMemberMutation.isPending} />
              ) : null}
            </View>
          );
        })}
      </Card>

      {canManageMembers && (
        <Card>
          <Text style={s.sectionTitle}>Invite Member</Text>
          <Input label="Email" value={inviteEmail} onChangeText={setInviteEmail} placeholder="teammate@email.com" autoCapitalize="none" keyboardType="email-address" />
          <Text style={s.fieldLabel}>Role</Text>
          <View style={s.roleRow}>
            {ROLE_OPTIONS.map((opt) => (
              <Pressable key={opt.value} style={[s.roleChip, inviteRole === opt.value && s.roleChipActive]} onPress={() => setInviteRole(opt.value)}>
                <Text style={[s.roleChipText, inviteRole === opt.value && s.roleChipTextActive]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
          <Button label="Send Invite" onPress={onInvite} loading={inviteMutation.isPending} disabled={inviteMutation.isPending} fullWidth />
        </Card>
      )}
    </View>
  );

  // ── Tab: Wallet ────────────────────────────────────────────────────────

  const renderWallet = () => {
    const sc = spendControlsData?.spendControls;
    return (
      <View style={s.tabContent}>
        <Card style={s.balanceCard}>
          <Text style={s.balanceLabel}>Team Balance</Text>
          <Text style={s.balanceValue}>$0.00</Text>
        </Card>

        {isOwner && sc ? (
          <Card>
            <Text style={s.sectionTitle}>Spend Controls</Text>
            <View style={s.controlRow}>
              <Text style={s.controlLabel}>Monthly Cap</Text>
              <Text style={s.controlValue}>{sc.monthlyCapEnabled ? `$${Number(sc.monthlyCap || 0).toFixed(2)}` : 'Disabled'}</Text>
            </View>
            {sc.monthlyCapEnabled ? (
              <View style={s.controlRow}>
                <Text style={s.controlLabel}>Alert Threshold</Text>
                <Text style={s.controlValue}>{Math.round(Number(sc.alertThreshold || 0.8) * 100)}%</Text>
              </View>
            ) : null}
            {sc.currentMonthSpend !== undefined ? (
              <View style={s.controlRow}>
                <Text style={s.controlLabel}>Spent This Month</Text>
                <Text style={s.controlValue}>${Number(sc.currentMonthSpend).toFixed(2)}</Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <View style={s.comingSoonBox}>
            <Text style={s.comingSoonTitle}>Wallet Features</Text>
            <Text style={s.comingSoonText}>Full wallet management including deposits, withdrawals, and transaction history is coming soon.</Text>
          </View>
        </Card>
      </View>
    );
  };

  // ── Tab: Settings ──────────────────────────────────────────────────────

  const renderSettings = () => (
    <View style={s.tabContent}>
      <Card>
        <Text style={s.sectionTitle}>Team Information</Text>
        <View style={s.infoRow}><Text style={s.infoLabel}>Name</Text><Text style={s.infoValue}>{team.name}</Text></View>
        <View style={s.infoRow}><Text style={s.infoLabel}>Type</Text><Text style={s.infoValue}>{team.type === 'agency' ? 'Agency' : 'Client Team'}</Text></View>
        {team.description ? (
          <View style={s.infoRow}><Text style={s.infoLabel}>Description</Text><Text style={s.infoValue}>{team.description}</Text></View>
        ) : null}
      </Card>

      {isOwner && transferCandidates.length > 0 ? (
        <Card>
          <Text style={s.sectionTitle}>Transfer Ownership</Text>
          <Text style={s.description}>Choose an active member to become the new owner. This action cannot be auto-reverted.</Text>
          <View style={s.transferList}>
            {transferCandidates.map((member) => {
              const memberId = getMemberId(member);
              const name = getMemberName(member);
              const selected = transferTargetUserId === memberId;
              return (
                <Pressable key={memberId} style={[s.transferOption, selected && s.transferOptionSelected]} onPress={() => setTransferTargetUserId(memberId)}>
                  <Avatar uri={getMemberImage(member)} name={name} size="xs" />
                  <Text style={[s.transferOptionText, selected && s.transferOptionTextSelected]}>{name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Button
            label="Transfer Ownership" variant="danger" onPress={onTransferOwnership} fullWidth
            loading={transferOwnershipMutation.isPending}
            disabled={!transferTargetUserId || transferOwnershipMutation.isPending || team.transferState === 'applying' || team.transferState === 'pending'}
          />
          {team.transferState && team.transferState !== 'idle' ? (
            <Text style={s.warningText}>Ownership transfer is currently in progress.</Text>
          ) : null}
        </Card>
      ) : null}

      <Card style={s.dangerCard}>
        <Text style={s.dangerTitle}>Danger Zone</Text>
        <Text style={s.dangerText}>Deleting a team is permanent and will remove all members, history, and associated data. This feature is not yet available on mobile.</Text>
      </Card>
    </View>
  );

  // ── Main render ────────────────────────────────────────────────────────

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'members':   return renderMembers();
      case 'wallet':    return renderWallet();
      case 'settings':  return renderSettings();
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable key={tab.key} style={[s.tabButton, active && s.tabButtonActive]} onPress={() => setActiveTab(tab.key)}>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefreshAll} tintColor={colors.primary} />}
      >
        {renderTabContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bgSubtle },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:     { padding: spacing.md, paddingBottom: spacing.xxl },
  tabContent: { gap: spacing.sm },

  // Tab bar
  tabBar:         { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabButton:      { flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 2, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabButtonActive:{ borderBottomColor: colors.primary },
  tabLabel:       { ...typography.label, color: colors.textMuted },
  tabLabelActive: { color: colors.primary },

  // Dashboard
  teamName:    { ...typography.h3, color: colors.textDark, marginBottom: spacing.xs },
  description: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs },
  statsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard:    { width: '47%' as unknown as number, flexGrow: 1, alignItems: 'center' },
  statValue:   { ...typography.h2, color: colors.textDark },
  statLabel:   { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  sectionTitle:{ ...typography.h4, color: colors.textDark, marginBottom: spacing.sm },
  emptyText:   { ...typography.bodySmall, color: colors.textMuted },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.bgMuted },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 },
  activityContent: { flex: 1 },
  activityAction: { ...typography.body, color: colors.textDark, fontWeight: '500', textTransform: 'capitalize' },
  activityMeta: { ...typography.caption, color: colors.textMuted },
  activityLoading: { marginVertical: spacing.sm },

  // Members
  memberRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.bgMuted },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { ...typography.body, color: colors.textDark, fontWeight: '600' },
  fieldLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  roleRow:    { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  roleChip:   { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  roleChipActive:     { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roleChipText:       { ...typography.label, color: colors.textSecondary },
  roleChipTextActive: { color: colors.primary },

  // Wallet
  balanceCard:    { alignItems: 'center', paddingVertical: spacing.lg },
  balanceLabel:   { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  balanceValue:   { ...typography.h1, color: colors.textDark },
  controlRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.bgMuted },
  controlLabel:   { ...typography.body, color: colors.textSecondary },
  controlValue:   { ...typography.body, color: colors.textDark, fontWeight: '600' },
  comingSoonBox:  { alignItems: 'center', paddingVertical: spacing.md },
  comingSoonTitle:{ ...typography.h4, color: colors.textSecondary, marginBottom: spacing.xs },
  comingSoonText: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },

  // Settings
  infoRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: spacing.xs + 2, borderTopWidth: 1, borderTopColor: colors.bgMuted },
  infoLabel:  { ...typography.label, color: colors.textSecondary, flex: 1 },
  infoValue:  { ...typography.body, color: colors.textDark, flex: 2, textAlign: 'right' },
  transferList:   { gap: spacing.xs, marginBottom: spacing.md },
  transferOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  transferOptionSelected:     { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  transferOptionText:         { ...typography.body, color: colors.text },
  transferOptionTextSelected: { color: colors.primary, fontWeight: '600' },
  warningText: { ...typography.caption, color: colors.warning, marginTop: spacing.xs, textAlign: 'center' },
  dangerCard:  { borderColor: colors.dangerLight, backgroundColor: colors.dangerLight },
  dangerTitle: { ...typography.h4, color: colors.danger, marginBottom: spacing.xs },
  dangerText:  { ...typography.bodySmall, color: colors.danger },
});
