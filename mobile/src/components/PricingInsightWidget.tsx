/**
 * PricingInsightWidget (Mobile)
 * Compact market rate insight shown near price inputs.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { skillsApi, PricingInsights } from '../api/endpoints/skillsApi';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface Props {
  category: string;
  subcategory?: string;
  currentPrice?: number;
  mode?: 'service' | 'job';
}

const PricingInsightWidget: React.FC<Props> = ({ category, subcategory, currentPrice, mode = 'service' }) => {
  const [data, setData] = useState<PricingInsights | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!category) return;
    setLoading(true);
    setData(null);
    const fetcher = mode === 'job'
      ? skillsApi.getBudgetInsights(category)
      : skillsApi.getPricingInsights(category, subcategory);
    fetcher.then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [category, subcategory, mode]);

  if (!category) return null;
  if (loading) return (
    <View style={styles.row}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.hint}> Loading market rates…</Text>
    </View>
  );
  if (!data || data.insufficient || !data.median) return null;

  const { p25, median, p75 } = data;

  // Tip based on current price
  let tip = '';
  let tipColor = colors.textSecondary;
  if (currentPrice != null && p25 != null && p75 != null) {
    if (currentPrice < p25) {
      tip = '💡 Below market — consider raising your price';
      tipColor = '#d97706';
    } else if (currentPrice > p75) {
      tip = '💡 Above market — highlight your expertise';
      tipColor = '#2563eb';
    } else {
      tip = '✅ Right in the sweet spot';
      tipColor = '#16a34a';
    }
  }

  // Bar widths
  const min = data.min ?? 0;
  const max = data.max ?? 1;
  const range = max - min || 1;
  const p25Pct = ((p25! - min) / range) * 100;
  const p75Pct = ((p75! - min) / range) * 100;
  const iqrWidth = p75Pct - p25Pct;
  const medianPct = ((median - min) / range) * 100;
  const currentPct = currentPrice != null
    ? Math.max(0, Math.min(100, ((currentPrice - min) / range) * 100))
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Market {mode === 'job' ? 'Budgets' : 'Rates'}</Text>
        <Text style={styles.count}>{data.count} {mode === 'job' ? 'jobs' : 'services'}</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>25th %</Text>
          <Text style={styles.statValue}>${p25?.toLocaleString()}</Text>
        </View>
        <View style={[styles.stat, styles.statMedian]}>
          <Text style={styles.statLabel}>Median</Text>
          <Text style={[styles.statValue, { color: '#16a34a' }]}>${median.toLocaleString()}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>75th %</Text>
          <Text style={styles.statValue}>${p75?.toLocaleString()}</Text>
        </View>
      </View>

      {/* Bar */}
      <View style={styles.barWrap}>
        <View style={styles.bar}>
          {/* IQR band */}
          <View style={[styles.iqrBand, { left: `${p25Pct}%` as any, width: `${iqrWidth}%` as any }]} />
          {/* Median line */}
          <View style={[styles.medianLine, { left: `${medianPct}%` as any }]} />
          {/* Your price */}
          {currentPct != null && (
            <View style={[styles.yourLine, { left: `${currentPct}%` as any }]} />
          )}
        </View>
        <View style={styles.axisRow}>
          <Text style={styles.axisLabel}>${min.toLocaleString()}</Text>
          <Text style={styles.axisLabel}>${max.toLocaleString()}</Text>
        </View>
      </View>

      {tip ? (
        <Text style={[styles.tip, { color: tipColor }]}>{tip}</Text>
      ) : (
        <Text style={styles.tip}>
          Typical range: ${p25?.toLocaleString()}–${p75?.toLocaleString()} (avg ${data.avg?.toLocaleString()})
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
    gap: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 13, fontWeight: '700', color: colors.text },
  count: { fontSize: 11, color: colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1, backgroundColor: colors.background,
    borderRadius: 8, padding: 8, alignItems: 'center',
  },
  statMedian: { backgroundColor: '#f0fdf4' },
  statLabel: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  barWrap: { gap: 4 },
  bar: {
    height: 8, backgroundColor: colors.border, borderRadius: 999, overflow: 'visible', position: 'relative',
  },
  iqrBand: {
    position: 'absolute', top: 0, height: 8,
    backgroundColor: colors.primary, opacity: 0.2, borderRadius: 999,
  },
  medianLine: {
    position: 'absolute', top: -2, width: 2, height: 12,
    backgroundColor: '#16a34a', borderRadius: 2,
  },
  yourLine: {
    position: 'absolute', top: -3, width: 3, height: 14,
    backgroundColor: '#f59e0b', borderRadius: 2,
  },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { fontSize: 10, color: colors.textSecondary },
  tip: { fontSize: 12, lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  hint: { fontSize: 12, color: colors.textSecondary },
});

export default PricingInsightWidget;
