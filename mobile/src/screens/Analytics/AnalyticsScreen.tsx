import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  Pressable, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { analyticsApi, FreelancerAnalytics } from '../../api/endpoints/analyticsApi';
import Card from '../../components/common/Card';
import { colors, spacing, typography } from '../../theme';

type Range = '1mo' | '3mo' | '6mo' | '1yr';
const RANGES: { label: string; value: Range }[] = [
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1yr' },
];

function StatCard({ label, value, icon, sub }: { label: string; value: string; icon: string; sub?: string }) {
  return (
    <Card style={styles.statCard}>
      <Ionicons name={icon as any} size={20} color={colors.primary} style={styles.statIcon} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </Card>
  );
}

function MiniBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.max(value / max, 0.02) : 0.02;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={styles.barValue}>${value.toLocaleString()}</Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const [range, setRange] = useState<Range>('1yr');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['analytics', range],
    queryFn: () => analyticsApi.getMyAnalytics(range),
  });

  const f: FreelancerAnalytics | null = data?.freelancer ?? null;
  const maxMonthly = f ? Math.max(...(f.monthlyEarnings?.map(m => m.amount) ?? [0]), 1) : 1;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Range picker */}
        <View style={styles.rangePicker}>
          {RANGES.map(r => (
            <Pressable
              key={r.value}
              style={[styles.rangeBtn, range === r.value && styles.rangeBtnActive]}
              onPress={() => setRange(r.value)}
            >
              <Text style={[styles.rangeBtnText, range === r.value && styles.rangeBtnTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />}

        {f && (
          <>
            {/* Stats grid */}
            <View style={styles.grid}>
              <StatCard label="YTD Earnings" value={`$${f.ytdEarnings.toLocaleString()}`} icon="cash-outline" />
              <StatCard label="Total Earnings" value={`$${f.totalEarnings.toLocaleString()}`} icon="wallet-outline" />
              <StatCard label="Win Rate" value={`${f.winRate}%`} icon="trophy-outline" />
              <StatCard label="Avg Job Size" value={`$${f.avgJobSize.toLocaleString()}`} icon="briefcase-outline" />
              <StatCard label="Active Jobs" value={String(f.activeJobs)} icon="flash-outline" />
              <StatCard label="Completed" value={String(f.completedJobs)} icon="checkmark-circle-outline" />
              {f.ratingAvg != null && (
                <StatCard label="Rating" value={f.ratingAvg.toFixed(1)} icon="star-outline" sub={`${f.ratingCount} reviews`} />
              )}
              <StatCard label="Repeat Clients" value={`${Math.round(f.repeatClientRate * 100)}%`} icon="people-outline" />
            </View>

            {/* Proposal funnel */}
            <Text style={styles.sectionTitle}>Proposal Funnel</Text>
            <Card style={styles.funnelCard}>
              {[
                { label: 'Sent', value: f.proposalFunnel.sent, color: colors.primary },
                { label: 'Pending', value: f.proposalFunnel.pending, color: colors.warning },
                { label: 'Accepted', value: f.proposalFunnel.accepted, color: colors.success },
                { label: 'Declined', value: f.proposalFunnel.declined, color: colors.danger },
              ].map(item => (
                <View key={item.label} style={styles.funnelRow}>
                  <Text style={styles.funnelLabel}>{item.label}</Text>
                  <View style={styles.funnelTrack}>
                    <View style={[styles.funnelFill, {
                      width: f.proposalFunnel.sent > 0 ? `${(item.value / f.proposalFunnel.sent) * 100}%` : '2%',
                      backgroundColor: item.color,
                    }]} />
                  </View>
                  <Text style={styles.funnelValue}>{item.value}</Text>
                </View>
              ))}
            </Card>

            {/* Monthly earnings */}
            {f.monthlyEarnings?.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Monthly Earnings</Text>
                <Card style={styles.chartCard}>
                  {f.monthlyEarnings.slice(-6).map(m => (
                    <MiniBar key={m.month} label={m.month} value={m.amount} max={maxMonthly} />
                  ))}
                </Card>
              </>
            )}

            {/* Top categories */}
            {f.topCategories?.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Top Categories</Text>
                <Card>
                  {f.topCategories.slice(0, 5).map(c => (
                    <View key={c.category} style={styles.categoryRow}>
                      <Text style={styles.categoryName}>{c.category.replace(/_/g, ' ')}</Text>
                      <Text style={styles.categoryStats}>{c.jobs} jobs · ${c.earned.toLocaleString()}</Text>
                    </View>
                  ))}
                </Card>
              </>
            )}
          </>
        )}

        {!isLoading && !f && (
          <Card style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No analytics yet</Text>
            <Text style={styles.emptySub}>Complete jobs to see your stats here</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },

  rangePicker: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 8, padding: 3, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  rangeBtn: { flex: 1, paddingVertical: spacing.xs, alignItems: 'center', borderRadius: 6 },
  rangeBtnActive: { backgroundColor: colors.primary },
  rangeBtnText: { ...typography.bodySmall, color: colors.textMuted, fontWeight: '600' },
  rangeBtnTextActive: { color: colors.white },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { width: '47%', alignItems: 'center', paddingVertical: spacing.md },
  statIcon: { marginBottom: spacing.xs },
  statValue: { ...typography.h3, color: colors.text, fontWeight: '700' },
  statLabel: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  statSub: { ...typography.caption, color: colors.textMuted },

  sectionTitle: { ...typography.label, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },

  funnelCard: { marginBottom: spacing.md },
  funnelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  funnelLabel: { ...typography.bodySmall, color: colors.textMuted, width: 60 },
  funnelTrack: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  funnelFill: { height: '100%', borderRadius: 4 },
  funnelValue: { ...typography.bodySmall, fontWeight: '600', color: colors.text, width: 30, textAlign: 'right' },

  chartCard: { marginBottom: spacing.md },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  barLabel: { ...typography.caption, color: colors.textMuted, width: 36 },
  barTrack: { flex: 1, height: 14, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  barValue: { ...typography.caption, color: colors.text, width: 50, textAlign: 'right' },

  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  categoryName: { ...typography.body, color: colors.text, textTransform: 'capitalize' },
  categoryStats: { ...typography.bodySmall, color: colors.textMuted },

  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { ...typography.h3, color: colors.text },
  emptySub: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
