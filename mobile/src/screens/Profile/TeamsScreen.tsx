import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { teamsApi } from '../../api/endpoints/teamsApi';
import { colors, spacing, typography, radius } from '../../theme';

export default function TeamsScreen() {
  const { data, refetch, isRefetching, isLoading } = useQuery({
    queryKey: ['mobile-teams'],
    queryFn: () => teamsApi.getMyTeams(),
  });

  const teams = data?.teams || [];

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={teams}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{isLoading ? 'Loading teams…' : 'No teams yet'}</Text>
            <Text style={styles.emptySub}>Create or join a team on web and they’ll appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.type === 'agency' ? 'Agency' : 'Client Team'}</Text>
            <Text style={styles.meta}>{(item.members || []).filter(m => m.status === 'active').length} active members</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  name: { ...typography.body, fontWeight: '700', color: colors.textDark },
  meta: { ...typography.caption, color: colors.textSecondary },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl * 2 },
  emptyTitle: { ...typography.h4, marginBottom: spacing.xs },
  emptySub: { ...typography.bodySmall, color: colors.textMuted },
});
