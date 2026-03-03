import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, RefreshControl, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../api/endpoints/billingApi';
import { colors, spacing, typography, radius } from '../../theme';

export default function WalletScreen() {
  const { data, refetch, isRefetching, isLoading } = useQuery({
    queryKey: ['mobile-wallet-balance'],
    queryFn: () => billingApi.getWalletBalance(),
  });

  const balance = Number(data?.balance || 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <Text style={styles.label}>Wallet Balance</Text>
          <Text style={styles.balance}>{isLoading ? 'Loading…' : `$${balance.toFixed(2)}`}</Text>
          <Text style={styles.sub}>Top up/withdraw flows remain available on web while mobile parity is finalized.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: { ...typography.caption, color: colors.textSecondary },
  balance: { ...typography.h2, color: colors.textDark },
  sub: { ...typography.bodySmall, color: colors.textMuted },
});
