import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TextInput, Pressable, KeyboardAvoidingView, Platform,
  Alert, RefreshControl, ScrollView, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { disputesApi, DisputeMessage } from '../../api/endpoints/disputesApi';
import { ProfileStackParamList } from '../../types/navigation';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DisputeDetail'>;

export default function DisputeDetailScreen({ route }: Props) {
  const { disputeId } = route.params;
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlatList>(null);

  const { data: dispute, refetch, isLoading, error } = useQuery({
    queryKey: ['dispute', disputeId],
    queryFn: () => disputesApi.get(disputeId),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const sendMut = useMutation({
    mutationFn: (content: string) => disputesApi.sendMessage(disputeId, content),
    onSuccess: () => {
      setMessage('');
      qc.invalidateQueries({ queryKey: ['dispute', disputeId] });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const escalateMut = useMutation({
    mutationFn: () => disputesApi.escalate(disputeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispute', disputeId] });
      Alert.alert('Escalated', 'Your dispute has been escalated to our team.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const handleEscalate = () => {
    Alert.alert('Escalate Dispute', 'This will notify our support team to review your dispute. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Escalate', style: 'destructive', onPress: () => escalateMut.mutate() },
    ]);
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

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load data</Text>
          <Button label="Retry" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!dispute) return null;

  const canEscalate = ['open', 'under_review'].includes(dispute.status) && !dispute.isEscalated;
  const messages = dispute.messages ?? [];

  const renderMessage = ({ item }: { item: DisputeMessage }) => {
    const isMe = item.sender._id === user?._id;
    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        {!isMe && (
          <Text style={styles.senderName}>{item.sender.firstName} {item.sender.lastName}</Text>
        )}
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
        <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>

        {/* Info header */}
        <ScrollView style={styles.infoScroll} nestedScrollEnabled refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoType}>{dispute.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
              <Badge label={dispute.status.replace('_', ' ')} variant={dispute.status === 'resolved' ? 'success' : dispute.status === 'open' ? 'warning' : 'primary'} />
            </View>
            {dispute.job && <Text style={styles.infoRef}>Job: {dispute.job.title}</Text>}
            {dispute.service && <Text style={styles.infoRef}>Service: {dispute.service.title}</Text>}
            {dispute.amount != null && <Text style={styles.infoAmount}>Amount: ${dispute.amount}</Text>}
            <Text style={styles.infoDesc}>{dispute.description}</Text>

            {canEscalate && (
              <Pressable style={styles.escalateBtn} onPress={handleEscalate}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.escalateBtnText}>Escalate to Support</Text>
              </Pressable>
            )}

            {dispute.resolution && (
              <View style={styles.resolution}>
                <Text style={styles.resolutionLabel}>Resolution</Text>
                <Text style={styles.resolutionText}>{dispute.resolution.notes}</Text>
              </View>
            )}
          </Card>
        </ScrollView>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m._id}
          renderItem={renderMessage}
          style={styles.messages}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input */}
        {['open', 'under_review'].includes(dispute.status) && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Add a message..."
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <Pressable
              style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]}
              onPress={() => message.trim() && sendMut.mutate(message.trim())}
              disabled={!message.trim() || sendMut.isPending}
            >
              <Ionicons name="send" size={20} color={message.trim() ? colors.white : colors.textMuted} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { ...typography.bodySmall, color: colors.danger },
  flex: { flex: 1 },
  infoScroll: { maxHeight: 260 },
  infoCard: { margin: spacing.md, marginBottom: 0 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  infoType: { ...typography.body, fontWeight: '700', textTransform: 'capitalize' },
  infoRef: { ...typography.bodySmall, color: colors.textMuted, marginBottom: 2 },
  infoAmount: { ...typography.body, fontWeight: '600', marginBottom: spacing.xs },
  infoDesc: { ...typography.body, color: colors.text, lineHeight: 20 },
  escalateBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.dangerLight ?? '#fff1f2', borderRadius: 6 },
  escalateBtnText: { ...typography.bodySmall, color: colors.danger, fontWeight: '600' },
  resolution: { marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.successLight ?? '#f0fdf4', borderRadius: 6 },
  resolutionLabel: { ...typography.caption, color: colors.success, fontWeight: '700', marginBottom: 2 },
  resolutionText: { ...typography.bodySmall, color: colors.text },

  messages: { flex: 1 },
  messagesList: { padding: spacing.md, gap: spacing.sm },

  bubble: { maxWidth: '80%', padding: spacing.sm, borderRadius: 12, marginBottom: 4 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 2 },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 2 },
  senderName: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  bubbleText: { ...typography.body, color: colors.text },
  bubbleTextMe: { color: colors.white },
  bubbleTime: { ...typography.caption, color: colors.textMuted, marginTop: 2, textAlign: 'right' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)' },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white, gap: spacing.sm },
  input: { flex: 1, ...typography.body, backgroundColor: colors.background, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 100, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: colors.border },
});
