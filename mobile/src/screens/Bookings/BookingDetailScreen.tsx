import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Modal, FlatList, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bookingsApi, SlotItem } from '../../api/endpoints/bookingsApi';
import { paymentsApi } from '../../api/endpoints/paymentsApi';
import { useAuthStore } from '../../store/authStore';
import { useStripe } from '@stripe/stripe-react-native';
import { colors, spacing, typography, radius } from '../../theme';
import { ProfileStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<ProfileStackParamList, 'BookingDetail'>;

/* ─── Helpers ─── */
function fmt12(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function fmtDate(s?: string): string {
  if (!s) return '—';
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function bid(b: Record<string, unknown>): string {
  return (b.id as string) || (b._id as string) || '';
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: 'Pending',   bg: '#fffbeb', color: '#92400e' },
  hold:      { label: 'Hold',      bg: '#fffbeb', color: '#92400e' },
  confirmed: { label: 'Confirmed', bg: '#ecfdf5', color: '#166534' },
  cancelled: { label: 'Cancelled', bg: colors.dangerLight, color: '#991b1b' },
  completed: { label: 'Completed', bg: colors.bgMuted, color: colors.textMuted },
  no_show:   { label: 'No Show',   bg: colors.dangerLight, color: '#991b1b' },
};

const POLICY_TEXT: Record<string, string> = {
  flexible: 'Flexible — full refund up to 1 hour before.',
  moderate: 'Moderate — 50% refund up to 24 hours before.',
  strict:   'Strict — no refunds within 48 hours.',
};

/* ─── Reschedule Modal ─── */
function RescheduleModal({
  visible, bookingId, serviceId,
  onClose, onSuccess,
}: {
  visible: boolean;
  bookingId: string;
  serviceId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [date, setDate]         = useState('');
  const [slots, setSlots]       = useState<SlotItem[]>([]);
  const [slotsLoading, setLoad] = useState(false);
  const [selectedSlot, setSel]  = useState<SlotItem | null>(null);
  const [reason, setReason]     = useState('');
  const [error, setError]       = useState('');

  const reschedule = useMutation({
    mutationFn: () =>
      bookingsApi.reschedule(bookingId, {
        newDate:      date,
        newStartTime: selectedSlot!.startTime,
        newEndTime:   selectedSlot!.endTime,
        reason,
      }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError:   (e: Error) => setError(e.message),
  });

  const loadSlots = async () => {
    if (!date || !serviceId) return;
    setLoad(true); setError(''); setSel(null);
    try {
      const data = await bookingsApi.getSlots(serviceId, date);
      setSlots(data.slots);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoad(false);
    }
  };

  const reset = () => { setDate(''); setSlots([]); setSel(null); setReason(''); setError(''); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={rsStyles.container}>
        <View style={rsStyles.header}>
          <Text style={rsStyles.title}>Reschedule</Text>
          <TouchableOpacity onPress={() => { onClose(); reset(); }}>
            <Text style={rsStyles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={rsStyles.body} keyboardShouldPersistTaps="handled">
          {!!error && <Text style={rsStyles.error}>{error}</Text>}

          <Text style={rsStyles.label}>New Date (YYYY-MM-DD)</Text>
          <View style={rsStyles.dateRow}>
            <TextInput
              style={rsStyles.dateInput}
              value={date}
              onChangeText={setDate}
              placeholder="2026-04-15"
              keyboardType="numbers-and-punctuation"
            />
            <TouchableOpacity style={rsStyles.loadBtn} onPress={loadSlots} disabled={!date || !serviceId}>
              <Text style={rsStyles.loadBtnText}>Load Slots</Text>
            </TouchableOpacity>
          </View>

          {slotsLoading && <ActivityIndicator color={colors.primary} style={rsStyles.slotsLoading} />}

          {!slotsLoading && slots.length > 0 && (
            <>
              <Text style={rsStyles.label}>Select a Time</Text>
              <View style={rsStyles.slotsGrid}>
                {slots.map(s => (
                  <TouchableOpacity
                    key={s.startTime}
                    style={[rsStyles.slotBtn, selectedSlot?.startTime === s.startTime && rsStyles.slotSelected]}
                    onPress={() => setSel(s)}
                  >
                    <Text style={[rsStyles.slotText, selectedSlot?.startTime === s.startTime && rsStyles.slotTextSel]}>
                      {fmt12(s.startTime)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {!slotsLoading && date && slots.length === 0 && (
            <Text style={rsStyles.noSlots}>No availability on this date.</Text>
          )}

          <Text style={rsStyles.label}>Reason (optional)</Text>
          <TextInput
            style={rsStyles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. scheduling conflict"
          />

          <TouchableOpacity
            style={[rsStyles.confirmBtn, (!date || !selectedSlot) && rsStyles.confirmDisabled]}
            onPress={() => reschedule.mutate()}
            disabled={!date || !selectedSlot || reschedule.isPending}
          >
            <Text style={rsStyles.confirmBtnText}>
              {reschedule.isPending ? 'Rescheduling…' : 'Confirm Reschedule'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ─── Main Screen ─── */
export default function BookingDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const handlePayToConfirm = useCallback(async (bookingId: string) => {
    setPayLoading(true);
    try {
      const data = await bookingsApi.getPaymentIntent(bookingId);
      if (data.free || data.alreadyPaid) {
        queryClient.invalidateQueries({ queryKey: ['booking', id] });
        return;
      }

      const { ephemeralKey, customerId } = await paymentsApi.getEphemeralKey();
      const { error: initErr } = await initPaymentSheet({
        merchantDisplayName:        'Fetchwork',
        customerId,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret:  data.clientSecret,
        allowsDelayedPaymentMethods: false,
      });
      if (initErr) { Alert.alert('Error', initErr.message); return; }

      const { error: presentErr, paymentOption } = await presentPaymentSheet();
      if (presentErr) {
        if (presentErr.code !== 'Canceled') Alert.alert('Payment failed', presentErr.message);
        return;
      }

      // Verify + confirm
      const piId = data.clientSecret.split('_secret_')[0];
      await bookingsApi.confirmPayment(bookingId, piId);
      Alert.alert('Confirmed! ✅', 'Your booking is now confirmed.');
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || err.message || 'Payment failed');
    } finally {
      setPayLoading(false);
    }
  }, [id, queryClient, initPaymentSheet, presentPaymentSheet]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['booking', id],
    queryFn:  () => bookingsApi.getById(id),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const booking: Record<string, unknown> | undefined =
    (data as { booking?: Record<string, unknown> } | undefined)?.booking ?? (data as Record<string, unknown>);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['booking', id] }),
    [queryClient, id],
  );

  const confirmMutation = useMutation({
    mutationFn: () => bookingsApi.confirm(id),
    onSuccess: invalidate,
    onError:   (e: Error) => Alert.alert('Error', e.message),
  });

  const completeMutation = useMutation({
    mutationFn: () => bookingsApi.complete(id),
    onSuccess: invalidate,
    onError:   (e: Error) => Alert.alert('Error', e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => bookingsApi.cancel(id, reason),
    onSuccess: invalidate,
    onError:   (e: Error) => Alert.alert('Error', e.message),
  });

  const handleCancel = useCallback(() => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate(undefined) },
    ]);
  }, [cancelMutation]);

  const openReschedule = useCallback(() => setRescheduleVisible(true), []);
  const closeReschedule = useCallback(() => setRescheduleVisible(false), []);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>
          {error ? (error as Error).message : 'Booking not found'}
        </Text>
      </View>
    );
  }

  const status     = booking.status as string;
  const statusMeta = STATUS_META[status] ?? { label: status, bg: colors.bgMuted, color: colors.textMuted };
  const isActive   = ['pending', 'hold', 'confirmed'].includes(status);
  const isFreelancer = (user as { role?: string })?.role === 'freelancer';
  const service    = booking.service as Record<string, unknown> | undefined;
  const client     = booking.client as Record<string, unknown> | undefined;
  const freelancer = booking.freelancer as Record<string, unknown> | undefined;
  const pricing    = (booking.pricing ?? booking.pricingSnapshot) as Record<string, unknown> | undefined;
  const policy     = booking.policy as Record<string, unknown> | undefined;
  const occurrences = booking.occurrences as Record<string, unknown>[] | undefined;
  const serviceId  = (booking.serviceId ?? service?._id ?? service?.id) as string | undefined;
  const isBusy     = confirmMutation.isPending || completeMutation.isPending || cancelMutation.isPending;

  const totalCents = pricing?.totalCents as number | undefined;
  const totalRaw   = pricing?.total as number | undefined;
  const priceStr   = totalCents != null
    ? `$${(totalCents / 100).toFixed(2)}`
    : totalRaw != null ? `$${Number(totalRaw).toFixed(2)}` : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.serviceTitle} numberOfLines={2}>
            {(service?.title as string) ?? (booking.serviceTitle as string) ?? 'Booking'}
          </Text>
          <View style={[styles.badge, { backgroundColor: statusMeta.bg }]}>
            <Text style={[styles.badgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
        </View>

        {/* Ref */}
        {!!booking.bookingRef && (
          <Text style={styles.ref}>Ref #{booking.bookingRef as string}</Text>
        )}

        {/* Date / time card */}
        <View style={styles.card}>
          <DetailRow label="Date" value={fmtDate(booking.date as string)} />
          {!!booking.startTime && (
            <DetailRow
              label="Time"
              value={`${fmt12(booking.startTime as string)} — ${fmt12(booking.endTime as string)}${booking.timezone ? ` (${(booking.timezone as string).split('/').pop()})` : ''}`}
            />
          )}
          {client !== undefined && (
            <DetailRow label="Client" value={`${client.firstName as string} ${client.lastName as string}`} />
          )}
          {freelancer !== undefined && (
            <DetailRow label="Freelancer" value={`${freelancer.firstName as string} ${freelancer.lastName as string}`} />
          )}
          {priceStr !== null && priceStr !== undefined && (
            <DetailRow label="Total" value={priceStr} highlight />
          )}
          {!!booking.notes && (
            <DetailRow label="Notes" value={booking.notes as string} />
          )}
        </View>

        {/* Occurrences */}
        {occurrences && occurrences.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📆 All Sessions ({occurrences.length})</Text>
            {occurrences.map((o, i) => {
              const oDate = o.startAtUtc
                ? new Date(o.startAtUtc as string).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                : (o.date as string) ?? '—';
              const oTime = (o.startTime as string)
                ?? ((o.localStartWallclock as string)?.split('T')[1]?.slice(0, 5));
              const oStatus = STATUS_META[o.status as string];
              return (
                <View key={(o.id as string) ?? i} style={styles.occurrenceRow}>
                  <Text style={styles.occNo}>#{(o.occurrenceNo as number) ?? i + 1}</Text>
                  <Text style={styles.occDate}>{oDate}</Text>
                  {!!oTime && <Text style={styles.occTime}>{fmt12(oTime)}</Text>}
                  {oStatus && (
                    <View style={[styles.occBadge, { backgroundColor: oStatus.bg }]}>
                      <Text style={[styles.occBadgeText, { color: oStatus.color }]}>{oStatus.label}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Policy */}
        {!!(policy?.tier) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📋 Cancellation Policy</Text>
            <Text style={styles.policyText}>
              {POLICY_TEXT[policy!.tier as string] ?? JSON.stringify(policy)}
            </Text>
          </View>
        )}

        {/* Actions */}
        {isActive && (
          <View style={styles.actionsCard}>
            {/* Client: pay to confirm */}
            {!isFreelancer && ['held', 'hold', 'pending_payment'].includes(status) &&
             ((pricing?.amountCents as number) > 0) && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnPay]}
                onPress={() => handlePayToConfirm(bid(booking as Record<string, unknown>))}
                disabled={payLoading}
              >
                <Text style={styles.actionBtnTextLight}>
                  {payLoading ? 'Processing…' : '💳 Pay to Confirm'}
                </Text>
              </TouchableOpacity>
            )}

            {isFreelancer && status === 'pending' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnConfirm]}
                onPress={() => confirmMutation.mutate()}
                disabled={isBusy}
              >
                <Text style={styles.actionBtnTextLight}>
                  {confirmMutation.isPending ? 'Confirming…' : '✅ Confirm Booking'}
                </Text>
              </TouchableOpacity>
            )}

            {isFreelancer && status === 'confirmed' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnComplete]}
                onPress={() => completeMutation.mutate()}
                disabled={isBusy}
              >
                <Text style={styles.actionBtnTextLight}>
                  {completeMutation.isPending ? 'Completing…' : '✓ Mark Complete'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, styles.btnReschedule]}
              onPress={openReschedule}
              disabled={isBusy}
            >
              <Text style={styles.actionBtnTextPrimary}>🗓 Reschedule</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.btnCancel]}
              onPress={handleCancel}
              disabled={isBusy}
            >
              <Text style={styles.actionBtnTextDanger}>
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Booking'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <RescheduleModal
        visible={rescheduleVisible}
        bookingId={id}
        serviceId={serviceId}
        onClose={closeReschedule}
        onSuccess={invalidate}
      />
    </SafeAreaView>
  );
}

/* ─── Small helper component ─── */
function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={drStyles.row}>
      <Text style={drStyles.label}>{label}</Text>
      <Text style={[drStyles.value, highlight && drStyles.highlight]}>{value}</Text>
    </View>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bgSubtle },
  loader:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:  { padding: spacing.md, paddingBottom: spacing.xl },
  errorText: { ...typography.bodySmall, color: colors.danger },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.xs },
  serviceTitle: { ...typography.h2, flex: 1 },
  ref:          { ...typography.caption, marginBottom: spacing.md },

  badge:     { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, flexShrink: 0 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  card:         { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { ...typography.h4, marginBottom: spacing.sm },
  policyText:   { ...typography.bodySmall },

  occurrenceRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.bgMuted },
  occNo:          { ...typography.label, color: colors.textMuted, minWidth: 28 },
  occDate:        { ...typography.body, flex: 1 },
  occTime:        { ...typography.bodySmall },
  occBadge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  occBadgeText:   { fontSize: 10, fontWeight: '600' },

  actionsCard: { gap: spacing.sm, marginBottom: spacing.xl },
  actionBtn:   { borderRadius: radius.md, padding: spacing.md, alignItems: 'center', minHeight: 44, justifyContent: 'center', borderWidth: 1 },
  btnConfirm:    { backgroundColor: colors.success, borderColor: colors.success },
  btnComplete:   { backgroundColor: colors.success, borderColor: colors.success },
  btnPay:        { backgroundColor: colors.primary, borderColor: colors.primary },
  btnReschedule: { backgroundColor: colors.white, borderColor: colors.primary },
  btnCancel:     { backgroundColor: colors.white, borderColor: colors.danger },
  actionBtnTextLight:   { ...typography.button, color: colors.white },
  actionBtnTextPrimary: { ...typography.button, color: colors.primary },
  actionBtnTextDanger:  { ...typography.button, color: colors.danger },
});

