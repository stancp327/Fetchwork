import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  ActivityIndicator, Alert, Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { jobsApi } from '../../api/endpoints/jobsApi';
import { JobsStackParamList } from '../../types/navigation';
import { Proposal } from '@fetchwork/shared';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<JobsStackParamList, 'JobProposals'>;
type ApiError = Error & { response?: { data?: { error?: string } } };

export default function JobProposalsScreen({ route, navigation }: Props) {
  const { jobId, jobTitle } = route.params;
  const qc = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (jobTitle) navigation.setOptions({ title: jobTitle });
  }, [jobTitle, navigation]);

  const { data: proposals = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['proposals', jobId],
    queryFn: () => jobsApi.getProposals(jobId),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const acceptMutation = useMutation({
    mutationFn: (proposalId: string) => jobsApi.acceptProposal(jobId, proposalId),
    onSuccess: () => {
      Alert.alert('Hired!', 'The freelancer has been hired for this job.');
      qc.invalidateQueries({ queryKey: ['proposals', jobId] });
      qc.invalidateQueries({ queryKey: ['job', jobId] });
      qc.invalidateQueries({ queryKey: ['my-jobs'] });
    },
    onError: (err: Error) => {
      Alert.alert('Error', (err as ApiError).response?.data?.error || err.message);
    },
  });

  const handleAccept = (proposalId: string, freelancerName: string) => {
    Alert.alert(
      'Accept Proposal',
      `Hire ${freelancerName} for this job?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Hire', onPress: () => acceptMutation.mutate(proposalId) },
      ],
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hiredProposal = proposals.find(p => p.status === 'accepted');

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load proposals</Text>
          <Button label="Retry" onPress={() => refetch()} style={styles.retryBtn} />
        </View>
      </SafeAreaView>
    );
  }

  const renderProposal = ({ item }: { item: Proposal }) => {
    const isHired = item.status === 'accepted';
    const isDisabled = !!hiredProposal && !isHired;
    const isExpanded = expandedIds.has(item._id);
    const name = `${item.freelancer.firstName} ${item.freelancer.lastName}`;
    const isLong = item.coverLetter.length > 150;
    const isAccepting = acceptMutation.isPending && acceptMutation.variables === item._id;

    return (
      <Card style={[styles.card, isDisabled && styles.cardDisabled]}>
        <View style={styles.cardHeader}>
          <Avatar name={name} uri={item.freelancer.profilePicture} size="md" />
          <View style={styles.freelancerInfo}>
            <Text style={styles.freelancerName}>{name}</Text>
            {item.freelancer.rating != null && item.freelancer.rating > 0 && (
              <Text style={styles.rating}>⭐ {item.freelancer.rating.toFixed(1)}</Text>
            )}
          </View>
          {isHired ? (
            <Badge label="Hired" variant="success" />
          ) : (
            <Text style={styles.bidAmount}>${item.bidAmount}</Text>
          )}
        </View>

        <Pressable onPress={() => toggleExpand(item._id)} disabled={!isLong}>
          <Text style={styles.coverLetter} numberOfLines={isLong && !isExpanded ? 3 : undefined}>
            {item.coverLetter}
          </Text>
          {isLong && (
            <Text style={styles.readMore}>{isExpanded ? 'Show less' : 'Read more'}</Text>
          )}
        </Pressable>

        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>

        {!isHired && !isDisabled && (
          <Button
            label="Accept Proposal"
            onPress={() => handleAccept(item._id, name)}
            loading={isAccepting}
            disabled={acceptMutation.isPending && !isAccepting}
            variant="success"
            fullWidth
            style={styles.acceptBtn}
          />
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={proposals}
        keyExtractor={p => p._id}
        renderItem={renderProposal}
        contentContainerStyle={styles.list}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListEmptyComponent={
          <EmptyState
            emoji="📬"
            title="No proposals yet"
            subtitle="Proposals will appear here as freelancers apply"
          />
        }
        onRefresh={refetch}
        refreshing={isRefetching}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.bgSubtle },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:      { ...typography.bodySmall, color: colors.danger },
  list:           { padding: spacing.md, paddingBottom: 80 },
  card:           { marginBottom: spacing.sm },
  cardDisabled:   { opacity: 0.5 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  freelancerInfo: { flex: 1, marginLeft: spacing.sm },
  freelancerName: { ...typography.label },
  rating:         { ...typography.caption, marginTop: 2 },
  bidAmount:      { ...typography.h3, color: colors.primary },
  coverLetter:    { ...typography.bodySmall, lineHeight: 20, marginBottom: 4 },
  readMore:       { ...typography.caption, color: colors.primary, marginBottom: 4 },
  date:           { ...typography.caption, color: colors.textMuted },
  acceptBtn:      { marginTop: spacing.sm },
  retryBtn:       { marginTop: spacing.md },
});
