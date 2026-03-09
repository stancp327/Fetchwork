import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, Alert, Pressable, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useStripe } from '@stripe/stripe-react-native';
import { jobsApi } from '../../api/endpoints/jobsApi';
import { paymentsApi } from '../../api/endpoints/paymentsApi';
import { boostsApi } from '../../api/endpoints/boostsApi';
import { aiApi, MatchResult } from '../../api/endpoints/aiApi';
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
  const [funding, setFunding] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [matches, setMatches]           = useState<MatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [featuring, setFeaturing]       = useState(false);

  const loadMatches = async () => {
    setMatchLoading(true);
    try {
      const data = await aiApi.matchFreelancers(id);
      setMatches(data);
    } catch (err: any) {
      if (err?.response?.data?.error === 'upgrade_required') {
        Alert.alert('Pro feature', 'AI freelancer matching is available on Pro and above.\n\nUpgrade at fetchwork.net/pricing');
      } else {
        Alert.alert('Error', 'Could not load matches');
      }
    } finally {
      setMatchLoading(false);
    }
  };
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const { data: job, isLoading, error, isRefetching, refetch } = useQuery({
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

  const handleFundJob = async () => {
    setFunding(true);
    try {
      const { clientSecret } = await paymentsApi.fundJob(id, {});
      const { ephemeralKey, customerId } = await paymentsApi.getEphemeralKey();
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        customerEphemeralKeySecret: ephemeralKey,
        customerId,
        merchantDisplayName: 'Fetchwork',
      });
      if (initError) { Alert.alert('Error', initError.message); return; }
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') Alert.alert('Error', presentError.message);
      } else {
        Alert.alert('Payment Successful', 'Funds are held securely until the job is completed.');
        qc.invalidateQueries({ queryKey: ['job', id] });
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Payment failed');
    } finally { setFunding(false); }
  };

  const handleBoost = async () => {
    setBoosting(true);
    try {
      const res = await boostsApi.boostJob(id, 'standard');
      if (res.boost) {
        Alert.alert('🚀 Boosted!', `Job boosted until ${new Date(res.boost.expiresAt).toLocaleDateString()}.`);
      } else if ((res as unknown as { clientSecret?: string }).clientSecret) {
        const clientSecret = (res as unknown as { clientSecret: string }).clientSecret;
        const { ephemeralKey, customerId } = await paymentsApi.getEphemeralKey();
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          customerEphemeralKeySecret: ephemeralKey,
          customerId,
          merchantDisplayName: 'Fetchwork',
        });
        if (initError) { Alert.alert('Error', initError.message); return; }
        const { error } = await presentPaymentSheet();
        if (!error) {
          Alert.alert('🚀 Boosted!', 'Your job will appear higher in search results.');
          qc.invalidateQueries({ queryKey: ['job', id] });
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Boost failed');
    } finally { setBoosting(false); }
  };

  const handleFeatureJob = async (tier: 'standard' | 'premium') => {
    setFeaturing(true);
    try {
      const res = await jobsApi.featureJob(id, tier);
      if (res.clientSecret) {
        const { ephemeralKey, customerId } = await paymentsApi.getEphemeralKey();
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: res.clientSecret,
          customerEphemeralKeySecret: ephemeralKey,
          customerId,
          merchantDisplayName: 'Fetchwork',
        });
        if (initError) { Alert.alert('Error', initError.message); return; }
        const { error } = await presentPaymentSheet();
        if (!error) {
          await jobsApi.verifyFeature(id, res.paymentIntentId);
          Alert.alert('⭐ Featured!', `Your job is now featured for ${tier === 'premium' ? '14' : '7'} days.`);
          qc.invalidateQueries({ queryKey: ['job', id] });
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Feature failed');
    } finally { setFeaturing(false); }
  };

  const showFeaturePicker = () => {
    Alert.alert(
      '⭐ Feature This Job',
      'Get 2–4× more visibility from freelancers.',
      [
        { text: 'Standard — $9.99 (7 days)', onPress: () => handleFeatureJob('standard') },
        { text: 'Premium — $19.99 (14 days) ⭐', onPress: () => handleFeatureJob('premium') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (isLoading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load data</Text>
          <Button label="Retry" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }
  if (!job) return <View style={styles.center}><Text>Job not found</Text></View>;

  const isClient = user?.role === 'client';
  const isOwnJob = job.client?._id === user?.id || job.client?._id === user?._id;
  const isBoosted = job.isBoosted && job.boostExpiresAt && new Date(job.boostExpiresAt) > new Date();
  const canFund = isOwnJob && (job.status === 'accepted' || job.status === 'pending_start');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}>
        {/* Title + status */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{job.title}</Text>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {job.isFeatured && (
              <View style={styles.featuredChip}>
                <Text style={styles.featuredChipText}>⭐ Featured</Text>
              </View>
            )}
            <Badge label={job.status.replace(/_/g, ' ')} variant={getJobStatusVariant(job.status)} />
          </View>
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

        {/* Client actions */}
        {isOwnJob && (
          <Card style={styles.section}>
            <Text style={styles.sectionLabel}>Actions</Text>
            <Button
              label="View Proposals"
              onPress={() => navigation.navigate('JobProposals', { jobId: id, jobTitle: job.title })}
              variant="secondary"
              fullWidth
              style={{ marginBottom: 8 }}
            />
            {canFund && (
              <Button label={funding ? 'Processing...' : '💳 Fund Job (Secure Payment)'}
                onPress={handleFundJob} loading={funding} fullWidth style={{ marginBottom: 8 }} />
            )}
            {job.status === 'open' && !isBoosted && (
              <Button label={boosting ? 'Processing...' : '🚀 Boost Job'}
                onPress={handleBoost} loading={boosting} variant="secondary" fullWidth style={{ marginBottom: 8 }} />
            )}
            {isBoosted && (
              <View style={styles.boostActive}>
                <Text style={styles.boostActiveText}>🚀 Boosted until {new Date(job.boostExpiresAt!).toLocaleDateString()}</Text>
              </View>
            )}
            {job.status === 'open' && !job.isFeatured && (
              <Button
                label={featuring ? 'Processing…' : '⭐ Feature This Job'}
                onPress={showFeaturePicker}
                loading={featuring}
                variant="secondary"
                fullWidth
                style={{ marginTop: 8 }}
              />
            )}
            {job.isFeatured && (
              <View style={[styles.boostActive, { borderColor: '#f59e0b', backgroundColor: '#fffbeb' }]}>
                <Text style={[styles.boostActiveText, { color: '#92400e' }]}>
                  ⭐ Featured{job.featuredExpiresAt ? ` until ${new Date(job.featuredExpiresAt).toLocaleDateString()}` : ''}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* AI Matches */}
        {isOwnJob && job.status === 'open' && (
          <Card style={styles.section}>
            <Text style={styles.sectionLabel}>🤖 Smart Matches</Text>
            {!matches && !matchLoading && (
              <Pressable style={styles.aiMatchBtn} onPress={loadMatches}>
                <Text style={styles.aiMatchBtnText}>✨ Find Top Freelancers</Text>
              </Pressable>
            )}
            {matchLoading && (
              <View style={styles.aiMatchLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.aiMatchLoadingText}>Matching freelancers…</Text>
              </View>
            )}
            {matches && (
              <>
                <Text style={styles.aiMatchMeta}>
                  {matches.aiPowered ? '✨ AI-ranked' : '📊 Score-ranked'} · {matches.total} compared
                </Text>
                {matches.matches.map((m, i) => (
                  <View key={m.userId} style={styles.aiMatchRow}>
                    <Text style={styles.aiMatchRank}>#{i + 1}</Text>
                    <View style={styles.aiMatchAvatarCircle}>
                      <Text style={styles.aiMatchAvatarText}>{m.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.aiMatchName} numberOfLines={1}>{m.name}</Text>
                      {m.rating > 0 && <Text style={styles.aiMatchRating}>⭐ {m.rating.toFixed(1)}</Text>}
                      {!!m.matchReason && <Text style={styles.aiMatchReason} numberOfLines={2}>{m.matchReason}</Text>}
                    </View>
                    <View style={styles.aiMatchScoreBadge}>
                      <Text style={styles.aiMatchScoreText}>{m.aiScore ?? m.algorithmicScore}</Text>
                    </View>
                  </View>
                ))}
                <Pressable onPress={loadMatches} style={styles.aiMatchRefresh}>
                  <Text style={styles.aiMatchRefreshText}>↻ Refresh</Text>
                </Pressable>
              </>
            )}
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
  errorText:   { ...typography.bodySmall, color: colors.danger },
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
  boostActive: { backgroundColor: colors.primary + '10', borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
  featuredChip: { backgroundColor: '#fef3c7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: '#f59e0b' },
  featuredChipText: { fontSize: 12, fontWeight: '700', color: '#92400e' },
  boostActiveText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  // AI matches
  aiMatchBtn:         { backgroundColor: colors.purple, borderRadius: 10, padding: spacing.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  aiMatchBtnText:     { color: colors.white, fontSize: 14, fontWeight: '700' },
  aiMatchLoading:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  aiMatchLoadingText: { ...typography.caption, color: colors.textMuted },
  aiMatchMeta:        { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  aiMatchRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  aiMatchRank:        { fontSize: 11, fontWeight: '700', color: colors.textMuted, minWidth: 22, paddingTop: 2 },
  aiMatchAvatarCircle:{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  aiMatchAvatarText:  { fontSize: 14, fontWeight: '700', color: colors.primary },
  aiMatchName:        { fontSize: 13, fontWeight: '700', color: colors.textDark },
  aiMatchRating:      { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  aiMatchReason:      { fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 15 },
  aiMatchScoreBadge:  { backgroundColor: colors.primaryLight, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  aiMatchScoreText:   { fontSize: 11, fontWeight: '700', color: colors.primary },
  aiMatchRefresh:     { paddingTop: spacing.sm, alignSelf: 'flex-end' },
  aiMatchRefreshText: { fontSize: 11, color: colors.textMuted },
});
