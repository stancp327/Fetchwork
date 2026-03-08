import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { messagesApi } from '../../api/endpoints/messagesApi';
import { MessagesStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { useCallContext } from '../../context/CallContext';
import { getSocket } from '../../api/socket';
import Avatar from '../../components/common/Avatar';
import { colors, spacing, typography, radius } from '../../theme';
import { Message } from '@fetchwork/shared';

type Props = NativeStackScreenProps<MessagesStackParamList, 'MessageThread'>;

export default function MessageThreadScreen({ route, navigation }: Props) {
  const {
    conversationId,
    recipientName,
    recipientId,
    recipientFirstName,
    recipientLastName,
  } = route.params;
  const { user } = useAuth();
  const { startCall } = useCallContext();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  const handleVideoCall = useCallback(async () => {
    if (!recipientId) return;
    await startCall(
      recipientId,
      {
        _id: recipientId,
        firstName: recipientFirstName ?? recipientName?.split(' ')[0] ?? '',
        lastName: recipientLastName ?? recipientName?.split(' ').slice(1).join(' ') ?? '',
      },
      'video',
    );
  }, [recipientId, recipientFirstName, recipientLastName, recipientName, startCall]);

  // Set nav title + call button
  useEffect(() => {
    navigation.setOptions({
      title: recipientName ?? '',
      headerRight: recipientId
        ? () => (
            <TouchableOpacity
              onPress={handleVideoCall}
              style={{ marginRight: 4, padding: 4 }}
              accessibilityLabel="Start video call"
            >
              <Ionicons name="videocam" size={24} color={colors.primary} />
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [recipientName, recipientId, handleVideoCall, navigation]);

  const { data, isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => messagesApi.getMessages(conversationId, { limit: 50 }),
    select: (d) => (d.messages ?? []).reverse() as Message[], // oldest first for FlatList inverted
  });

  const messages: Message[] = data ?? [];

  // Socket listener for real-time messages
  useEffect(() => {
    let mounted = true;
    getSocket().then(socket => {
      socket.emit('conversation:join', conversationId);
      socket.on('message:new', (msg: Message) => {
        if (!mounted || msg.conversation !== conversationId) return;
        qc.setQueryData(['messages', conversationId], (old: any) => {
          const existing = old?.messages ?? [];
          if (existing.find((m: Message) => m._id === msg._id)) return old;
          return { ...old, messages: [msg, ...existing] };
        });
        qc.invalidateQueries({ queryKey: ['conversations'] });
      });
    });
    return () => {
      mounted = false;
      getSocket().then(s => {
        s.emit('conversation:leave', conversationId);
        s.off('message:new');
      });
    };
  }, [conversationId]);

  // Mark as read on mount
  useEffect(() => {
    messagesApi.markRead(conversationId).catch(() => null);
  }, [conversationId]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => messagesApi.send({ conversationId, content }),
    onSuccess: (msg) => {
      qc.setQueryData(['messages', conversationId], (old: any) => ({
        ...old, messages: [msg, ...(old?.messages ?? [])],
      }));
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleSend = useCallback(() => {
    const content = text.trim();
    if (!content) return;
    setText('');
    sendMutation.mutate(content);
  }, [text]);

  const renderMessage = ({ item: msg }: { item: Message }) => {
    const isMe = msg.sender?._id === user?.id || msg.sender?._id === user?._id;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && <Avatar name={`${msg.sender?.firstName} ${msg.sender?.lastName}`} size="xs" />}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{msg.content}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {isMe && (msg.read ? '  ✓✓' : '  ✓')}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        {isLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m._id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}><Text style={typography.bodySmall}>No messages yet. Say hello! 👋</Text></View>
            }
          />
        )}

        {/* Composer */}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
          >
            <Ionicons name="send" size={20} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bgSubtle },
  list:         { padding: spacing.sm, paddingBottom: spacing.sm },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  msgRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 6 },
  msgRowMe:     { flexDirection: 'row-reverse' },
  bubble:       { maxWidth: '75%', padding: spacing.sm, borderRadius: radius.lg },
  bubbleThem:   { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleMe:     { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  msgText:      { ...typography.body, flexShrink: 1 },
  msgTextMe:    { color: colors.white },
  msgTime:      { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  msgTimeMe:    { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  composer:     {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: spacing.sm, backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm,
  },
  input: {
    flex: 1, backgroundColor: colors.bgMuted, borderRadius: radius.xl,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontSize: 15, color: colors.textDark, maxHeight: 120,
  },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: colors.borderMedium },
});
