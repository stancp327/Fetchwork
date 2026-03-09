import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../components/common/Button';
import { paymentsApi, SavedPaymentMethod } from '../../api/endpoints/paymentsApi';
import { colors, radius, spacing, typography } from '../../theme';

export default function PaymentsScreen() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const statusQuery = useQuery({
    queryKey: ['mobile-payments-connect-status'],
    queryFn: () => paymentsApi.getConnectStatus(),
  });

  const methodsQuery = useQuery({
    queryKey: ['mobile-payment-methods'],
    queryFn: () => paymentsApi.getSavedMethods(),
  });

  const historyQuery = useQuery({
    queryKey: ['mobile-payment-history'],
    queryFn: () => paymentsApi.getHistory(1, 8),
  });

  const isRefreshing = statusQuery.isRefetching || methodsQuery.isRefetching || historyQuery.isRefetching;

  const onboardMutation = useMutation({
    mutationFn: () => paymentsApi.getStripeConnectUrl(),
    onSuccess: async (res) => {
      setError('');
      setMessage('Opening Stripe onboarding…');
      if (res?.onboardingUrl) await Linking.openURL(res.onboardingUrl);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Could not start Stripe onboarding');
      setMessage('');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (pmId: string) => paymentsApi.setDefaultMethod(pmId),
    onSuccess: (res) => {
      setError('');
      setMessage(res.message || 'Default card updated');
      queryClient.invalidateQueries({ queryKey: ['mobile-payment-methods'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to set default card');
      setMessage('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (pmId: string) => paymentsApi.removeMethod(pmId),
    onSuccess: (res) => {
      setError('');
      setMessage(res.message || 'Payment method removed');
      queryClient.invalidateQueries({ queryKey: ['mobile-payment-methods'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to remove card');
      setMessage('');
    },
  });

  const methods = useMemo(() => methodsQuery.data?.methods || [], [methodsQuery.data?.methods]);
  const payments = useMemo(() => historyQuery.data?.payments || [], [historyQuery.data?.payments]);

  const onRefresh = () => {
    statusQuery.refetch();
    methodsQuery.refetch();
    historyQuery.refetch();
  };

  const isLoading = statusQuery.isLoading || methodsQuery.isLoading || historyQuery.isLoading;
  const connect = statusQuery.data;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payout Account</Text>
          <Text style={styles.meta}>Connected: {connect?.connected ? 'Yes' : 'No'}</Text>
          <Text style={styles.meta}>Payouts Enabled: {connect?.payoutsEnabled ? 'Yes' : 'No'}</Text>
          <Text style={styles.meta}>Charges Enabled: {connect?.chargesEnabled ? 'Yes' : 'No'}</Text>
          <Button
            label={connect?.connected ? 'Update Stripe Onboarding' : 'Connect Stripe Account'}
            onPress={() => {
              setError('');
              setMessage('');
              onboardMutation.mutate();
            }}
            loading={onboardMutation.isPending}
            disabled={onboardMutation.isPending}
            fullWidth
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Saved Cards</Text>
          {methods.length === 0 ? (
            <Text style={styles.meta}>No saved cards yet.</Text>
          ) : (
            methods.map((method: SavedPaymentMethod) => (
              <View key={method.id} style={styles.methodRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>
                    {String(method.brand || 'card').toUpperCase()} •••• {method.last4 || '----'}
                  </Text>
                  <Text style={styles.meta}>
                    Expires {method.expMonth || '--'}/{method.expYear || '--'}
                    {method.isDefault ? ' · Default' : ''}
                  </Text>
                </View>

                <View style={styles.actionsRow}>
                  {!method.isDefault && (
                    <Button
                      label="Default"
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        setError('');
                        setMessage('');
                        setDefaultMutation.mutate(method.id);
                      }}
                      disabled={setDefaultMutation.isPending}
                    />
                  )}
                  <Button
                    label="Remove"
                    size="sm"
                    variant="danger"
                    onPress={() => {
                      setError('');
                      setMessage('');
                      removeMutation.mutate(method.id);
                    }}
                    disabled={removeMutation.isPending}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        {(error || message) && (
          <View style={styles.card}>
            {!!error && <Text style={styles.error}>{error}</Text>}
            {!!message && <Text style={styles.success}>{message}</Text>}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          {payments.length === 0 ? (
            <Text style={styles.meta}>No payment history yet.</Text>
          ) : (
            payments.map((item) => (
              <View key={item._id} style={styles.paymentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>{item.job?.title || 'Payment'}</Text>
                  <Text style={styles.meta}>{item.status || 'unknown'}</Text>
                </View>
                <Text style={styles.amount}>${Number(item.amount || 0).toFixed(2)}</Text>
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
  scroll: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.label, color: colors.textSecondary },
  meta: { ...typography.caption, color: colors.textSecondary },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  actionsRow: { flexDirection: 'row', gap: spacing.xs },
  methodTitle: { ...typography.body, color: colors.textDark, fontWeight: '600' },
  amount: { ...typography.body, color: colors.textDark, fontWeight: '700' },
  error: { ...typography.bodySmall, color: colors.danger },
  success: { ...typography.bodySmall, color: colors.success },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
