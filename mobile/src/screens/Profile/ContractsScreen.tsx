import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ListRenderItemInfo, Modal, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { contractsApi, ContractItem } from '../../api/endpoints/contractsApi';
import { colors, radius, spacing, typography } from '../../theme';
import { useAuth } from '../../context/AuthContext';

const STATUS_FILTERS = ['all', 'draft', 'pending', 'active', 'completed', 'cancelled'];
const TEMPLATE_OPTIONS = [
  { key: 'standard_service', label: 'Standard Service' },
  { key: 'nda', label: 'NDA' },
  { key: 'non_compete', label: 'Non-Compete' },
] as const;

function CreateContractModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<string>('standard_service');
  const [scope, setScope] = useState('');
  const [compensation, setCompensation] = useState('');
  const [freelancerId, setFreelancerId] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !freelancerId.trim()) {
      Alert.alert('Missing fields', 'Title and Freelancer User ID are required.');
      return;
    }
    setCreating(true);
    try {
      await contractsApi.createContract({
        freelancerId: freelancerId.trim(),
        title: title.trim(),
        template,
        terms: {
          scope: scope.trim() || undefined,
          compensation: compensation ? Number(compensation) : undefined,
        },
      });
      setTitle('');
      setScope('');
      setCompensation('');
      setFreelancerId('');
      onCreated();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to create contract');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <ScrollView>
            <Text style={modalStyles.heading}>New Contract</Text>

            <Text style={modalStyles.label}>Title *</Text>
            <TextInput style={modalStyles.input} value={title} onChangeText={setTitle} placeholder="Contract title" />

            <Text style={modalStyles.label}>Template</Text>
            <View style={modalStyles.templateRow}>
              {TEMPLATE_OPTIONS.map((t) => (
                <TouchableOpacity key={t.key} style={[modalStyles.templateChip, template === t.key && modalStyles.templateChipActive]} onPress={() => setTemplate(t.key)}>
                  <Text style={[modalStyles.templateChipText, template === t.key && modalStyles.templateChipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={modalStyles.label}>Scope of Work</Text>
            <TextInput style={[modalStyles.input, { minHeight: 80, textAlignVertical: 'top' }]} value={scope} onChangeText={setScope} placeholder="Describe the work..." multiline />

            <Text style={modalStyles.label}>Compensation ($)</Text>
            <TextInput style={modalStyles.input} value={compensation} onChangeText={setCompensation} placeholder="0" keyboardType="numeric" />

            <Text style={modalStyles.label}>Freelancer User ID *</Text>
            <TextInput style={modalStyles.input} value={freelancerId} onChangeText={setFreelancerId} placeholder="Paste user ID" autoCapitalize="none" />

            <View style={modalStyles.actions}>
              <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
              <Button label={creating ? 'Creating…' : 'Create'} onPress={handleCreate} disabled={creating} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ContractsScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [signatureName, setSignatureName] = useState(`${user?.firstName || ''} ${user?.lastName || ''}`.trim());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading, error: queryError, isRefetching, refetch } = useQuery({
    queryKey: ['mobile-contracts', filter],
    queryFn: () => contractsApi.getContracts(filter),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!signatureName.trim() && user) {
      setSignatureName(`${user.firstName || ''} ${user.lastName || ''}`.trim());
    }
  }, [user, signatureName]);

  const refreshContracts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mobile-contracts'] });
    refetch();
  }, [queryClient, refetch]);

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

  const completeMutation = useMutation({
    mutationFn: (id: string) => contractsApi.completeContract(id),
    onSuccess: (res) => {
      setError('');
      setMessage(res.message || 'Contract completed');
      refreshContracts();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to complete contract');
      setMessage('');
    },
  });

  const handleComplete = useCallback((id: string) => {
    Alert.alert('Complete Contract', 'Mark this contract as completed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: () => { setError(''); setMessage(''); completeMutation.mutate(id); } },
    ]);
  }, [completeMutation]);

  const contracts = useMemo(() => data?.contracts || [], [data?.contracts]);

  const handleFilterPress = useCallback((status: string) => {
    setError('');
    setMessage('');
    setFilter(status);
  }, []);

  const handleSend = useCallback((id: string) => {
    setError('');
    setMessage('');
    sendMutation.mutate(id);
  }, [sendMutation]);

  const handleSign = useCallback((id: string) => {
    setError('');
    setMessage('');
    signMutation.mutate(id);
  }, [signMutation]);

  const handleCancel = useCallback((id: string) => {
    setError('');
    setMessage('');
    cancelMutation.mutate(id);
  }, [cancelMutation]);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  const keyExtractor = useCallback((item: ContractItem) => item._id, []);

  const renderItem = useCallback(({ item: contract }: ListRenderItemInfo<ContractItem>) => {
    const clientName = `${contract.client?.firstName || ''} ${contract.client?.lastName || ''}`.trim() || 'Client';
    const freelancerName = `${contract.freelancer?.firstName || ''} ${contract.freelancer?.lastName || ''}`.trim() || 'Freelancer';

    return (
      <View style={styles.contractRow}>
        <View style={styles.contractInfo}>
          <Text style={styles.contractTitle}>{contract.title}</Text>
          <Text style={styles.meta}>Status: {contract.status}</Text>
          <Text style={styles.meta}>{clientName} ↔ {freelancerName}</Text>
        </View>

        <View style={styles.actionsCol}>
          {contract.status === 'draft' && (
            <Button
              label="Send"
              size="sm"
              onPress={() => handleSend(contract._id)}
              disabled={sendMutation.isPending}
            />
          )}

          {(contract.status === 'pending' || contract.status === 'active') && (
            <Button
              label="Sign"
              size="sm"
              variant="success"
              onPress={() => handleSign(contract._id)}
              disabled={signMutation.isPending || !signatureName.trim()}
            />
          )}

          {contract.status === 'active' && (
            <Button
              label="Complete"
              size="sm"
              variant="success"
              onPress={() => handleComplete(contract._id)}
              disabled={completeMutation.isPending}
            />
          )}

          {!['cancelled', 'completed'].includes(contract.status) && (
            <Button
              label="Cancel"
              size="sm"
              variant="secondary"
              onPress={() => handleCancel(contract._id)}
              disabled={cancelMutation.isPending}
            />
          )}
        </View>
      </View>
    );
  }, [handleSend, handleSign, handleCancel, handleComplete, sendMutation.isPending, signMutation.isPending, signatureName, cancelMutation.isPending, completeMutation.isPending]);

  const listHeader = useMemo(() => (
    <>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.sectionTitle}>Contracts</Text>
          <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.filtersWrap}>
          {STATUS_FILTERS.map((status) => (
            <Button
              key={status}
              label={status[0].toUpperCase() + status.slice(1)}
              size="sm"
              variant={filter === status ? 'primary' : 'secondary'}
              onPress={() => handleFilterPress(status)}
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

      {(error || message) ? (
        <View style={styles.card}>
          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!message && <Text style={styles.success}>{message}</Text>}
        </View>
      ) : null}

      <View style={styles.listHeaderCard}>
        <Text style={styles.sectionTitle}>Contract List</Text>
      </View>
    </>
  ), [filter, handleFilterPress, signatureName, error, message]);

  const listEmpty = useMemo(() => (
    <View style={styles.listEmptyCard}>
      <Text style={styles.meta}>No contracts found for this filter.</Text>
    </View>
  ), []);

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
          <Button label="Retry" onPress={handleRetry} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={contracts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
      <CreateContractModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={refreshContracts} />
    </SafeAreaView>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  container: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, maxHeight: '85%' },
  heading: { ...typography.label, fontSize: 18, color: colors.textDark, marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginTop: spacing.sm, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, fontSize: 14, color: colors.textDark },
  templateRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  templateChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSubtle },
  templateChipActive: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  templateChipText: { fontSize: 13, color: colors.textSecondary },
  templateChipTextActive: { color: colors.primary, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});

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
  listHeaderCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  listEmptyCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    marginBottom: spacing.sm,
  },
  contractRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: colors.border,
    borderRightColor: colors.border,
    gap: spacing.sm,
  },
  contractInfo: { flex: 1 },
  contractTitle: { ...typography.body, fontWeight: '700', color: colors.textDark },
  actionsCol: { gap: spacing.xs, minWidth: 110 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { ...typography.bodySmall, color: colors.danger },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: colors.white, fontSize: 20, fontWeight: '700', lineHeight: 22 },
});
