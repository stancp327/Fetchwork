import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { jobsApi } from '../../api/endpoints/jobsApi';
import { paymentsApi } from '../../api/endpoints/paymentsApi';
import { JobsStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import Badge, { getJobStatusVariant } from '../../components/common/Badge';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { colors, spacing, typography } from '../../theme';
import { Job } from '@fetchwork/shared';

type Props = NativeStackScreenProps<JobsStackParamList, 'JobProgress'>;
type ApiError = Error & { response?: { data?: { error?: string } } };

interface Milestone {
  _id: string;
  title: string;
  amount: number;
  status: 'pending' | 'completed' | 'approved';
}

interface JobWithMilestones extends Job {
  milestones?: Milestone[];
  releasedAmount?: number;
}

export default function JobProgressScreen({ route, navigation }: Props) {
  const { jobId, jobTitle } = route.params;
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (jobTitle) navigation.setOptions({ title: jobTitle });
  }, [jobTitle, navigation]);

  const { data: job, isLoading, error, refetch } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobsApi.getById(jobId) as Promise<JobWithMilestones>,
  });

  const completeMilestoneMut = useMutation({
    mutationFn: (milestoneId: string) => jobsApi.completeMilestone(jobId, milestoneId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', jobId] });
    },
    onError: (err: Error) => {
      Alert.alert('Error', (err as ApiError).response?.data?.error || err.message);
    },
  });

  const approveMilestoneMut = useMutation({
    mutationFn: (milestoneId: string) => jobsApi.approveMilestone(jobId, milestoneId),
    onSuccess: () => {
      Alert.alert('Approved', 'Milestone approved and payment released.');
      qc.invalidateQueries({ queryKey: ['job', jobId] });
    },
    onError: (err: Error) => {
      Alert.alert('Error', (err as ApiError).response?.data?.error || err.message);
    },
  });

  const releaseMut = useMutation({
    mutationFn: () => paymentsApi.releasePayment(jobId),
    onSuccess: () => {
      Alert.alert('Payment Released', 'Final payment has been released to the freelancer.');
      qc.invalidateQueries({ queryKey: ['job', jobId] });
      qc.invalidateQueries({ queryKey: ['my-jobs'] });
    },
    onError: (err: Error) => {
      Alert.alert('Error', (err as ApiError).response?.data?.error || err.message);
    },
  });

  const handleRelease = () => {
    Alert.alert(
      'Release Final Payment',
      'Are you sure you want to release the final payment to the freelancer? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Release Payment', style: 'destructive', onPress: () => releaseMut.mutate() },
      ],
    );
  };

  const isClient = user?.role === 'client';
  const isFreelancer = user?.role === 'freelancer';

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ? 'Failed to load job' : 'Job not found'}</Text>
          <Button label="Retry" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const milestones = job.milestones ?? [];
  const totalBudget = job.budget?.amount ?? 0;
  const released = job.releasedAmount ?? milestones
    .filter(m => m.status === 'approved')
    .reduce((sum, m) => sum + m.amount, 0);
  const remaining = totalBudget - released;
  const allApproved = milestones.length > 0 && milestones.every(m => m.status === 'approved');
  const isJobComplete = job.status === 'completed';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Job Header */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>{job.title}</Text>
          <Badge label={job.status.replace(/_/g, ' ')} variant={getJobStatusVariant(job.status)} />
        </View>

        {/* Budget Summary */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Budget Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>${totalBudget}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Released</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>${released}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Remaining</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>${remaining}</Text>
            </View>
          </View>
        </Card>

        {/* Milestones */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Milestones</Text>
          {milestones.length > 0 ? milestones.map((ms, i) => (
            <View key={ms._id} style={[styles.milestoneRow, i < milestones.length - 1 && styles.milestoneBorder]}>
              <View style={styles.milestoneHeader}>
                <View style={styles.milestoneInfo}>
                  <Text style={styles.milestoneTitle}>{ms.title}</Text>
                  <Text style={styles.milestoneAmount}>${ms.amount}</Text>
                </View>
                <MilestoneStatusBadge status={ms.status} />
              </View>

              {isFreelancer && ms.status === 'pending' && (
                <Button
                  label="Mark Complete"
                  onPress={() => completeMilestoneMut.mutate(ms._id)}
                  loading={completeMilestoneMut.isPending && completeMilestoneMut.variables === ms._id}
                  disabled={completeMilestoneMut.isPending}
                  variant="primary"
                  size="sm"
                  fullWidth
                  style={styles.milestoneBtn}
                />
              )}

              {isClient && ms.status === 'completed' && (
                <Button
                  label="Approve Milestone"
                  onPress={() => approveMilestoneMut.mutate(ms._id)}
                  loading={approveMilestoneMut.isPending && approveMilestoneMut.variables === ms._id}
                  disabled={approveMilestoneMut.isPending}
                  variant="success"
                  size="sm"
                  fullWidth
                  style={styles.milestoneBtn}
                />
              )}
            </View>
          )) : (
            <Text style={styles.noMilestones}>No milestones defined for this job.</Text>
          )}
        </Card>

        {/* Release Final Payment */}
        {isClient && (isJobComplete || allApproved) && (
          <Button
            label="Release Final Payment"
            onPress={handleRelease}
            loading={releaseMut.isPending}
            variant="success"
            fullWidth
            size="lg"
            style={styles.releaseBtn}
          />
        )}

        {/* Leave a Review */}
        {isJobComplete && (
          <Button
            label="Leave a Review"
            onPress={() =>
              navigation.getParent()?.getParent()?.navigate('Profile', {
                screen: 'WriteReview',
                params: {
                  jobId,
                  targetName: job.title,
                  targetId: isClient
                    ? (job.freelancer as unknown as { _id: string })?._id ?? ''
                    : (job.client as unknown as { _id: string })?._id ?? '',
                },
              })
            }
            variant="secondary"
            fullWidth
            size="lg"
            leftIcon="star-outline"
            style={styles.releaseBtn}
          />
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MilestoneStatusBadge({ status }: { status: string }) {
  const variant = status === 'approved' ? 'success' : status === 'completed' ? 'warning' : 'neutral';
  return <Badge label={status} variant={variant} />;
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.bgSubtle },
  scroll:          { padding: spacing.md },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:       { ...typography.bodySmall, color: colors.danger },
  headerRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  title:           { ...typography.h2, flex: 1, marginRight: spacing.sm },
  section:         { marginBottom: spacing.sm },
  sectionLabel:    { ...typography.label, color: colors.textSecondary, marginBottom: 6 },
  summaryRow:      { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem:     { alignItems: 'center', flex: 1 },
  summaryLabel:    { ...typography.caption, marginBottom: 4 },
  summaryValue:    { ...typography.h3 },
  milestoneRow:    { paddingVertical: spacing.sm },
  milestoneBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  milestoneInfo:   { flex: 1, marginRight: spacing.sm },
  milestoneTitle:  { ...typography.body, fontWeight: '600' },
  milestoneAmount: { ...typography.bodySmall, color: colors.primary, marginTop: 2 },
  milestoneBtn:    { marginTop: spacing.xs },
  noMilestones:    { ...typography.bodySmall, color: colors.textMuted },
  releaseBtn:      { marginTop: spacing.md },
});
