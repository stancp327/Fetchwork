import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  RefreshControl, Pressable,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { disputesApi, Dispute } from '../../api/endpoints/disputesApi';
import { ProfileStackParamList } from '../../types/navigation';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Disputes'>;

const STATUS_VARIANTS: Record<Dispute['status'], 'warning' | 'primary' | 'success' | 'neutral'> = {
  open: 'warning',
  under_review: 'primary',
  resolved: 'success',
  closed: 'neutral',
};

export default function DisputeListScreen({ navigation }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  const { data: disputes = [], refetch, isLoading } = useQuery({
    queryKey: ['disputes'],
    queryFn: disputesApi.list,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('FileDispute', {})} hitSlop={8} style={{ marginRight: spacing.sm }}>
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  const renderItem = ({ item }: { item: Dispute }) => {
    const other = item.respondent;
    const ref = item.job?.title ?? item.service?.title ?? 'No reference';
    return (
      <Card onPress={() => navigation.navigate('DisputeDetail', { disputeId: item._id })} style={styles.card}>
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.type}>{item.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
            <Text style={styles.ref} numberOfLines={1}>{ref}</Text>
            <Text style={styles.meta}>
              vs {other.firstName} {other.lastName} · {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.right}>
            <Badge label={item.status.replace('_', ' ')} variant={STATUS_VARIANTS[item.status]} />
            {item.amount != null && <Text style={styles.amount}>${item.amount}</Text>}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={disputes}
        keyExtractor={d => d._id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState emoji="✅" title="No disputes" subtitle="You have no open or past disputes" />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, flexGrow: 1 },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  info: { flex: 1, marginRight: spacing.sm },
  type: { ...typography.body, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  ref: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { ...typography.bodySmall, fontWeight: '700', color: colors.text },
});
