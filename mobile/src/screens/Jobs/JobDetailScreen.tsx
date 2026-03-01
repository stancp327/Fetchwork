import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { jobsApi } from '../../api/endpoints/jobsApi';
import { JobsStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import Badge, { getJobStatusVariant } from '../../components/common/Badge';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import Input from '../../components/common/Input';
import { colors, spacing, typography, radius } from '../../theme';

type Props = NativeStackScreenProps<JobsStackParamList, 'JobDetail'>;

const proposalSchema = z.object({
  coverLetter: z.string().min(50, 'At least 50 characters'),
  bidAmount:   z.coerce.number().min(1, 'Enter an amount'),
});
type ProposalForm = z.infer<typeof proposalSchema>;

export default function JobDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showProposal, setShowProposal] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.getById(id),
  });

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProposalForm>({
    resolver: zodResolver(proposalSchema),
    defaultValues: { coverLetter: '', bidAmount: 0 },
  });

  const applyMutation = useMutation({
    mutationFn: (data: ProposalForm) => jobsApi.apply(id, data),
    onSuccess: () => {
      Alert.alert('Proposal Sent!', 'Your proposal has been submitted.');
      setShowProposal(false);
      reset();
      qc.invalidateQueries({ queryKey: ['job', id] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to submit proposal');
    },
  });

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!job) return <View style={styles.center}><Text>Job not found</Text></View>;

  const isClient = user?.role === 'client';
  const isOwnJob = job.client?._id === user?.id || job.client?._id === user?._id;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Title + status */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{job.title}</Text>
          <Badge label={job.status.replace(/_/g, ' ')} variant={getJobStatusVariant(job.status)} />
        </View>

        {/* Client info */}
        <Card style={styles.clientCard}>
          <View style={styles.clientRow}>
            <Avatar name={`${job.client?.firstName} ${job.client?.lastName}`} size="md" />
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={typography.label}>{job.client?.firstName} {job.client?.lastName}</Text>
              <Text style={typography.caption}>Client</Text>
            </View>
          </View>
        </Card>

        {/* Budget */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Budget</Text>
          <Text style={styles.budget}>
            ${job.budget?.amount}{job.budget?.max ? ` – $${job.budget.max}` : ''} {job.budget?.type === 'hourly' ? '/ hr' : 'fixed'}
          </Text>
        </Card>

        {/* Description */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.desc}>{job.description}</Text>
        </Card>

        {/* Skills */}
        {!!job.skills?.length && (
          <Card style={styles.section}>
            <Text style={styles.sectionLabel}>Skills Required</Text>
            <View style={styles.skills}>
              {job.skills.map(s => (
                <View key={s} style={styles.skillTag}><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
          </Card>
        )}

        {/* Proposal form */}
        {!isClient && !isOwnJob && job.status === 'open' && (
          <>
            {!showProposal ? (
              <Button label="Submit Proposal" onPress={() => setShowProposal(true)} fullWidth size="lg" style={styles.applyBtn} />
            ) : (
              <Card style={styles.section}>
                <Text style={styles.sectionLabel}>Your Proposal</Text>
                <Controller control={control} name="bidAmount"
                  render={({ field: { onChange, value } }) => (
                    <Input label="Your Rate ($)" placeholder="e.g. 150" value={String(value || '')}
                      onChangeText={onChange} keyboardType="numeric" error={errors.bidAmount?.message} />
                  )} />
                <Controller control={control} name="coverLetter"
                  render={({ field: { onChange, value } }) => (
                    <Input label="Cover Letter" placeholder="Tell the client why you're the right fit..."
                      value={value} onChangeText={onChange} multiline numberOfLines={5}
                      error={errors.coverLetter?.message} />
                  )} />
                <Button label="Send Proposal" onPress={handleSubmit(d => applyMutation.mutate(d))}
                  loading={isSubmitting || applyMutation.isPending} fullWidth />
                <Button label="Cancel" onPress={() => setShowProposal(false)} variant="ghost" fullWidth style={{ marginTop: 8 }} />
              </Card>
            )}
          </>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bgSubtle },
  scroll:      { padding: spacing.md },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titleRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  title:       { ...typography.h2, flex: 1, marginRight: spacing.sm },
  clientCard:  { marginBottom: spacing.sm },
  clientRow:   { flexDirection: 'row', alignItems: 'center' },
  section:     { marginBottom: spacing.sm },
  sectionLabel:{ ...typography.label, color: colors.textSecondary, marginBottom: 6 },
  budget:      { ...typography.h3, color: colors.primary },
  desc:        { ...typography.body, lineHeight: 22 },
  skills:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillTag:    { backgroundColor: colors.bgMuted, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  skillText:   { fontSize: 12, color: colors.textSecondary },
  applyBtn:    { marginTop: spacing.md },
});
