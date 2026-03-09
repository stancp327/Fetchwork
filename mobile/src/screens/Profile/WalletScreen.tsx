import React, { useMemo, useState } from 'react';
import { Linking, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../../api/endpoints/billingApi';
import { colors, spacing, typography, radius } from '../../theme';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

export default function WalletScreen() {
  const queryClient = useQueryClient();
  const [topUpAmount, setTopUpAmount] = useState('25');
  const [withdrawAmount, setWithdrawAmount] = useState('10');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data, refetch, isRefetching, isLoading, error: walletQueryError } = useQuery({
    queryKey: ['mobile-wallet'],
    queryFn: () => billingApi.getWallet(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const queryError = (walletQueryError as any)?.response?.data?.error;

  const balance = Number(data?.balance || 0);
  const recentHistory = useMemo(() => (data?.history || []).slice(0, 8), [data?.history]);

  const topUpMutation = useMutation({
    mutationFn: (amount: number) => billingApi.addWalletFunds(amount),
    onSuccess: async (res) => {
      setError('');
      setMessage('Opening secure checkout…');
      if (res?.checkoutUrl) {
        await Linking.openURL(res.checkoutUrl);
      }
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Could not start wallet top-up');
      setMessage('');
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (amount: number) => billingApi.withdrawWalletFunds(amount),
    onSuccess: (res) => {
      setError('');
      setMessage(`Withdrawal sent: $${Number(res.withdrawn || 0).toFixed(2)}`);
      queryClient.invalidateQueries({ queryKey: ['mobile-wallet'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Withdrawal failed');
      setMessage('');
    },
  });

  const onTopUp = () => {
    const amount = Number(topUpAmount);
    if (!amount || amount < 5) {
      setError('Top-up minimum is $5');
      setMessage('');
      return;
    }
    setError('');
    setMessage('');
    topUpMutation.mutate(amount);
  };

  const onWithdraw = () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount < 1) {
      setError('Withdrawal minimum is $1');
      setMessage('');
      return;
    }
    setError('');
    setMessage('');
    withdrawMutation.mutate(amount);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <Text style={styles.label}>Wallet Balance</Text>
          <Text style={styles.balance}>{isLoading ? 'Loading…' : `$${balance.toFixed(2)}`}</Text>
          <Text style={styles.sub}>Use top-up to add funds or withdraw to your connected payout account.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Top Up</Text>
          <Input
            label="Amount (USD)"
            value={topUpAmount}
            onChangeText={setTopUpAmount}
            keyboardType="decimal-pad"
            placeholder="25"
          />
          <Button
            label="Add Funds"
            onPress={onTopUp}
            loading={topUpMutation.isPending}
            disabled={topUpMutation.isPending}
            fullWidth
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Withdraw</Text>
          <Input
            label="Amount (USD)"
            value={withdrawAmount}
            onChangeText={setWithdrawAmount}
            keyboardType="decimal-pad"
            placeholder="10"
          />
          <Button
            label="Withdraw"
            variant="secondary"
            onPress={onWithdraw}
            loading={withdrawMutation.isPending}
            disabled={withdrawMutation.isPending}
            fullWidth
          />
        </View>

        {(error || message || queryError) && (
          <View style={styles.card}>
            {!!error && <Text style={styles.error}>{error}</Text>}
            {!error && !!queryError && <Text style={styles.error}>{queryError}</Text>}
            {!!message && <Text style={styles.success}>{message}</Text>}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Wallet Activity</Text>
          {recentHistory.length === 0 ? (
            <Text style={styles.sub}>No recent activity yet.</Text>
          ) : (
            recentHistory.map((entry) => (
              <View key={entry._id} style={styles.historyRow}>
                <View style={styles.historyContent}>
                  <Text style={styles.historyReason}>{entry.reason || 'Wallet activity'}</Text>
                  <Text style={styles.historyMeta}>{entry.status}</Text>
                </View>
                <Text style={styles.historyAmount}>${Number(entry.amount || 0).toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  scroll: { padding: spacing.md },
  historyContent: { flex: 1 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  label: { ...typography.caption, color: colors.textSecondary },
  balance: { ...typography.h2, color: colors.textDark },
  sub: { ...typography.bodySmall, color: colors.textMuted },
  sectionTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  error: { ...typography.bodySmall, color: colors.danger },
  success: { ...typography.bodySmall, color: colors.success },
  historyRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historyReason: { ...typography.body, color: colors.textDark },
  historyMeta: { ...typography.caption, color: colors.textMuted, textTransform: 'capitalize' },
  historyAmount: { ...typography.body, fontWeight: '700', color: colors.textDark },
});
