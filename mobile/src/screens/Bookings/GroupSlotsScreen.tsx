import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, Modal, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bookingsApi, GroupSlot } from '../../api/endpoints/bookingsApi';
import { colors, spacing, typography, radius } from '../../theme';
import { ProfileStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<ProfileStackParamList, 'GroupSlots'>;

function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function fmt12(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function fmtDate(s: string): string {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

/* ─── Book Seats Modal ─── */
function BookSeatsModal({
  slot, visible, onClose, onBooked,
}: {
  slot: GroupSlot;
  visible: boolean;
  onClose: () => void;
  onBooked: () => void;
}) {
  const spotsLeft = slot.spotsLeft ?? Math.max(0, slot.totalCapacity - (slot.bookedCount ?? 0));
  const [seats, setSeats] = useState(1);

  const mutation = useMutation({
    mutationFn: () => bookingsApi.bookGroupSeats(slot.id, seats),
    onSuccess: () => {
      Alert.alert('Booked! 🎉', `${seats} seat${seats > 1 ? 's' : ''} confirmed for ${fmtDate(slot.date)}.`);
      onBooked();
      onClose();
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />

          <View style={modalStyles.header}>
            <View>
              <Text style={modalStyles.title}>Book Seats</Text>
              <Text style={modalStyles.sub}>{fmtDate(slot.date)} · {fmt12(slot.startTime)} — {fmt12(slot.endTime)}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={modalStyles.infoRow}>
            <Text style={modalStyles.infoText}>💺 {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left</Text>
            {slot.pricePerPersonCents != null && (
              <Text style={modalStyles.infoText}>
                💰 ${(slot.pricePerPersonCents / 100).toFixed(2)}/person
              </Text>
            )}
          </View>

          {/* Seat stepper */}
          <Text style={modalStyles.label}>How many seats?</Text>
          <View style={modalStyles.stepper}>
            <TouchableOpacity
              style={modalStyles.stepBtn}
              onPress={() => setSeats(s => Math.max(1, s - 1))}
            >
              <Text style={modalStyles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={modalStyles.stepCount}>{seats}</Text>
            <TouchableOpacity
              style={modalStyles.stepBtn}
              onPress={() => setSeats(s => Math.min(spotsLeft, s + 1))}
            >
              <Text style={modalStyles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {slot.pricePerPersonCents != null && (
            <Text style={modalStyles.total}>
              Total: <Text style={modalStyles.totalAmt}>${((slot.pricePerPersonCents * seats) / 100).toFixed(2)}</Text>
            </Text>
          )}

          <TouchableOpacity
            style={[modalStyles.confirmBtn, mutation.isPending && modalStyles.confirmDisabled]}
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            <Text style={modalStyles.confirmBtnText}>
              {mutation.isPending ? 'Booking…' : `Book ${seats} Seat${seats > 1 ? 's' : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Main Screen ─── */
export default function GroupSlotsScreen({ route }: Props) {
  const { serviceId } = route.params;
  const queryClient   = useQueryClient();

  const [fromDate, setFromDate]         = useState(isoDate(0));
  const [toDate, setToDate]             = useState(isoDate(30));
  const [fromInput, setFromInput]       = useState(fromDate);
  const [toInput, setToInput]           = useState(toDate);
  const [selectedSlot, setSelectedSlot] = useState<GroupSlot | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['groupSlots', serviceId, fromDate, toDate],
    queryFn:  () => bookingsApi.getGroupSlots(serviceId, fromDate, toDate),
  });

  const slots: GroupSlot[] = (data as { slots?: GroupSlot[] } | undefined)?.slots ?? [];

  const handleSearch = () => {
    setFromDate(fromInput);
    setToDate(toInput);
  };

  const handleWaitlist = async (slot: GroupSlot) => {
    try {
      await bookingsApi.joinWaitlist(slot.id, 1);
      Alert.alert("You're on the list! 🎟", "We'll notify you if a spot opens up.");
      queryClient.invalidateQueries({ queryKey: ['groupSlots'] });
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  const renderSlot = ({ item: slot }: { item: GroupSlot }) => {
    const spotsLeft = slot.spotsLeft ?? Math.max(0, slot.totalCapacity - (slot.bookedCount ?? 0));
    const full      = spotsLeft <= 0;
    const pct       = slot.totalCapacity > 0
      ? Math.min(1, ((slot.totalCapacity - spotsLeft) / slot.totalCapacity))
      : 0;

    const spotColor = full ? colors.textMuted : spotsLeft <= 3 ? colors.warning : colors.success;
    const spotBg    = full ? colors.bgMuted : spotsLeft <= 3 ? '#fffbeb' : '#ecfdf5';

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.cardDate}>{fmtDate(slot.date)}</Text>
            <Text style={styles.cardTime}>🕐 {fmt12(slot.startTime)} — {fmt12(slot.endTime)}</Text>
          </View>
          <View style={styles.cardRight}>
            {slot.pricePerPersonCents != null && (
              <Text style={styles.price}>
                ${(slot.pricePerPersonCents / 100).toFixed(2)}
                <Text style={styles.perPerson}>/person</Text>
              </Text>
            )}
            <View style={[styles.spotsBadge, { backgroundColor: spotBg }]}>
              <Text style={[styles.spotsText, { color: spotColor }]}>
                {full ? 'Full' : `${spotsLeft} left`}
              </Text>
            </View>
          </View>
        </View>

        {/* Capacity bar */}
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
        </View>

        {full ? (
          <TouchableOpacity style={styles.btnWaitlist} onPress={() => handleWaitlist(slot)}>
            <Text style={styles.btnWaitlistText}>Join Waitlist</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnBook} onPress={() => setSelectedSlot(slot)}>
            <Text style={styles.btnBookText}>Book Seats</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Date filter */}
      <View style={styles.filterBar}>
        <View style={styles.dateInputs}>
          <TextInput
            style={styles.dateInput}
            value={fromInput}
            onChangeText={setFromInput}
            placeholder="From (YYYY-MM-DD)"
            keyboardType="numbers-and-punctuation"
          />
          <Text style={styles.dateSep}>→</Text>
          <TextInput
            style={styles.dateInput}
            value={toInput}
            onChangeText={setToInput}
            placeholder="To (YYYY-MM-DD)"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ ...typography.bodySmall, color: colors.danger }}>
            {(error as Error).message}
          </Text>
        </View>
      ) : (
        <FlatList
          data={slots}
          keyExtractor={s => s.id}
          renderItem={renderSlot}
          contentContainerStyle={[styles.list, slots.length === 0 && { flex: 1 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyTitle}>No sessions found</Text>
              <Text style={styles.emptySub}>Try expanding your date range.</Text>
            </View>
          }
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}

      {selectedSlot && (
        <BookSeatsModal
          slot={selectedSlot}
          visible={true}
          onClose={() => setSelectedSlot(null)}
          onBooked={() => {
            queryClient.invalidateQueries({ queryKey: ['groupSlots'] });
            setSelectedSlot(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bgSubtle },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center' },

  filterBar:  { backgroundColor: colors.white, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  dateInputs: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateInput:  { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, minHeight: 40, fontSize: 13 },
  dateSep:    { color: colors.textMuted, fontSize: 16 },
  searchBtn:  { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  searchBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  list: { padding: spacing.md, paddingBottom: spacing.xl },

  card:    { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  cardDate: { ...typography.h4, marginBottom: 2 },
  cardTime: { ...typography.bodySmall },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  price:     { fontSize: 18, fontWeight: '700', color: colors.primary },
  perPerson: { fontSize: 12, color: colors.textMuted, fontWeight: '400' },
  spotsBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  spotsText:  { fontSize: 11, fontWeight: '600' },

  barBg:   { height: 4, backgroundColor: colors.bgMuted, borderRadius: 2, marginBottom: spacing.sm, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },

  btnBook:     { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnBookText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  btnWaitlist:     { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnWaitlistText: { color: colors.text, fontWeight: '600', fontSize: 14 },

  empty:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: { ...typography.h3, marginBottom: spacing.xs, textAlign: 'center' },
  emptySub:   { ...typography.bodySmall, textAlign: 'center' },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:   { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.md, paddingBottom: spacing.xl },
  handle:  { width: 40, height: 4, backgroundColor: colors.borderMedium, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  title:  { ...typography.h3 },
  sub:    { ...typography.bodySmall },
  close:  { fontSize: 20, color: colors.textMuted },

  infoRow:  { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md },
  infoText: { ...typography.label },

  label:   { ...typography.label, marginBottom: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.md },
  stepBtn: { width: 44, height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  stepBtnText: { fontSize: 22, fontWeight: '700', color: colors.text },
  stepCount:   { ...typography.h2, minWidth: 40, textAlign: 'center' },

  total:    { ...typography.body, marginBottom: spacing.md },
  totalAmt: { color: colors.primary, fontWeight: '700', fontSize: 20 },

  confirmBtn:      { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', minHeight: 44 },
  confirmDisabled: { opacity: 0.5 },
  confirmBtnText:  { color: colors.white, fontWeight: '700', fontSize: 15 },
});
