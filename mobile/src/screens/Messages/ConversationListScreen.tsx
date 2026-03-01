import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { messagesApi } from '../../api/endpoints/messagesApi';
import { MessagesStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, typography } from '../../theme';
import { Conversation } from '@fetchwork/shared';

type Props = NativeStackScreenProps<MessagesStackParamList, 'ConversationList'>;

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ConversationListScreen({ navigation }: Props) {
  const { user } = useAuth();

  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesApi.getConversations(),
    refetchInterval: 15000, // poll every 15s as fallback
  });

  const conversations: Conversation[] = Array.isArray(data) ? data : [];

  const getOtherParticipant = (conv: Conversation) =>
    conv.participants?.find(p => p._id !== user?.id && p._id !== user?._id);

  return (
    <SafeAreaView style={styles.safe}>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState emoji="💬" title="No messages yet"
              subtitle="Start a conversation by messaging a freelancer or responding to a job" />
          }
          renderItem={({ item: conv }) => {
            const other = getOtherParticipant(conv);
            const hasUnread = (conv.unreadCount ?? 0) > 0;
            return (
              <Card
                onPress={() => navigation.navigate('MessageThread', {
                  conversationId: conv._id,
                  recipientName: other ? `${other.firstName} ${other.lastName}` : '',
                })}
                style={styles.convCard}
              >
                <View style={styles.row}>
                  <Avatar
                    name={other ? `${other.firstName} ${other.lastName}` : '?'}
                    size="md"
                    online={other?.availabilityStatus === 'available'}
                  />
                  <View style={styles.content}>
                    <View style={styles.topRow}>
                      <Text style={[styles.name, hasUnread && styles.nameBold]} numberOfLines={1}>
                        {other ? `${other.firstName} ${other.lastName}` : 'Unknown'}
                      </Text>
                      <Text style={styles.time}>{conv.updatedAt ? timeAgo(conv.updatedAt) : ''}</Text>
                    </View>
                    <View style={styles.bottomRow}>
                      <Text style={[styles.lastMsg, hasUnread && styles.lastMsgBold]} numberOfLines={1}>
                        {conv.lastMessage?.content || 'No messages yet'}
                      </Text>
                      {hasUnread && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{conv.unreadCount}</Text>
                        </View>
                      )}
                    </View>
                    {conv.job && (
                      <Text style={styles.context} numberOfLines={1}>📋 {conv.job.title}</Text>
                    )}
                    {conv.service && (
                      <Text style={styles.context} numberOfLines={1}>⚡ {conv.service.title}</Text>
                    )}
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bgSubtle },
  list:        { padding: spacing.sm, paddingBottom: 80 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  convCard:    { marginBottom: spacing.sm },
  row:         { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  content:     { flex: 1, minWidth: 0 },
  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  name:        { ...typography.label, flex: 1 },
  nameBold:    { fontWeight: '700', color: colors.textDark },
  time:        { ...typography.caption, flexShrink: 0 },
  bottomRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lastMsg:     { ...typography.bodySmall, flex: 1, color: colors.textMuted },
  lastMsgBold: { color: colors.textDark, fontWeight: '600' },
  badge: {
    backgroundColor: colors.primary, borderRadius: 10,
    minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  badgeText:   { color: colors.white, fontSize: 11, fontWeight: '700' },
  context:     { ...typography.caption, marginTop: 2, color: colors.textSecondary },
});
