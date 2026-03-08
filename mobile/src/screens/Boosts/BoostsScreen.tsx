import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { boostsApi, BoostTier } from '../../api/endpoints/boostsApi';
import { jobsApi } from '../../api/endpoints/jobsApi';
import { servicesApi } from '../../api/endpoints/servicesApi';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { colors, spacing, typography } from '../../theme';

type Tab = 'jobs' | 'services';

const TIERS: { value: BoostTier; label: string; days: number; price: string; credits: number; color: string }[] = [
  { value: 'standard', label: 'Standard', days: 7,  price: '$4.99',  credits: 1, color: colors.primary },
  { value: 'premium',  label: 'Premium',  days: 14, price: '$8.99',  credits: 2, color: '#8b5cf6' },
  { value: 'featured', label: 'Featured', days: 30, price: '$14.99', credits: 3, color: '#f59e0b' },
];

export default function BoostsScreen() {
  const [tab, setTab] = useState<Tab>('jobs');
  const [selected, setSelected] = useState<{ id: string; type: Tab } | null>(null);
  const qc = useQueryClient();

  const { data: credits } = useQuery({ queryKey: ['boost-credits'], queryFn: boostsApi.getCredits });
  const { data: jobsData } = useQuery({ queryKey: ['jobs', 'mine'], queryFn: () => jobsApi.browse({ mine: true, limit: 20 }) });
  const { data: servicesData } = useQuery({ queryKey: ['services', 'me'], queryFn: servicesApi.getMyServices });

  const boostMut = useMutation({
    mutationFn: ({ id, type, tier }: { id: string; type: Tab; tier: BoostTier }) =>
      type === 'jobs' ? boostsApi.boostJob(id, tier) : boostsApi.boostService(id, tier),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['boost-credits'] });
      setSelected(null);
      const exp = new Date(data.boost.expiresAt).toLocaleDateString();
      Alert.alert('Boost Active! 🚀', `Your listing is now boosted until ${exp}.`);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const handleBoost = (id: string, type: Tab) => {
    setSelected({ id, type });
  };

  const confirmBoost = (tier: BoostTier) => {
    if (!selected) return;
    boostMut.mutate({ id: selected.id, type: selected.type, tier });
  };

  const jobs = jobsData?.jobs ?? [];
  const services = Array.isArray(servicesData) ? servicesData : servicesData?.services ?? [];
  const items = tab === 'jobs' ? jobs : services;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Credits card */}
        <Card style={styles.creditsCard}>
          <View style={styles.creditsRow}>
            <Ionicons name="flash" size={24} color={colors.warning} />
            <View style={styles.creditsInfo}>
              <Text style={styles.creditsCount}>{credits?.credits ?? 0} boost credits</Text>
              <Text style={styles.creditsLabel}>{credits?.plan ?? 'Free'} plan</Text>
            </View>
          </View>
          {(credits?.credits ?? 0) === 0 && (
            <Text style={styles.upgradeHint}>⚡ Upgrade your plan to get free monthly boost credits</Text>
          )}
        </Card>

        {/* Tier picker (shows when item selected) */}
        {selected && (
          <Card style={styles.tierSection}>
            <Text style={styles.tierTitle}>Choose Boost Duration</Text>
            {TIERS.map(t => (
              <Pressable
                key={t.value}
                style={[styles.tierRow, { borderColor: t.color }]}
                onPress={() => confirmBoost(t.value)}
                disabled={boostMut.isPending}
              >
                <View style={[styles.tierBadge, { backgroundColor: t.color }]}>
                  <Text style={styles.tierBadgeText}>{t.label}</Text>
                </View>
                <View style={styles.tierInfo}>
                  <Text style={styles.tierDays}>{t.days} days</Text>
                  <Text style={styles.tierCredits}>{t.credits} credit{t.credits > 1 ? 's' : ''}</Text>
                </View>
                <Text style={styles.tierPrice}>{t.price}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.cancelBtn} onPress={() => setSelected(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Card>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['jobs', 'services'] as Tab[]).map(t => (
            <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Items list */}
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="flash-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No {tab} to boost yet</Text>
          </View>
        ) : (
          items.map((item: any) => (
            <Card key={item._id} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.itemMeta}>
                    {item.category?.replace(/_/g, ' ')}
                    {item.isBoosted ? ' · Boosted ⚡' : ''}
                  </Text>
                </View>
                <Pressable
                  style={[styles.boostBtn, item.isBoosted && styles.boostBtnActive]}
                  onPress={() => !item.isBoosted && handleBoost(item._id, tab)}
                  disabled={!!item.isBoosted}
                >
                  <Ionicons name="flash" size={14} color={item.isBoosted ? colors.warning : colors.white} />
                  <Text style={[styles.boostBtnText, item.isBoosted && styles.boostBtnTextActive]}>
                    {item.isBoosted ? 'Boosted' : 'Boost'}
                  </Text>
                </Pressable>
              </View>
            </Card>
          ))
        )}

        {boostMut.isPending && (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },

  creditsCard: { marginBottom: spacing.md },
  creditsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  creditsInfo: { flex: 1 },
  creditsCount: { ...typography.h3, color: colors.text, fontWeight: '700' },
  creditsLabel: { ...typography.bodySmall, color: colors.textMuted },
  upgradeHint: { ...typography.bodySmall, color: colors.warning, marginTop: spacing.sm },

  tierSection: { marginBottom: spacing.md, borderWidth: 2, borderColor: colors.primary },
  tierTitle: { ...typography.label, color: colors.text, marginBottom: spacing.sm },
  tierRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 8, borderWidth: 1, marginBottom: spacing.sm,
  },
  tierBadge: { borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  tierBadgeText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  tierInfo: { flex: 1 },
  tierDays: { ...typography.body, fontWeight: '600', color: colors.text },
  tierCredits: { ...typography.caption, color: colors.textMuted },
  tierPrice: { ...typography.body, fontWeight: '700', color: colors.text },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.xs },
  cancelText: { ...typography.body, color: colors.textMuted },

  tabs: { flexDirection: 'row', marginBottom: spacing.md, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: colors.white },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.body, color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.white },

  itemCard: { marginBottom: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemInfo: { flex: 1 },
  itemTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  itemMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  boostBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  boostBtnActive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.warning },
  boostBtnText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  boostBtnTextActive: { color: colors.warning },

  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted },
});
