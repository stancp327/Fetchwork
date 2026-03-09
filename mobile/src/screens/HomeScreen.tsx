import React, { useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  Pressable, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { jobsApi } from '../api/endpoints/jobsApi';
import { servicesApi } from '../api/endpoints/servicesApi';
import { usersApi } from '../api/endpoints/usersApi';
import Card from '../components/common/Card';
import Badge, { getJobStatusVariant } from '../components/common/Badge';
import { colors, radius, spacing, typography } from '../theme';
import { Job, Service } from '@fetchwork/shared';
import { useAuthStore } from '../store/authStore';
import { storage } from '../utils/storage';

interface Notification {
  _id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { activeMode, setActiveMode } = useAuthStore();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- navigation typing across nested stacks
  const navigation = useNavigation<any>();

  const jobsQuery = useQuery({
    queryKey: ['jobs', 'recent'],
    queryFn: () => jobsApi.browse({ limit: 5 }),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const myJobsQuery = useQuery({
    queryKey: ['my-jobs-summary'],
    queryFn: () => jobsApi.myJobs(),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const servicesQuery = useQuery({
    queryKey: ['services', 'recent'],
    queryFn: () => servicesApi.browse({ limit: 4 }),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'preview'],
    queryFn: () => usersApi.getNotifications({ page: 1 }),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const recentJobs: Job[] = useMemo(() => jobsQuery.data?.jobs || [], [jobsQuery.data]);
  const myActiveJobs: Job[] = useMemo(
    () => (Array.isArray(myJobsQuery.data) ? myJobsQuery.data : []).filter(
      (j: Job) => ['in_progress', 'awaiting_start', 'open'].includes(j.status),
    ),
    [myJobsQuery.data],
  );
  const recentServices: Service[] = useMemo(() => servicesQuery.data?.services || [], [servicesQuery.data]);
  const notifications: Notification[] = useMemo(
    () => (notificationsQuery.data?.notifications || []).slice(0, 3),
    [notificationsQuery.data],
  );
  const unreadCount: number = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const isRefreshing = jobsQuery.isRefetching || servicesQuery.isRefetching
    || myJobsQuery.isRefetching || notificationsQuery.isRefetching;

  const onRefresh = useCallback(() => {
    jobsQuery.refetch();
    servicesQuery.refetch();
    myJobsQuery.refetch();
    notificationsQuery.refetch();
  }, [jobsQuery, servicesQuery, myJobsQuery, notificationsQuery]);

  const setMode = useCallback(async (mode: 'client' | 'freelancer') => {
    setActiveMode(mode);
    await storage.setActiveMode(mode);
  }, [setActiveMode]);

  const handleFindJobs = useCallback(
    () => navigation.navigate('Jobs', { screen: 'BrowseJobs' }),
    [navigation],
  );
  const handlePostJob = useCallback(
    () => navigation.navigate('Jobs', { screen: 'PostJob' }),
    [navigation],
  );
  const handleMyJobs = useCallback(
    () => navigation.navigate('Jobs', { screen: 'MyJobs' }),
    [navigation],
  );
  const handleFreelancers = useCallback(
    () => navigation.navigate('Jobs', { screen: 'BrowseFreelancers' }),
    [navigation],
  );
  const handleBrowseServices = useCallback(
    () => navigation.navigate('Services', { screen: 'BrowseServices' }),
    [navigation],
  );
  const handleEarnings = useCallback(
    () => navigation.navigate('Profile', { screen: 'Earnings' }),
    [navigation],
  );
  const handleBookings = useCallback(
    () => navigation.navigate('Profile', { screen: 'Bookings' }),
    [navigation],
  );

  const isLoading = jobsQuery.isLoading && servicesQuery.isLoading;

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
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.greeting}>Hey {user?.firstName || 'there'} 👋</Text>
            <Text style={styles.greetingSub}>What are you looking for today?</Text>

            {/* Mode toggle */}
            <View style={styles.modeToggleWrap}>
              <Pressable
                style={[styles.modePill, activeMode === 'client' && styles.modePillActive]}
                onPress={() => setMode('client')}
              >
                <Text style={[styles.modePillText, activeMode === 'client' && styles.modePillTextActive]}>Client</Text>
              </Pressable>
              <Pressable
                style={[styles.modePill, activeMode === 'freelancer' && styles.modePillActive]}
                onPress={() => setMode('freelancer')}
              >
                <Text style={[styles.modePillText, activeMode === 'freelancer' && styles.modePillTextActive]}>Freelancer</Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            style={styles.notifBtn}
            onPress={() => navigation.navigate('Profile', { screen: 'Notifications' })}
          >
            <Text style={styles.notifIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          {activeMode === 'client' ? (
            <>
              <Pressable style={styles.quickBtn} onPress={handlePostJob}>
                <Text style={styles.quickIcon}>➕</Text>
                <Text style={styles.quickLabel}>Post Job</Text>
              </Pressable>
              <Pressable style={styles.quickBtn} onPress={handleMyJobs}>
                <Text style={styles.quickIcon}>📋</Text>
                <Text style={styles.quickLabel}>My Jobs</Text>
              </Pressable>
              <Pressable style={styles.quickBtn} onPress={handleFreelancers}>
                <Text style={styles.quickIcon}>👤</Text>
                <Text style={styles.quickLabel}>Freelancers</Text>
              </Pressable>
              <Pressable style={styles.quickBtn} onPress={handleBrowseServices}>
                <Text style={styles.quickIcon}>⚡</Text>
                <Text style={styles.quickLabel}>Services</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={styles.quickBtn} onPress={handleFindJobs}>
                <Text style={styles.quickIcon}>🔍</Text>
                <Text style={styles.quickLabel}>Find Jobs</Text>
              </Pressable>
              <Pressable style={styles.quickBtn} onPress={handleEarnings}>
                <Text style={styles.quickIcon}>💰</Text>
                <Text style={styles.quickLabel}>Earnings</Text>
              </Pressable>
              <Pressable style={styles.quickBtn} onPress={handleBookings}>
                <Text style={styles.quickIcon}>📆</Text>
                <Text style={styles.quickLabel}>Bookings</Text>
              </Pressable>
              <Pressable style={styles.quickBtn} onPress={handleBrowseServices}>
                <Text style={styles.quickIcon}>⚡</Text>
                <Text style={styles.quickLabel}>Services</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Active Jobs Summary */}
        {myActiveJobs.length > 0 && (
          <>
            <SectionHeader title="Your Active Jobs" onSeeAll={() => navigation.navigate('Jobs', { screen: 'MyJobs' })} />
            {myActiveJobs.slice(0, 3).map(job => (
              <Card
                key={job._id}
                onPress={() => navigation.navigate('Jobs', { screen: 'JobProgress', params: { jobId: job._id, jobTitle: job.title } })}
                style={styles.jobCard}
              >
                <View style={styles.jobHeader}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                  <Badge label={job.status.replace(/_/g, ' ')} variant={getJobStatusVariant(job.status)} />
                </View>
                <Text style={styles.jobMeta}>
                  ${job.budget?.amount}{job.budget?.type === 'hourly' ? '/hr' : ' fixed'}
                </Text>
              </Card>
            ))}
          </>
        )}

        {/* Notifications Preview */}
        {notifications.length > 0 && (
          <>
            <SectionHeader
              title="Notifications"
              onSeeAll={() => navigation.navigate('Profile', { screen: 'Notifications' })}
            />
            <Card style={styles.notifCard}>
              {notifications.map((notif, i) => (
                <View
                  key={notif._id}
                  style={[styles.notifRow, i < notifications.length - 1 && styles.notifBorder]}
                >
                  {!notif.read && <View style={styles.unreadDot} />}
                  <View style={styles.notifTextWrap}>
                    <Text style={styles.notifTitle} numberOfLines={1}>{notif.title}</Text>
                    <Text style={styles.notifMessage} numberOfLines={1}>{notif.message}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Recent Jobs */}
        <SectionHeader title="Recent Jobs" onSeeAll={() => navigation.navigate('Jobs', { screen: 'BrowseJobs' })} />
        {recentJobs.length === 0 && !jobsQuery.isLoading && (
          <Text style={styles.emptyText}>No jobs posted yet.</Text>
        )}
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
        {recentServices.length === 0 && !servicesQuery.isLoading && (
          <Text style={styles.emptyText}>No services available yet.</Text>
        )}
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

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const SectionHeader = React.memo(function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onSeeAll}><Text style={styles.seeAll}>See all</Text></Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.bgSubtle },
  scroll:         { padding: spacing.md },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greeting:       { ...typography.h2 },
  greetingSub:    { ...typography.bodySmall, marginTop: 2 },
  notifBtn:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  notifIcon:      { fontSize: 22 },
  notifBadge:     {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: colors.danger, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
  quickActions:   { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  quickBtn:       {
    flex: 1, backgroundColor: colors.white, borderRadius: radius.lg,
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
  emptyText:      { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  notifCard:      { marginBottom: spacing.sm },
  notifRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  notifBorder:    { borderBottomWidth: 1, borderBottomColor: colors.border },
  unreadDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  notifTitle:     { ...typography.label, color: colors.textDark },
  notifMessage:   { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  servicesRow:    { gap: spacing.sm, paddingBottom: spacing.sm },
  serviceCard:    { width: 180, marginRight: 0 },
  recurringBadge: { backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 6 },
  recurringText:  { fontSize: 10, color: '#166534', fontWeight: '600' },
  serviceTitle:   { ...typography.label, marginBottom: 4 },
  serviceProvider:{ ...typography.caption, marginBottom: 4 },
  servicePrice:   { ...typography.body, color: colors.primary, fontWeight: '700' },
  headerTextWrap: { flex: 1 },

  modeToggleWrap: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    padding: 2,
  },
  modePill: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePillActive: {
    backgroundColor: colors.primary,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  modePillTextActive: {
    color: colors.white,
  },

  notifTextWrap:  { flex: 1 },
  bottomSpacer:   { height: spacing.xl },
});
