import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { paymentsApi } from '../../api/endpoints/paymentsApi';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';
import { ProfileStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EscrowConfirm'>;

export default function EscrowConfirmScreen({ route, navigation }: Props) {
  const { jobId, amount, freelancerName, title } = route.params;
  const [success, setSuccess] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const releaseMutation = useMutation({
    mutationFn: () => {
      if (!jobId) throw new Error('Missing job ID');
      return paymentsApi.releasePayment(jobId);
    },
    onSuccess: () => setSuccess(true),
    onError: () => {},
  });

  useEffect(() => {
    if (success) {
      timerRef.current = setTimeout(() => navigation.goBack(), 2000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [success, navigation]);

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          <Text style={styles.successTitle}>Payment Released!</Text>
          <Text style={styles.successSub}>
            ${Number(amount).toFixed(2)} sent to {freelancerName}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.heading}>Confirm Payment Release</Text>

        <Card style={styles.card}>
          <DetailRow label="Service / Job" value={title} />
          <DetailRow label="Recipient" value={freelancerName} />
          <DetailRow label="Amount" value={`$${Number(amount).toFixed(2)}`} highlight />
        </Card>

        {releaseMutation.isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {(releaseMutation.error as Error)?.message || 'Release failed. Please try again.'}
            </Text>
          </View>
        )}

        <Button
          label={releaseMutation.isPending ? 'Releasing…' : 'Confirm and Release'}
          onPress={() => releaseMutation.mutate()}
          loading={releaseMutation.isPending}
          disabled={releaseMutation.isPending}
          fullWidth
          size="lg"
        />

        {releaseMutation.isError && (
          <Button
            label="Retry"
            onPress={() => releaseMutation.mutate()}
            variant="secondary"
            fullWidth
            size="lg"
            style={{ marginTop: spacing.sm }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={drStyles.row}>
      <Text style={drStyles.label}>{label}</Text>
      <Text style={[drStyles.value, highlight && drStyles.highlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgSubtle },
  content: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  heading: { ...typography.h2, textAlign: 'center', marginBottom: spacing.lg },
  card:    { marginBottom: spacing.lg },

  errorBox:  { backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { ...typography.bodySmall, color: colors.danger, textAlign: 'center' },

  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  successTitle:     { ...typography.h2, color: colors.success, marginTop: spacing.md },
  successSub:       { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
});

const drStyles = StyleSheet.create({
  row:       { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.bgMuted },
  label:     { ...typography.label, color: colors.textMuted, flex: 1 },
  value:     { ...typography.body, flex: 2, textAlign: 'right' },
  highlight: { color: colors.primary, fontWeight: '700', fontSize: 17 },
});