const drStyles = StyleSheet.create({
  row:       { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.bgMuted },
  label:     { ...typography.label, color: colors.textMuted, flex: 1 },
  value:     { ...typography.body, flex: 2, textAlign: 'right' },
  highlight: { color: colors.primary, fontWeight: '700', fontSize: 17 },
});

const rsStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title:     { ...typography.h3 },
  close:     { fontSize: 20, color: colors.textMuted, padding: spacing.xs },
  body:      { padding: spacing.md },

  error:    { backgroundColor: colors.dangerLight, color: colors.danger, padding: spacing.sm, borderRadius: radius.md, marginBottom: spacing.md, fontSize: 13 },
  label:    { ...typography.label, marginBottom: 6, marginTop: spacing.md },
  dateRow:  { flexDirection: 'row', gap: spacing.sm },
  dateInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, minHeight: 44, fontSize: 15 },
  loadBtn:  { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  loadBtnText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  slotsLoading: { marginVertical: spacing.md },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  slotBtn:   { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, minHeight: 44, justifyContent: 'center' },
  slotSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  slotText:     { fontSize: 13, fontWeight: '500', color: colors.text },
  slotTextSel:  { color: colors.primary, fontWeight: '700' },
  noSlots:      { ...typography.bodySmall, marginBottom: spacing.md },

  reasonInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, minHeight: 44, fontSize: 15, marginBottom: spacing.lg },
  confirmBtn:  { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', minHeight: 44 },
  confirmDisabled: { opacity: 0.5 },
  confirmBtnText:  { color: colors.white, fontWeight: '700', fontSize: 15 },
});
