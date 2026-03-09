import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, Alert, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { servicesApi } from '../../api/endpoints/servicesApi';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { colors, spacing, typography, radius } from '../../theme';
import { ServicesStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<ServicesStackParamList, 'ServiceOrderProgress'>;

type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'neutral';

const STATUS_DISPLAY: Record<string, { label: string; variant: BadgeVariant }> = {
  pending:             { label: 'Pending',            variant: 'warning' },
  in_progress:         { label: 'In Progress',        variant: 'primary' },
  delivered:           { label: 'Delivered',           variant: 'purple' },
  completed:           { label: 'Completed',          variant: 'success' },
  cancelled:           { label: 'Cancelled',          variant: 'danger' },
  revision_requested:  { label: 'Revision Requested', variant: 'warning' },
};

export default function ServiceOrderProgressScreen({ route, navigation }: Props) {
  const { serviceId, orderId } = route.params;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['serviceOrder', serviceId, orderId],
    queryFn: () => servicesApi.getOrder(serviceId, orderId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['serviceOrder', serviceId, orderId] });

  const deliverMutation = useMutation({
    mutationFn: () => servicesApi.deliverOrder(serviceId, orderId),
    onSuccess: () => {
      Alert.alert('Delivered', 'Order marked as delivered.');
      invalidate();
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const approveMutation = useMutation({
    mutationFn: () => servicesApi.approveOrder(serviceId, orderId),
    onSuccess: () => {
      Alert.alert('Payment Released', 'Payment has been released to the freelancer.');
      invalidate();
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const revisionMutation = useMutation({
    mutationFn: (note: string) => servicesApi.requestRevision(serviceId, orderId, note),
    onSuccess: () => {
      Alert.alert('Revision Requested', 'The freelancer has been notified.');
      invalidate();
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const handleRequestRevision = () => {
    Alert.prompt(
      'Request Revision',
      'Describe what needs to be changed:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: (reason?: string) => {
            if (reason?.trim()) revisionMutation.mutate(reason.trim());
          },
        },
      ],
      'plain-text',
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {error ? (error as Error).message : 'Order not found'}
        </Text>
      </View>
    );
  }

  const { order, service } = data;
  const status = order.status;
  const statusDisplay = STATUS_DISPLAY[status] ?? { label: status, variant: 'neutral' as BadgeVariant };

  const userId = user?.id || (user as Record<string, unknown> | null)?._id as string | undefined;
  const isClient = order.client === userId;
  const freelancerName = `${service.freelancer.firstName} ${service.freelancer.lastName}`;
  const isBusy = deliverMutation.isPending || approveMutation.isPending || revisionMutation.isPending;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2}>
            {service.title}
          </Text>
          <Badge label={statusDisplay.label} variant={statusDisplay.variant} />
        </View>

        {/* Details card */}
        <Card style={styles.card}>
          <DetailRow label="Package" value={order.package} />
          <DetailRow label="Freelancer" value={freelancerName} />
          <DetailRow label="Amount" value={`$${Number(order.price).toFixed(2)}`} highlight />
          {order.escrowAmount > 0 && (
            <DetailRow label="Escrow" value={`$${Number(order.escrowAmount).toFixed(2)}`} />
          )}
          <DetailRow label="Ordered" value={new Date(order.orderDate).toLocaleDateString()} />
          {order.deliveryDate && (
            <DetailRow label="Delivered" value={new Date(order.deliveryDate).toLocaleDateString()} />
          )}
          {order.completedDate && (
            <DetailRow label="Completed" value={new Date(order.completedDate).toLocaleDateString()} />
          )}
          {order.revisionCount > 0 && (
            <DetailRow label="Revisions" value={String(order.revisionCount)} />
          )}
        </Card>

        {/* Requirements */}
        {!!order.requirements && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Requirements</Text>
            <Text style={styles.bodyText}>{order.requirements}</Text>
          </Card>
        )}

        {/* Delivery note */}
        {!!order.deliveryNote && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery Note</Text>
            <Text style={styles.bodyText}>{order.deliveryNote}</Text>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {/* Freelancer: Mark Complete (deliver) */}
          {!isClient && (status === 'in_progress' || status === 'revision_requested') && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnSuccess]}
              onPress={() => deliverMutation.mutate()}
              disabled={isBusy}
            >
              <Text style={styles.actionBtnTextLight}>
                {deliverMutation.isPending ? 'Submitting…' : 'Mark Complete'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Client: Approve and Release Payment */}
          {isClient && status === 'delivered' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnPrimary]}
              onPress={() => approveMutation.mutate()}
              disabled={isBusy}
            >
              <Text style={styles.actionBtnTextLight}>
                {approveMutation.isPending ? 'Releasing…' : 'Approve and Release Payment'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Client: Request Revision */}
          {isClient && status === 'delivered' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnOutline]}
              onPress={handleRequestRevision}
              disabled={isBusy}
            >
              <Text style={styles.actionBtnTextPrimary}>
                {revisionMutation.isPending ? 'Requesting…' : 'Request Revision'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Leave a Review */}
          {status === 'completed' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnOutline]}
              onPress={() =>
                navigation.getParent()?.getParent()?.navigate('Profile', {
                  screen: 'WriteReview',
                  params: {
                    serviceId,
                    orderId,
                    targetName: service.title,
                    targetId: service.freelancer._id,
                  },
                })
              }
            >
              <Text style={styles.actionBtnTextPrimary}>Leave a Review</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={drStyles.row}>
      <Text style={drStyles.label}>{label}</Text>
      <Text style={[drStyles.value, highlight && drStyles.highlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bgSubtle },
  scroll:     { padding: spacing.md, paddingBottom: spacing.xl },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:  { ...typography.bodySmall, color: colors.danger },

  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  title:      { ...typography.h2, flex: 1 },

  card:         { marginBottom: spacing.md },
  sectionTitle: { ...typography.h4, marginBottom: spacing.xs },
  bodyText:     { ...typography.body, lineHeight: 22 },

  actions:    { gap: spacing.sm, marginTop: spacing.sm },
  actionBtn:  { borderRadius: radius.md, padding: spacing.md, alignItems: 'center', minHeight: 44, justifyContent: 'center', borderWidth: 1 },
  btnSuccess: { backgroundColor: colors.success, borderColor: colors.success },
  btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  btnOutline: { backgroundColor: colors.white, borderColor: colors.primary },
  actionBtnTextLight:   { ...typography.button, color: colors.white },
  actionBtnTextPrimary: { ...typography.button, color: colors.primary },
});

const drStyles = StyleSheet.create({
  row:       { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.bgMuted },
  label:     { ...typography.label, color: colors.textMuted, flex: 1 },
  value:     { ...typography.body, flex: 2, textAlign: 'right' },
  highlight: { color: colors.primary, fontWeight: '700', fontSize: 17 },
});
