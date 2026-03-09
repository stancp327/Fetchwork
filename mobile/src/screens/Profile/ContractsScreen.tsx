import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { contractsApi } from '../../api/endpoints/contractsApi';
import { colors, radius, spacing, typography } from '../../theme';
import { useAuth } from '../../context/AuthContext';

const STATUS_FILTERS = ['all', 'draft', 'pending', 'active', 'completed', 'cancelled'];

export default function ContractsScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [signatureName, setSignatureName] = useState(`${user?.firstName || ''} ${user?.lastName || ''}`.trim());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data, isLoading, error: queryError, isRefetching, refetch } = useQuery({
    queryKey: ['mobile-contracts', filter],
    queryFn: () => contractsApi.getContracts(filter),
  });

  useEffect(() => {
    if (!signatureName.trim() && user) {
      setSignatureName(`${user.firstName || ''} ${user.lastName || ''}`.trim());
    }
  }, [user, signatureName]);

  const refreshContracts = () => {
    queryClient.invalidateQueries({ queryKey: ['mobile-contracts'] });
    refetch();
  };

  const sendMutation = useMutation({
    mutationFn: (id: string) => contractsApi.sendContract(id),
    onSuccess: (res) => {
      setError('');
      setMessage(res.message || 'Contract sent');
      refreshContracts();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to send contract');
      setMessage('');
    },
  });

  const signMutation = useMutation({
    mutationFn: (id: string) => contractsApi.signContract(id, signatureName.trim()),
    onSuccess: (res) => {
      setError('');
      setMessage(res.message || 'Contract signed');
      refreshContracts();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to sign contract');
      setMessage('');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => contractsApi.cancelContract(id, 'Cancelled from mobile'),
    onSuccess: (res) => {
      setError('');
      setMessage(res.message || 'Contract cancelled');
      refreshContracts();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to cancel contract');
      setMessage('');
    },
  });

  const contracts = useMemo(() => data?.contracts || [], [data?.contracts]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (queryError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load data</Text>
          <Button label="Retry" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contracts</Text>
          <View style={styles.filtersWrap}>
            {STATUS_FILTERS.map((status) => (
              <Button
                key={status}
                label={status[0].toUpperCase() + status.slice(1)}
                size="sm"
                variant={filter === status ? 'primary' : 'secondary'}
                onPress={() => {
                  setError('');
                  setMessage('');
                  setFilter(status);
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Signature Name</Text>
          <Input
            value={signatureName}
            onChangeText={setSignatureName}
            placeholder="Type full name"
          />
          <Text style={styles.meta}>Used when signing pending contracts.</Text>
        </View>

        {(error || message) && (
          <View style={styles.card}>
            {!!error && <Text style={styles.error}>{error}</Text>}
            {!!message && <Text style={styles.success}>{message}</Text>}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contract List</Text>
          {!contracts.length ? (
            <Text style={styles.meta}>{isLoading ? 'Loading contracts…' : 'No contracts found for this filter.'}</Text>
          ) : (
            contracts.map((contract) => {
              const clientName = `${contract.client?.firstName || ''} ${contract.client?.lastName || ''}`.trim() || 'Client';
              const freelancerName = `${contract.freelancer?.firstName || ''} ${contract.freelancer?.lastName || ''}`.trim() || 'Freelancer';

              return (
                <View key={contract._id} style={styles.contractRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contractTitle}>{contract.title}</Text>
                    <Text style={styles.meta}>Status: {contract.status}</Text>
                    <Text style={styles.meta}>{clientName} ↔ {freelancerName}</Text>
                  </View>

                  <View style={styles.actionsCol}>
                    {contract.status === 'draft' && (
                      <Button
                        label="Send"
                        size="sm"
                        onPress={() => {
                          setError('');
                          setMessage('');
                          sendMutation.mutate(contract._id);
                        }}
                        disabled={sendMutation.isPending}
                      />
                    )}

                    {(contract.status === 'pending' || contract.status === 'active') && (
                      <Button
                        label="Sign"
                        size="sm"
                        variant="success"
                        onPress={() => {
                          setError('');
                          setMessage('');
                          signMutation.mutate(contract._id);
                        }}
                        disabled={signMutation.isPending || !signatureName.trim()}
                      />
                    )}

                    {!['cancelled', 'completed'].includes(contract.status) && (
                      <Button
                        label="Cancel"
                        size="sm"
                        variant="secondary"
                        onPress={() => {
                          setError('');
                          setMessage('');
                          cancelMutation.mutate(contract._id);
                        }}
                        disabled={cancelMutation.isPending}
                      />
                    )}
                  </View>
                </View>
              );
            })
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
  error: { ...typography.bodySmall, color: colors.danger },
  success: { ...typography.bodySmall, color: colors.success },
  filtersWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  contractRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  contractTitle: { ...typography.body, fontWeight: '700', color: colors.textDark },
  actionsCol: { gap: spacing.xs, minWidth: 110 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { ...typography.bodySmall, color: colors.danger },
});
