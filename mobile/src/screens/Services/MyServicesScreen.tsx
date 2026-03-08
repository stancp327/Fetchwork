import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  ActivityIndicator, RefreshControl, Pressable,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { servicesApi } from '../../api/endpoints/servicesApi';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, typography } from '../../theme';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  one_time: '📦 One-Time',
  recurring: '🔄 Recurring',
  class: '📚 Class',
};

export default function MyServicesScreen({ navigation }: any) {
  const { user } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['myServices'],
    queryFn: () => servicesApi.myServices(),
    enabled: !!user,
  });

  const services = data?.services || data || [];

  const renderService = ({ item }: { item: any }) => (
    <Card
      onPress={() => navigation.navigate('ServiceDetail', { id: item._id })}
      style={styles.card}
    >
      <View style={styles.cardTop}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Badge
          label={item.isActive ? 'Active' : 'Inactive'}
          variant={item.isActive ? 'success' : 'neutral'}
        />
      </View>
      <Text style={styles.meta}>
        {SERVICE_TYPE_LABELS[item.serviceType] || item.serviceType}
        {item.pricing?.basic?.price ? ` · $${item.pricing.basic.price}` : ''}
        {item.views ? ` · ${item.views} views` : ''}
      </Text>
      {item.isBoosted && item.boostExpiresAt && new Date(item.boostExpiresAt) > new Date() && (
        <View style={styles.boostBadge}>
          <Text style={styles.boostText}>🚀 Boosted</Text>
        </View>
      )}
      <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
      {item.rating > 0 && (
        <Text style={styles.rating}>⭐ {item.rating.toFixed(1)} ({item.totalReviews} reviews)</Text>
      )}
      <View style={styles.actions}>
        <Pressable
          style={styles.actionBtn}
          onPress={e => {
            e.stopPropagation?.();
            navigation.navigate('AvailabilityManager', { serviceId: item._id });
          }}
        >
          <Ionicons name="calendar-outline" size={14} color={colors.primary} />
          <Text style={styles.actionBtnText}>Availability</Text>
        </Pressable>
        {item.orders?.some((o: { status: string }) =>
          ['in_progress', 'delivered', 'revision_requested'].includes(o.status),
        ) && (() => {
          const activeOrder = item.orders.find((o: { status: string }) =>
            ['in_progress', 'delivered', 'revision_requested'].includes(o.status),
          ) as { _id: string } | undefined;
          if (!activeOrder) return null;
          return (
            <Pressable
              style={styles.actionBtn}
              onPress={e => {
                e.stopPropagation?.();
                navigation.navigate('ServiceOrderProgress', {
                  serviceId: item._id,
                  orderId: activeOrder._id,
                  serviceTitle: item.title,
                });
              }}
            >
              <Ionicons name="document-text-outline" size={14} color={colors.primary} />
              <Text style={styles.actionBtnText}>View Order</Text>
            </Pressable>
          );
        })()}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Services</Text>
        <Text style={styles.headerCount}>{services.length} total</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(s: any) => s._id}
          renderItem={renderService}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              emoji="📦"
              title="No services yet"
              subtitle="Create your first service to start earning"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bgSubtle },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  headerTitle: { ...typography.h2 },
  headerCount: { ...typography.caption, color: colors.textMuted },
  list:       { padding: spacing.md, paddingTop: 0, paddingBottom: 20 },
  card:       { marginBottom: spacing.sm },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title:      { ...typography.h4, flex: 1, marginRight: spacing.sm },
  meta:       { ...typography.caption, marginBottom: 6 },
  desc:       { ...typography.bodySmall, color: colors.textSecondary, marginBottom: 4 },
  rating:     { ...typography.caption, color: colors.textSecondary },
  boostBadge: { backgroundColor: colors.primary + '12', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4 },
  boostText:  { fontSize: 11, color: colors.primary, fontWeight: '600' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  actions:    { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.primary + '40', borderRadius: 6, backgroundColor: colors.primaryLight, minHeight: 32 },
  actionBtnText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
});
