import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  Switch, Pressable, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ServicesStackParamList } from '../../types/navigation';
import {
  availabilityApi,
  LocationMode,
  TimeWindow,
  ResolvedAvailability,
} from '../../api/endpoints/availabilityApi';
import { colors, spacing, radius, typography, MIN_TOUCH_TARGET } from '../../theme';

type Props = NativeStackScreenProps<ServicesStackParamList, 'AvailabilityManager'>;

// ── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SLOT_DURATIONS = [
  { value: 30,  label: '30 min' },
  { value: 45,  label: '45 min' },
  { value: 60,  label: '1 hour' },
  { value: 90,  label: '90 min' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
];

const BUFFER_OPTIONS = [
  { value: 0,  label: 'None' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
];

const TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const LOCATION_MODES: { value: LocationMode; icon: string; label: string; desc: string }[] = [
  { value: 'remote',        icon: '💻', label: 'Remote',       desc: 'Video / phone / online' },
  { value: 'at_freelancer', icon: '📍', label: 'At my place',  desc: 'Client comes to you' },
  { value: 'at_client',     icon: '🚗', label: 'I travel',     desc: 'You go to the client' },
  { value: 'flexible',      icon: '🔄', label: 'Flexible',     desc: 'Client chooses' },
];

const defaultWindow = (): TimeWindow => ({ startTime: '09:00', endTime: '17:00' });

interface DayState {
  dayOfWeek: number;
  enabled:   boolean;
  windows:   TimeWindow[];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AvailabilityManagerScreen({ route, navigation }: Props) {
  const { serviceId } = route.params;

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [hasGlobal, setHasGlobal] = useState(true);
  const [resolvedInfo, setResolvedInfo] = useState<ResolvedAvailability | null>(null);

  // Location
  const [locationMode, setLocationMode]   = useState<LocationMode>('remote');
  const [locationAddress, setLocationAddr] = useState('');
  const [travelRadius, setTravelRadius]   = useState(25);
  const [locationNotes, setLocationNotes] = useState('');

  // Schedule override
  const [useOverride, setUseOverride] = useState(false);
  const [enabled, setEnabled]         = useState(true);
  const [timezone, setTimezone]       = useState('America/Los_Angeles');
  const [slotDuration, setSlotDuration] = useState(60);
  const [bufferTime, setBufferTime]   = useState(0);
  const [capacity, setCapacity]       = useState(1);
  const [minNotice, setMinNotice]     = useState(24);
  const [maxAdvance, setMaxAdvance]   = useState(60);
  const [schedule, setSchedule]       = useState<DayState[]>(
    DAYS.map((_, i) => ({ dayOfWeek: i, enabled: false, windows: [defaultWindow()] }))
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await availabilityApi.getServiceAvailability(serviceId);
      const a    = data.availability;
      const loc  = data.serviceLocation;

      if (!a) {
        setHasGlobal(false);
      } else {
        setHasGlobal(true);
        setResolvedInfo(a);
        setEnabled(a.isActive !== false);
        setTimezone(a.timezone || 'America/Los_Angeles');
        setSlotDuration(a.slotDuration || 60);
        setBufferTime(a.bufferTime || 0);
        setCapacity(a.capacity || 1);
        setMinNotice(a.minNoticeHours || 24);
        setMaxAdvance(a.maxAdvanceBookingDays || 60);
        setUseOverride(!!a.isOverride);

        const ws = a.weeklySchedule || [];
        setSchedule(
          DAYS.map((_, i) => {
            const existing = ws.find(d => d.dayOfWeek === i);
            return {
              dayOfWeek: i,
              enabled:   !!existing && (existing.windows?.length ?? 0) > 0,
              windows:   existing?.windows?.length ? existing.windows : [defaultWindow()],
            };
          })
        );
      }

      if (loc) {
        setLocationMode(loc.mode || 'remote');
        setLocationAddr(loc.address || '');
        setTravelRadius(loc.travelRadius || 25);
        setLocationNotes(loc.notes || '');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => { load(); }, [load]);

  // ── Day / window helpers ───────────────────────────────────────────────────

  const toggleDay = (idx: number) => {
    setSchedule(s => s.map((d, i) => i === idx ? { ...d, enabled: !d.enabled } : d));
  };

  const updateWindow = (dayIdx: number, winIdx: number, field: keyof TimeWindow, value: string) => {
    setSchedule(s => s.map((d, i) => {
      if (i !== dayIdx) return d;
      const windows = d.windows.map((w, j) => j === winIdx ? { ...w, [field]: value } : w);
      return { ...d, windows };
    }));
  };

  const addWindow = (dayIdx: number) => {
    setSchedule(s => s.map((d, i) =>
      i === dayIdx ? { ...d, windows: [...d.windows, defaultWindow()] } : d
    ));
  };

  const removeWindow = (dayIdx: number, winIdx: number) => {
    setSchedule(s => s.map((d, i) => {
      if (i !== dayIdx) return d;
      const windows = d.windows.filter((_, j) => j !== winIdx);
      return { ...d, windows: windows.length ? windows : [defaultWindow()] };
    }));
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      await availabilityApi.updateServiceLocation(serviceId, {
        mode:         locationMode,
        address:      locationAddress,
        travelRadius,
        notes:        locationNotes,
      });

      if (useOverride) {
        const weeklySchedule = schedule
          .filter(d => d.enabled)
          .map(d => ({ dayOfWeek: d.dayOfWeek, windows: d.windows }));

        await availabilityApi.updateServiceOverride(serviceId, {
          timezone,
          slotDuration,
          bufferTime,
          capacity,
          minNoticeHours:        minNotice,
          maxAdvanceBookingDays: maxAdvance,
          weeklySchedule,
          isActive: enabled,
        });
      } else {
        // If override was previously set but now turned off, delete it
        if (resolvedInfo?.isOverride) {
          await availabilityApi.deleteServiceOverride(serviceId);
        }
      }

      Alert.alert('Saved', 'Availability settings updated ✅');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!hasGlobal) {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.alertCard}>
            <Text style={s.alertEmoji}>⚠️</Text>
            <Text style={s.alertTitle}>Set up global availability first</Text>
            <Text style={s.alertBody}>
              Before customizing this service, set your default schedule in Settings.
            </Text>
            <Pressable style={s.btn} onPress={() => navigation.navigate('MyServices')}>
              <Text style={s.btnText}>Go to Settings</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Location Section ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>📍 Service Location</Text>
          <Text style={s.hint}>How and where will you deliver this service?</Text>

          <View style={s.modeGrid}>
            {LOCATION_MODES.map(m => (
              <Pressable
                key={m.value}
                style={[s.modeBtn, locationMode === m.value && s.modeBtnActive]}
                onPress={() => setLocationMode(m.value)}
              >
                <Text style={s.modeIcon}>{m.icon}</Text>
                <Text style={[s.modeLabel, locationMode === m.value && s.modeLabelActive]}>
                  {m.label}
                </Text>
                <Text style={s.modeDesc}>{m.desc}</Text>
              </Pressable>
            ))}
          </View>

          {(locationMode === 'at_freelancer' || locationMode === 'flexible') && (
            <View style={s.field}>
              <Text style={s.fieldLabel}>Your Service Address</Text>
              <TextInput
                style={s.input}
                value={locationAddress}
                onChangeText={setLocationAddr}
                placeholder="123 Main St, Oakland CA"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          )}

          {(locationMode === 'at_client' || locationMode === 'flexible') && (
            <View style={s.field}>
              <Text style={s.fieldLabel}>Travel Radius (miles)</Text>
              <TextInput
                style={s.input}
                value={String(travelRadius)}
                onChangeText={v => setTravelRadius(Number(v) || 0)}
                keyboardType="numeric"
                placeholder="25"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          )}

          <View style={s.field}>
            <Text style={s.fieldLabel}>Location Notes (optional)</Text>
            <TextInput
              style={s.input}
              value={locationNotes}
              onChangeText={setLocationNotes}
              placeholder="Free parking, buzzer #4, etc."
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        {/* ── Custom Schedule Toggle ── */}
        <View style={s.card}>
          <View style={s.overrideRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionTitle}>🕐 Custom Schedule</Text>
              <Text style={s.hint}>
                {useOverride
                  ? 'Using a custom schedule for this service only.'
                  : 'Using your global default schedule.'}
              </Text>
            </View>
            <Switch
              value={useOverride}
              onValueChange={setUseOverride}
              trackColor={{ true: colors.primary, false: colors.borderMedium }}
              thumbColor={colors.white}
            />
          </View>

          {!useOverride && resolvedInfo && (
            <View style={s.resolvedBox}>
              <Text style={s.resolvedText}>
                {resolvedInfo.timezone} · {resolvedInfo.slotDuration}min sessions
                {resolvedInfo.bufferTime > 0 ? ` · ${resolvedInfo.bufferTime}min buffer` : ''}
                {' '}· up to {resolvedInfo.maxAdvanceBookingDays} days out
              </Text>
            </View>
          )}
        </View>

        {/* ── Custom Schedule Fields ── */}
        {useOverride && (
          <>
            {/* Booking enabled toggle */}
            <View style={s.card}>
              <View style={s.overrideRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionTitle}>Accept Bookings</Text>
                  <Text style={s.hint}>Turn off to pause bookings for this service</Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={setEnabled}
                  trackColor={{ true: colors.success, false: colors.borderMedium }}
                  thumbColor={colors.white}
                />
              </View>
            </View>

            {/* General settings */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>General</Text>

              <Text style={s.fieldLabel}>Timezone</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                {TIMEZONES.map(tz => (
                  <Pressable
                    key={tz}
                    style={[s.chip, timezone === tz && s.chipActive]}
                    onPress={() => setTimezone(tz)}
                  >
                    <Text style={[s.chipText, timezone === tz && s.chipTextActive]}>
                      {tz.split('/').pop()?.replace('_', ' ')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[s.fieldLabel, { marginTop: spacing.md }]}>Session Duration</Text>
              <View style={s.chipRow}>
                {SLOT_DURATIONS.map(opt => (
                  <Pressable
                    key={opt.value}
                    style={[s.chip, slotDuration === opt.value && s.chipActive]}
                    onPress={() => setSlotDuration(opt.value)}
                  >
                    <Text style={[s.chipText, slotDuration === opt.value && s.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[s.fieldLabel, { marginTop: spacing.md }]}>Buffer Between Sessions</Text>
              <View style={s.chipRow}>
                {BUFFER_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.value}
                    style={[s.chip, bufferTime === opt.value && s.chipActive]}
                    onPress={() => setBufferTime(opt.value)}
                  >
                    <Text style={[s.chipText, bufferTime === opt.value && s.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={s.twoCol}>
                <View style={[s.field, { flex: 1 }]}>
                  <Text style={s.fieldLabel}>Min Notice (hrs)</Text>
                  <TextInput
                    style={s.input}
                    value={String(minNotice)}
                    onChangeText={v => setMinNotice(Number(v) || 0)}
                    keyboardType="numeric"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={[s.field, { flex: 1 }]}>
                  <Text style={s.fieldLabel}>Book Up To (days)</Text>
                  <TextInput
                    style={s.input}
                    value={String(maxAdvance)}
                    onChangeText={v => setMaxAdvance(Number(v) || 1)}
                    keyboardType="numeric"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={s.field}>
                <Text style={s.fieldLabel}>Max Per Slot <Text style={s.fieldHint}>(1 = 1-on-1, more = group)</Text></Text>
                <TextInput
                  style={[s.input, { width: 100 }]}
                  value={String(capacity)}
                  onChangeText={v => setCapacity(Math.max(1, Number(v) || 1))}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Weekly schedule */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Weekly Schedule</Text>
              <Text style={s.hint}>Toggle days on/off and set time windows (HH:MM)</Text>

              {schedule.map((day, dayIdx) => (
                <View key={day.dayOfWeek} style={s.dayRow}>
                  <View style={s.dayHeader}>
                    <Switch
                      value={day.enabled}
                      onValueChange={() => toggleDay(dayIdx)}
                      trackColor={{ true: colors.success, false: colors.borderMedium }}
                      thumbColor={colors.white}
                      style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                    />
                    <Text style={[s.dayName, !day.enabled && s.dayNameOff]}>
                      {DAYS[day.dayOfWeek]}
                    </Text>
                    {!day.enabled && <Text style={s.unavailText}>Unavailable</Text>}
                  </View>

                  {day.enabled && (
                    <View style={s.windows}>
                      {day.windows.map((win, winIdx) => (
                        <View key={winIdx} style={s.windowRow}>
                          <TextInput
                            style={s.timeInput}
                            value={win.startTime}
                            onChangeText={v => updateWindow(dayIdx, winIdx, 'startTime', v)}
                            placeholder="09:00"
                            placeholderTextColor={colors.textMuted}
                            maxLength={5}
                            keyboardType="numbers-and-punctuation"
                          />
                          <Text style={s.dash}>—</Text>
                          <TextInput
                            style={s.timeInput}
                            value={win.endTime}
                            onChangeText={v => updateWindow(dayIdx, winIdx, 'endTime', v)}
                            placeholder="17:00"
                            placeholderTextColor={colors.textMuted}
                            maxLength={5}
                            keyboardType="numbers-and-punctuation"
                          />
                          {day.windows.length > 1 && (
                            <Pressable
                              style={s.removeWinBtn}
                              onPress={() => removeWindow(dayIdx, winIdx)}
                              hitSlop={8}
                            >
                              <Text style={s.removeWinText}>✕</Text>
                            </Pressable>
                          )}
                        </View>
                      ))}
                      <Pressable style={s.addWinBtn} onPress={() => addWindow(dayIdx)}>
                        <Text style={s.addWinText}>+ Add window</Text>
                      </Pressable>
                    </View>
                  )}

                  {dayIdx < 6 && <View style={s.dayDivider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Save */}
        <Pressable
          style={[s.btn, saving && s.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={s.btnText}>💾 Save Settings</Text>
          }
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bgSubtle },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Cards
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionTitle: { ...typography.h4, marginBottom: 4 },
  hint:         { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },

  // Alert (no global availability)
  alertCard: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
    marginTop: spacing.xl,
  },
  alertEmoji: { fontSize: 36, marginBottom: spacing.sm },
  alertTitle: { ...typography.h3, marginBottom: spacing.xs, textAlign: 'center' },
  alertBody:  { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },

  // Location mode grid
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  modeBtn: {
    width: '47%',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.bgSubtle,
    minHeight: MIN_TOUCH_TARGET,
  },
  modeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  modeIcon:  { fontSize: 20, marginBottom: 2 },
  modeLabel: { ...typography.bodyBold, fontSize: 13, color: colors.textDark },
  modeLabelActive: { color: colors.primary },
  modeDesc:  { ...typography.caption, color: colors.textMuted, marginTop: 1 },

  // Fields
  field:      { marginBottom: spacing.sm },
  fieldLabel: { ...typography.caption, fontWeight: '600', color: colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  fieldHint:  { ...typography.caption, color: colors.textMuted, fontWeight: '400', textTransform: 'none' },
  input: {
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.textDark,
    backgroundColor: colors.white,
    minHeight: MIN_TOUCH_TARGET,
  },

  twoCol: { flexDirection: 'row', gap: spacing.sm },

  // Override toggle row
  overrideRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  resolvedBox:  { marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.bgMuted, borderRadius: radius.md },
  resolvedText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },

  // Chips (timezone / duration)
  chipScroll: { marginVertical: spacing.xs },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    marginRight: spacing.xs,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText:   { fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: colors.primary, fontWeight: '600' },

  // Day schedule
  dayRow:    { paddingVertical: spacing.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH_TARGET },
  dayName:   { ...typography.bodyBold, fontSize: 14, flex: 1 },
  dayNameOff: { color: colors.textMuted, fontWeight: '400' },
  unavailText: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  dayDivider: { height: 1, backgroundColor: colors.border, marginTop: spacing.sm },

  // Time windows
  windows:   { marginTop: spacing.xs, paddingLeft: 48 },
  windowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  timeInput: {
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: radius.sm,
    padding: spacing.xs,
    fontSize: 14,
    color: colors.textDark,
    backgroundColor: colors.white,
    width: 72,
    textAlign: 'center',
    minHeight: 40,
  },
  dash:        { color: colors.textMuted, fontSize: 16 },
  removeWinBtn: { padding: 8, minWidth: MIN_TOUCH_TARGET, alignItems: 'center' },
  removeWinText: { fontSize: 14, color: colors.danger },
  addWinBtn: {
    marginTop: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  addWinText: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  // Save button
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: colors.white, fontSize: 16, fontWeight: '700' },
});
