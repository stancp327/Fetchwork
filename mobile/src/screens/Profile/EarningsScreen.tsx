import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  Pressable, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { earningsApi } from '../../api/endpoints/earningsApi';
import { colors, spacing, radius, typography } from '../../theme';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function EarningsScreen() {
  const [year, setYear] = useState(CURRENT_YEAR);

  const { data, isLoading } = useQuery({
    queryKey: ['earnings', year],
    queryFn:  () => earningsApi.getEarnings(year),
  });

  const fmt = (n: number) =>
    '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const maxAmount = data ? Math.max(...data.monthly.map(m => m.amount), 1) : 1;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Year selector */}
        <View style={s.yearRow}>
          {YEARS.map(y => (
            <Pressable key={y} style={[s.yearBtn, year === y && s.yearBtnActive]} onPress={() => setYear(y)}>
              <Text style={[s.yearBtnText, year === y && s.yearBtnTextActive]}>{y}</Text>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : data ? (
          <>
            {/* Summary cards */}
            <View style={s.summaryRow}>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Year to Date</Text>
                <Text style={s.statValue}>{fmt(data.ytd)}</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>All Time</Text>
                <Text style={s.statValue}>{fmt(data.allTime)}</Text>
                <Text style={s.statSub}>{data.allTimeJobs} jobs</Text>
              </View>
            </View>
            {data.pendingEscrow > 0 && (
              <View style={[s.statCard, s.pendingCard]}>
                <Text style={s.statLabel}>Pending in Escrow</Text>
                <Text style={[s.statValue, { color: colors.warning }]}>{fmt(data.pendingEscrow)}</Text>
              </View>
            )}

            {/* Bar chart */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Monthly Breakdown — {year}</Text>
              <View style={s.chart}>
                {data.monthly.map(m => (
                  <View key={m.month} style={s.barCol}>
                    <Text style={s.barAmt} numberOfLines={1}>
                      {m.amount > 0 ? `$${Math.round(m.amount)}` : ''}
                    </Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { height: `${(m.amount / maxAmount) * 100}%` as any }]} />
                    </View>
                    <Text style={s.barMonth}>{m.name}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Table */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Breakdown</Text>
              <View style={s.tableHeader}>
                <Text style={[s.thCell, { flex: 2 }]}>Month</Text>
                <Text style={s.thCell}>Jobs</Text>
                <Text style={[s.thCell, { textAlign: 'right' }]}>Earned</Text>
              </View>
              {data.monthly.filter(m => m.amount > 0).length === 0 ? (
                <Text style={s.empty}>No earnings for {year}</Text>
              ) : data.monthly.filter(m => m.amount > 0).map(m => (
                <View key={m.month} style={s.tableRow}>
                  <Text style={[s.tdCell, { flex: 2 }]}>{m.name} {m.year}</Text>
                  <Text style={s.tdCell}>{m.jobCount}</Text>
                  <Text style={[s.tdCell, s.tdAmount, { textAlign: 'right' }]}>{fmt(m.amount)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={s.empty}>Failed to load earnings.</Text>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const BAR_HEIGHT = 100;

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bgSubtle },
  scroll: { padding: spacing.md },
  center: { paddingVertical: 48, alignItems: 'center' },

  yearRow:        { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  yearBtn:        { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderMedium, backgroundColor: colors.white, minHeight: 36 },
  yearBtnActive:  { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  yearBtnText:    { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  yearBtnTextActive: { color: colors.primary },

  summaryRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  statCard:    { flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  pendingCard: { marginBottom: spacing.sm, backgroundColor: colors.warningLight, borderColor: colors.warning },
  statLabel:   { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue:   { fontSize: 20, fontWeight: '800', color: colors.textDark, marginTop: 2 },
  statSub:     { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  card:         { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  sectionTitle: { ...typography.h4, marginBottom: spacing.md },

  chart:    { flexDirection: 'row', alignItems: 'flex-end', height: BAR_HEIGHT, gap: 2 },
  barCol:   { flex: 1, alignItems: 'center', height: '100%' },
  barAmt:   { fontSize: 8, color: colors.primary, fontWeight: '700', marginBottom: 2 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  barFill:  { width: '100%', minHeight: 2, backgroundColor: colors.primary, borderRadius: 3 },
  barMonth: { fontSize: 9, color: colors.textMuted, marginTop: 2 },

  tableHeader: { flexDirection: 'row', paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.xs },
  thCell:      { flex: 1, fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  tableRow:    { flexDirection: 'row', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  tdCell:      { flex: 1, fontSize: 13, color: colors.text },
  tdAmount:    { fontWeight: '700', color: colors.success },
  empty:       { textAlign: 'center', color: colors.textMuted, fontSize: 13, padding: spacing.xl },
});
