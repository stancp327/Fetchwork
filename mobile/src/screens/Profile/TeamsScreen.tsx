import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable, RefreshControl,
  SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProfileStackParamList } from '../../types/navigation';
import { teamsApi, MobileTeam, TeamInvitation } from '../../api/endpoints/teamsApi';
import Avatar from '../../components/common/Avatar';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import EmptyState from '../../components/common/EmptyState';
import Input from '../../components/common/Input';
import { colors, radius, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Teams'>;

/* ─────── Create Team Section ─────── */
function CreateTeamCard({ onCreated }: { onCreated: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'client_team' | 'agency'>('client_team');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => teamsApi.createTeam({ name: name.trim(), type }),
    onSuccess: () => {
      setName('');
      setExpanded(false);
      queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
      onCreated();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create team';
      Alert.alert('Error', msg);
    },
  });

  if (!expanded) {
    return (
      <Button
        label="Create Team"
        onPress={() => setExpanded(true)}
        leftIcon="add-circle-outline"
        fullWidth
        style={styles.createBtn}
      />
    );
  }

  return (
    <Card style={styles.createCard}>
      <Text style={styles.createTitle}>New Team</Text>
      <Input label="Team Name" value={name} onChangeText={setName} placeholder="My Team" />
      <View style={styles.typeRow}>
        <Pressable
          style={[styles.typeChip, type === 'client_team' && styles.typeChipActive]}
          onPress={() => setType('client_team')}
        >
          <Text style={[styles.typeChipText, type === 'client_team' && styles.typeChipTextActive]}>Client Team</Text>
        </Pressable>
        <Pressable
          style={[styles.typeChip, type === 'agency' && styles.typeChipActive]}
          onPress={() => setType('agency')}
        >
          <Text style={[styles.typeChipText, type === 'agency' && styles.typeChipTextActive]}>Agency</Text>
        </Pressable>
      </View>
      <View style={styles.createActions}>
        <Button label="Cancel" variant="secondary" size="sm" onPress={() => setExpanded(false)} style={{ flex: 1 }} />
        <Button
          label="Create"
          size="sm"
          onPress={() => {
            if (!name.trim()) { Alert.alert('Error', 'Team name is required'); return; }
            createMutation.mutate();
          }}
          loading={createMutation.isPending}
          disabled={createMutation.isPending}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

/* ─────── Invite Card ─────── */
function InviteCard({
  invite, onRespond, isPending,
}: {
  invite: TeamInvitation;
  onRespond: (teamId: string, action: 'accept' | 'decline') => void;
  isPending: boolean;
}) {
  return (
    <Card style={styles.inviteCard}>
      <View style={styles.inviteRow}>
        <Avatar name={invite.name} size="md" />
        <View style={styles.inviteInfo}>
          <Text style={styles.inviteName}>{invite.name}</Text>
          <Text style={styles.inviteMeta}>
            {invite.type === 'agency' ? 'Agency' : 'Client Team'}
            {invite.owner ? ` · From ${invite.owner.firstName || 'Owner'}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.inviteActions}>
        <Button label="Decline" variant="secondary" size="sm" onPress={() => onRespond(invite._id, 'decline')} disabled={isPending} style={{ flex: 1 }} />
        <Button label="Accept" variant="success" size="sm" onPress={() => onRespond(invite._id, 'accept')} disabled={isPending} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

/* ─────── Team Card ─────── */
function TeamListCard({ team, onPress }: { team: MobileTeam; onPress: () => void }) {
  const activeCount = (team.members || []).filter(m => m.status === 'active').length;
  const roleLabel = team.currentUserRole
    ? team.currentUserRole.charAt(0).toUpperCase() + team.currentUserRole.slice(1)
    : 'Member';

  return (
    <Card onPress={onPress} style={styles.teamCard}>
      <View style={styles.teamRow}>
        <Avatar name={team.name} size="lg" />
        <View style={styles.teamInfo}>
          <Text style={styles.teamName} numberOfLines={1}>{team.name}</Text>
          <Text style={styles.teamMeta}>
            {team.type === 'agency' ? 'Agency' : 'Client Team'} · {activeCount} member{activeCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <Badge label={roleLabel} variant={team.currentUserIsOwner ? 'warning' : 'neutral'} />
      </View>
    </Card>
  );
}

/* ─────── Main Screen ─────── */
export default function TeamsScreen({ navigation }: Props) {
  const queryClient = useQueryClient();

  const teamsQuery = useQuery({
    queryKey: ['mobile-teams'],
    queryFn: () => teamsApi.getMyTeams(),
  });

  const invitesQuery = useQuery({
    queryKey: ['mobile-team-invitations'],
    queryFn: () => teamsApi.getPendingInvitations(),
  });

  const invitationMutation = useMutation({
    mutationFn: ({ teamId, action }: { teamId: string; action: 'accept' | 'decline' }) =>
      action === 'accept' ? teamsApi.acceptInvitation(teamId) : teamsApi.declineInvitation(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-team-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      Alert.alert('Error', msg);
    },
  });

  const teams = teamsQuery.data?.teams || [];
  const invitations = invitesQuery.data?.invitations || [];
  const isLoading = teamsQuery.isLoading || invitesQuery.isLoading;
  const isRefreshing = teamsQuery.isRefetching || invitesQuery.isRefetching;
  const hasError = teamsQuery.isError || invitesQuery.isError;

  const onRefresh = () => {
    teamsQuery.refetch();
    invitesQuery.refetch();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (hasError && !teams.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <EmptyState emoji="⚠️" title="Something went wrong" subtitle="Could not load your teams." actionLabel="Retry" onAction={onRefresh} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={teams}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            <CreateTeamCard onCreated={() => {}} />
            {invitations.length > 0 && (
              <View style={styles.sectionWrap}>
                <Text style={styles.sectionTitle}>Pending Invitations</Text>
                {invitations.map(invite => (
                  <InviteCard
                    key={invite._id}
                    invite={invite}
                    onRespond={(teamId, action) => invitationMutation.mutate({ teamId, action })}
                    isPending={invitationMutation.isPending}
                  />
                ))}
              </View>
            )}
            {teams.length > 0 && <Text style={styles.sectionTitle}>My Teams</Text>}
          </>
        }
        renderItem={({ item }) => (
          <TeamListCard team={item} onPress={() => navigation.navigate('TeamDetail', { teamId: item._id })} />
        )}
        ListEmptyComponent={
          <EmptyState emoji="👥" title="No teams yet" subtitle="Create one above or accept an invite to get started." />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  createBtn: { marginBottom: spacing.md },
  createCard: { marginBottom: spacing.md },
  createTitle: { ...typography.h4, marginBottom: spacing.sm },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm },
  typeChip: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.white,
  },
  typeChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  typeChipText: { ...typography.label, color: colors.textSecondary },
  typeChipTextActive: { color: colors.primary },
  createActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  sectionWrap: { marginBottom: spacing.md },
  sectionTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  inviteCard: { marginBottom: spacing.sm },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  inviteInfo: { flex: 1 },
  inviteName: { ...typography.body, fontWeight: '600' },
  inviteMeta: { ...typography.caption, color: colors.textSecondary },
  inviteActions: { flexDirection: 'row', gap: spacing.sm },
  teamCard: { marginBottom: spacing.sm },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teamInfo: { flex: 1 },
  teamName: { ...typography.body, fontWeight: '700', color: colors.textDark },
  teamMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
