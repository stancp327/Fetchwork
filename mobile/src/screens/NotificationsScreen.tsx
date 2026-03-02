import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  ActivityIndicator, RefreshControl, Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { notificationsApi } from '../api/endpoints/notificationsApi';
import EmptyState from '../components/common/EmptyState';
import { colors, spacing, typography } from '../theme';

const ICONS: Record<string, string> = {
  job: '💼', payment: '💰', message: '💬', booking: '📅',
  dispute: '⚖️', review: '⭐', discovery: '🔍', system: '🔔',
  referral: '🎁', payment_failed: '❌', default: '🔔',
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function NotificationsScreen({ navigation }: any) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(1, 50),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.notifications || [];
  const unread = notifications.filter((n: any) => !n.read).length;

  const handlePress = (notif: any) => {
    if (!notif.read) markRead.mutate(notif._id);
    // Navigate based on link
    if (notif.link) {
      if (notif.link.startsWith('/jobs/')) {
        navigation.navigate('Jobs', { screen: 'JobDetail', params: { id: notif.link.split('/jobs/')[1] } });
      } else if (notif.link.startsWith('/services/')) {
        navigation.navigate('Services', { screen: 'ServiceDetail', params: { id: notif.link.split('/services/')[1] } });
      } else if (notif.link.startsWith('/messages') || notif.link.startsWith('/chat')) {
        navigation.navigate('Messages');
      }
    }
  };

  const renderNotif = ({ item }: { item: any }) => (
    <Pressable
      style={[styles.notifRow, !item.read && styles.unread]}
      onPress={() => handlePress(item)}
    >
      <Text style={styles.notifIcon}>{ICONS[item.type] || ICONS.default}</Text>
      <View style={styles.notifContent}>
        {item.title && <Text style={styles.notifTitle}>{item.title}</Text>}
        <Text style={styles.notifMsg} numberOfLines={2}>{item.message}</Text>
        <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
      </View>
      {!item.read && <View style={styles.dot} />}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unread > 0 && (
          <Pressable onPress={() => markAllRead.mutate()} hitSlop={8}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n: any) => n._id}
          renderItem={renderNotif}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState emoji="🔔" title="No notifications" subtitle="You're all caught up!" />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bgSubtle },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingBottom: spacing.sm },
  headerTitle: { ...typography.h2 },
  markAll:    { color: colors.primary, fontSize: 14, fontWeight: '600' },
  list:       { paddingHorizontal: spacing.md, paddingBottom: 20 },
  notifRow:   { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  unread:     { backgroundColor: '#f0f4ff', borderColor: colors.primary + '30' },
  notifIcon:  { fontSize: 22, marginRight: spacing.sm, marginTop: 2 },
  notifContent: { flex: 1 },
  notifTitle: { ...typography.bodyBold, marginBottom: 2 },
  notifMsg:   { ...typography.bodySmall, color: colors.textSecondary, marginBottom: 4 },
  notifTime:  { ...typography.caption, color: colors.textMuted },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
