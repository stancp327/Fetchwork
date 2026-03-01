import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { jobsApi } from '../api/endpoints/jobsApi';
import { servicesApi } from '../api/endpoints/servicesApi';
import Card from '../components/common/Card';
import Badge, { getJobStatusVariant } from '../components/common/Badge';
import { colors, spacing, typography } from '../theme';
import { Job, Service } from '@fetchwork/shared';

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const { data: jobsData } = useQuery({
    queryKey: ['jobs', 'recent'],
    queryFn: () => jobsApi.browse({ limit: 5 }),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'recent'],
    queryFn: () => servicesApi.browse({ limit: 4 }),
  });

  const recentJobs: Job[] = jobsData?.jobs || [];
  const recentServices: Service[] = servicesData?.services || [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Hey {user?.firstName || 'there'} 👋
            </Text>
            <Text style={styles.greetingSub}>What are you looking for today?</Text>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          <Pressable style={styles.quickBtn} onPress={() => navigation.navigate('Jobs', { screen: 'BrowseJobs' })}>
            <Text style={styles.quickIcon}>🔍</Text>
            <Text style={styles.quickLabel}>Find Jobs</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => navigation.navigate('Jobs', { screen: 'PostJob' })}>
            <Text style={styles.quickIcon}>➕</Text>
            <Text style={styles.quickLabel}>Post Job</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => navigation.navigate('Services', { screen: 'BrowseServices' })}>
            <Text style={styles.quickIcon}>⚡</Text>
            <Text style={styles.quickLabel}>Services</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => navigation.navigate('Messages', { screen: 'ConversationList' })}>
            <Text style={styles.quickIcon}>💬</Text>
            <Text style={styles.quickLabel}>Messages</Text>
          </Pressable>
        </View>

        {/* Recent Jobs */}
        <SectionHeader title="Recent Jobs" onSeeAll={() => navigation.navigate('Jobs', { screen: 'BrowseJobs' })} />
        {recentJobs.map(job => (
          <Card
            key={job._id}
            onPress={() => navigation.navigate('Jobs', { screen: 'JobDetail', params: { id: job._id } })}
            style={styles.jobCard}
          >
            <View style={styles.jobHeader}>
              <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
              <Badge label={job.status} variant={getJobStatusVariant(job.status)} />
            </View>
            <Text style={styles.jobMeta}>
              {job.client?.firstName} {job.client?.lastName} · ${job.budget?.amount}{job.budget?.type === 'hourly' ? '/hr' : ''}
            </Text>
            <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>
          </Card>
        ))}

        {/* Recent Services */}
        <SectionHeader title="Featured Services" onSeeAll={() => navigation.navigate('Services', { screen: 'BrowseServices' })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.servicesRow}>
          {recentServices.map(svc => (
            <Card
              key={svc._id}
              onPress={() => navigation.navigate('Services', { screen: 'ServiceDetail', params: { id: svc._id } })}
              style={styles.serviceCard}
            >
              {svc.serviceType === 'recurring' && (
                <View style={styles.recurringBadge}><Text style={styles.recurringText}>🔄 Recurring</Text></View>
              )}
              <Text style={styles.serviceTitle} numberOfLines={2}>{svc.title}</Text>
              <Text style={styles.serviceProvider} numberOfLines={1}>
                {svc.freelancer?.firstName} {svc.freelancer?.lastName}
              </Text>
              <Text style={styles.servicePrice}>
                ${svc.pricing?.basic?.price}
                {svc.serviceType === 'recurring' ? ` / ${svc.recurring?.billingCycle === 'per_session' ? 'session' : svc.recurring?.billingCycle === 'weekly' ? 'wk' : 'mo'}` : ''}
              </Text>
            </Card>
          ))}
        </ScrollView>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onSeeAll}><Text style={styles.seeAll}>See all</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.bgSubtle },
  scroll:         { padding: spacing.md },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greeting:       { ...typography.h2 },
  greetingSub:    { ...typography.bodySmall, marginTop: 2 },
  quickActions:   { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  quickBtn:       {
    flex: 1, backgroundColor: colors.white, borderRadius: 12,
    paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  quickIcon:      { fontSize: 22, marginBottom: 4 },
  quickLabel:     { fontSize: 11, fontWeight: '600', color: colors.text },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, marginTop: spacing.md },
  sectionTitle:   { ...typography.h4 },
  seeAll:         { fontSize: 13, color: colors.primary, fontWeight: '500' },
  jobCard:        { marginBottom: spacing.sm },
  jobHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  jobTitle:       { ...typography.h4, flex: 1, marginRight: spacing.sm },
  jobMeta:        { ...typography.caption, marginBottom: 4 },
  jobDesc:        { ...typography.bodySmall },
  servicesRow:    { gap: spacing.sm, paddingBottom: spacing.sm },
  serviceCard:    { width: 180, marginRight: 0 },
  recurringBadge: { backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 6 },
  recurringText:  { fontSize: 10, color: '#166534', fontWeight: '600' },
  serviceTitle:   { ...typography.label, marginBottom: 4 },
  serviceProvider:{ ...typography.caption, marginBottom: 4 },
  servicePrice:   { ...typography.body, color: colors.primary, fontWeight: '700' },
});
