import React, { useMemo, useState } from 'react';
import { Alert, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { TeamAuditLog, teamsApi, TeamMember, TeamMemberRole } from '../../api/endpoints/teamsApi';
import { ProfileStackParamList } from '../../types/navigation';
import { colors, radius, spacing, typography } from '../../theme';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TeamDetail'>;

const ROLE_OPTIONS: Array<{ label: string; value: 'member' | 'manager' | 'admin' }> = [
  { label: 'Member', value: 'member' },
  { label: 'Manager', value: 'manager' },
  { label: 'Admin', value: 'admin' },
];

export default function TeamDetailScreen({ route }: Props) {
  const { teamId } = route.params;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'manager' | 'admin'>('member');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [transferTargetUserId, setTransferTargetUserId] = useState('');

  const { data, refetch, isRefetching, isLoading } = useQuery({
    queryKey: ['mobile-team-detail', teamId],
    queryFn: () => teamsApi.getTeam(teamId),
  });

  const team = data?.team;

  const myMember = useMemo(() => {
    if (!team?.members || !user?._id) return null;
    return team.members.find((m) => {
      const memberId = typeof m.user === 'string' ? m.user : m.user?._id;
      return memberId === user._id;
    });
  }, [team?.members, user?._id]);

  const myRole = ((team?.currentUserRole || myMember?.role || 'member') as TeamMemberRole);
  const isOwner = Boolean(team?.currentUserIsOwner || team?.currentUserCanDelete || myRole === 'owner');
  const isAdmin = myRole === 'admin';
  const canManageMembers = Boolean(team?.currentUserCanManageMembers || isOwner || isAdmin || myRole === 'manager');

  const inviteMutation = useMutation({
    mutationFn: () => teamsApi.inviteMember(teamId, { email: inviteEmail.trim(), role: inviteRole }),
    onSuccess: (res) => {
      setMessage(res.message || 'Invitation sent');
      setError('');
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['mobile-team-detail', teamId] });
      queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to send invitation');
      setMessage('');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => teamsApi.removeMember(teamId, userId),
    onSuccess: (res) => {
      setMessage(res.message || 'Member removed');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['mobile-team-detail', teamId] });
      queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to remove member');
      setMessage('');
    },
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: (targetUserId: string) => teamsApi.transferOwnership(teamId, targetUserId),
    onSuccess: (res) => {
      setMessage(res.message || 'Ownership transferred');
      setError('');
      setTransferTargetUserId('');
      queryClient.invalidateQueries({ queryKey: ['mobile-team-detail', teamId] });
      queryClient.invalidateQueries({ queryKey: ['mobile-team-audit', teamId] });
      queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to transfer ownership');
      setMessage('');
    },
  });

  const { data: auditData, refetch: refetchAudit, isFetching: auditLoading } = useQuery({
    queryKey: ['mobile-team-audit', teamId],
    queryFn: () => teamsApi.getAuditLogs(teamId, { page: 1, limit: 20 }),
    enabled: isOwner || isAdmin,
  });

  const onInvite = () => {
    if (!inviteEmail.trim()) {
      setError('Email is required');
      setMessage('');
      return;
    }
    setError('');
    setMessage('');
    inviteMutation.mutate();
  };

  const onRemoveMember = (member: TeamMember) => {
    const memberId = typeof member.user === 'string' ? member.user : member.user?._id;
    if (!memberId) return;

    Alert.alert('Remove member?', 'This user will lose access to the team.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeMemberMutation.mutate(memberId),
      },
    ]);
  };

  const activeMembers = (team?.members || []).filter((m) => m.status === 'active');
  const transferCandidates = activeMembers.filter((m) => m.role !== 'owner');
  const auditLogs: TeamAuditLog[] = auditData?.logs || [];

  const onTransferOwnership = () => {
    if (!transferTargetUserId) {
      setError('Pick a member to transfer ownership to');
      return;
    }

    Alert.alert(
      'Transfer ownership?',
      'This will remove your owner privileges and cannot be auto-reverted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: () => transferOwnershipMutation.mutate(transferTargetUserId),
        },
      ]
    );
  };

  const onRefreshAll = () => {
    refetch();
    if (isOwner || isAdmin) refetchAudit();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching || auditLoading} onRefresh={onRefreshAll} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <Text style={styles.name}>{team?.name || (isLoading ? 'Loading team…' : 'Team')}</Text>
          <Text style={styles.meta}>{team?.type === 'agency' ? 'Agency' : 'Client Team'}</Text>
          {!!team?.description && <Text style={styles.description}>{team.description}</Text>}
          {team?.transferState && team.transferState !== 'idle' && (
            <Text style={styles.warning}>Ownership transfer is currently in progress.</Text>
          )}
        </View>

        {canManageMembers && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Invite Member</Text>
            <Input
              label="Email"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="teammate@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.optionRow}>
              {ROLE_OPTIONS.map((option) => {
                const selected = inviteRole === option.value;
                return (
                  <Button
                    key={option.value}
                    label={option.label}
                    size="sm"
                    variant={selected ? 'primary' : 'secondary'}
                    onPress={() => setInviteRole(option.value)}
                    style={{ flex: 1 }}
                  />
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {message ? <Text style={styles.success}>{message}</Text> : null}

            <Button
              label="Send Invite"
              onPress={onInvite}
              loading={inviteMutation.isPending}
              disabled={inviteMutation.isPending}
              fullWidth
            />
          </View>
        )}

        {isOwner && transferCandidates.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Transfer Ownership</Text>
            <Text style={styles.description}>Choose an active member to become the new owner.</Text>
            <View style={styles.optionRow}>
              {transferCandidates.map((member) => {
                const memberId = typeof member.user === 'string' ? member.user : member.user?._id || '';
                const selected = transferTargetUserId === memberId;
                const name = typeof member.user === 'string'
                  ? member.user
                  : `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || member.user?.email || 'Member';
                return (
                  <Button
                    key={memberId}
                    label={name}
                    size="sm"
                    variant={selected ? 'primary' : 'secondary'}
                    onPress={() => setTransferTargetUserId(memberId)}
                    style={{ flex: 1 }}
                  />
                );
              })}
            </View>
            <Button
              label="Transfer Ownership"
              variant="danger"
              onPress={onTransferOwnership}
              loading={transferOwnershipMutation.isPending}
              disabled={!transferTargetUserId || transferOwnershipMutation.isPending || team?.transferState === 'applying' || team?.transferState === 'pending'}
              fullWidth
            />
          </View>
        )}

        {(isOwner || isAdmin) && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Audit Trail</Text>
              <Button label="Refresh" size="sm" variant="secondary" onPress={() => refetchAudit()} loading={auditLoading} />
            </View>
            {auditLoading ? <Text style={styles.meta}>Loading audit logs…</Text> : null}
            {!auditLoading && !auditLogs.length ? <Text style={styles.empty}>No audit events yet.</Text> : null}
            {auditLogs.map((log) => (
              <View key={log._id} style={styles.auditRow}>
                <Text style={styles.memberName}>{String(log.action || '').replaceAll('_', ' ')}</Text>
                <Text style={styles.memberMeta}>
                  {(log.actor?.firstName || 'User')} {(log.actor?.lastName || '')} • {new Date(log.createdAt).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Members ({activeMembers.length})</Text>
          {activeMembers.map((member) => {
            const memberId = typeof member.user === 'string' ? member.user : member.user?._id;
            const fullName = typeof member.user === 'string'
              ? member.user
              : `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || member.user?.email || 'Member';
            const canRemove = canManageMembers && member.role !== 'owner' && memberId !== user?._id;

            return (
              <View key={`${memberId}-${member.role}`} style={styles.memberRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{fullName}</Text>
                  <Text style={styles.memberMeta}>{member.role}</Text>
                </View>
                {canRemove ? (
                  <Button
                    label="Remove"
                    variant="danger"
                    size="sm"
                    onPress={() => onRemoveMember(member)}
                    loading={removeMemberMutation.isPending}
                  />
                ) : null}
              </View>
            );
          })}
          {!activeMembers.length && <Text style={styles.empty}>No active members.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  scroll: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  name: { ...typography.h3, color: colors.textDark },
  meta: { ...typography.caption, color: colors.textSecondary },
  description: { ...typography.bodySmall, color: colors.textSecondary },
  warning: { ...typography.caption, color: '#b45309' },
  sectionTitle: { ...typography.label, color: colors.textSecondary },
  optionRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { ...typography.caption, color: colors.danger },
  success: { ...typography.caption, color: colors.success },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  memberName: { ...typography.body, color: colors.textDark, fontWeight: '600' },
  memberMeta: { ...typography.caption, color: colors.textMuted, textTransform: 'capitalize' },
  auditRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  empty: { ...typography.bodySmall, color: colors.textMuted },
});
