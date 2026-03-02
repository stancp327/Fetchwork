import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  ActivityIndicator, RefreshControl, Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { servicesApi } from '../../api/endpoints/servicesApi';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';

type Tab = 'subscriptions' | 'bundles';

export default function MyBundlesScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('subscriptions');
  const role = (user?.role === 'freelancer' ? 'freelancer' : 'client') as 'client' | 'freelancer';

  const { data: subs, isLoading: subsLoading, refetch: refetchSubs, isRefetching: subsRefetching } = useQuery({
    queryKey: ['mySubscriptions', role],
    queryFn: () => servicesApi.getMySubscriptions(role),
  });

  const { data: bundles, isLoading: bundlesLoading, refetch: refetchBundles, isRefetching: bundlesRefetching } = useQuery({
    queryKey: ['myBundles', role],
    queryFn: () => servicesApi.getMyBundles(role),
  });

  const cancelSub = useMutation({
    mutationFn: (subId: string) => servicesApi.cancelSubscription(subId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mySubscriptions'] }),
  });

  const isLoading = tab === 'subscriptions' ? subsLoading : bundlesLoading;
  const isRefetching = tab === 'subscriptions' ? subsRefetching : bundlesRefetching;
  const refetch = tab === 'subscriptions' ? refetchSubs : refetchBundles;

  const subscriptions = subs?.subscriptions || subs || [];
  const bundleList = bundles?.purchases || bundles || [];

  const renderSubscription = ({ item }: { item: any }) => (
    <Card style={s.card}>
      <Text style={s.title} numberOfLines={1}>{item.service?.title || 'Service'}</Text>
      <View style={s.row}>
        <Badge label={item.status} variant={item.status === 'active' ? 'success' : 'neutral'} />
        <Text style={s.price}>${item.price}/{item.billingCycle || 'month'}</Text>
      </View>
      {item.nextBillingDate && (
        <Text style={s.meta}>Next billing: {new Date(item.nextBillingDate).toLocaleDateString()}</Text>
      )}
      {item.status === 'active' && (
        <Button label="Cancel" variant="danger" size="sm" onPress={() => cancelSub.mutate(item._id)}
          loading={cancelSub.isPending} style={{ marginTop: spacing.sm }} />
      )}
    </Card>
  );

  const renderBundle = ({ item }: { item: any }) => {
    const sessionsUsed = item.sessionsCompleted || 0;
    const sessionsTotal = item.sessionsTotal || 0;
    const pct = sessionsTotal > 0 ? (sessionsUsed / sessionsTotal) * 100 : 0;

    return (
      <Card style={s.card}>
        <Text style={s.title} numberOfLines={1}>{item.service?.title || item.bundle?.name || 'Bundle'}</Text>
        <View style={s.row}>
          <Badge label={item.status === 'active' ? 'Active' : item.status} variant={item.status === 'active' ? 'success' : 'neutral'} />
          <Text style={s.price}>${item.totalPaid || item.price}</Text>
        </View>
        <Text style={s.meta}>{sessionsUsed} / {sessionsTotal} sessions used</Text>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${Math.min(pct, 100)}%` }]} />
        </View>
        {item.expiresAt && (
          <Text style={s.meta}>Expires: {new Date(item.expiresAt).toLocaleDateString()}</Text>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['subscriptions', 'bundles'] as Tab[]).map(t => (
          <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'subscriptions' ? '🔄 Subscriptions' : '📦 Bundles'}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={tab === 'subscriptions' ? subscriptions : bundleList}
          keyExtractor={(item: any) => item._id}
          renderItem={tab === 'subscriptions' ? renderSubscription : renderBundle}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              emoji={tab === 'subscriptions' ? '🔄' : '📦'}
              title={`No ${tab} yet`}
              subtitle={tab === 'subscriptions' ? 'Subscribe to services to see them here' : 'Purchase bundles to track your sessions'}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bgSubtle },
  tabBar:     { flexDirection: 'row', padding: spacing.sm, paddingBottom: 0, gap: spacing.xs },
  tab:        { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:  { borderBottomColor: colors.primary },
  tabText:    { ...typography.body, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '600' },
  list:       { padding: spacing.md, paddingBottom: 20 },
  card:       { marginBottom: spacing.sm },
  title:      { ...typography.h4, marginBottom: 4 },
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  price:      { ...typography.bodyBold, color: colors.primary },
  meta:       { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  progressBar:{ height: 6, backgroundColor: colors.bgMuted, borderRadius: 3, marginTop: spacing.xs },
  progressFill:{ height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
