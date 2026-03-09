import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TextInput, ActivityIndicator, Pressable, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import api from '../../api/client';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/common/Avatar';
import { colors, spacing, typography } from '../../theme';
import { JobsStackParamList } from '../../types/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────

interface JobResult {
  _id: string;
  title: string;
  category: string;
  budget?: { amount: number; type?: string };
  location?: string;
  proposalCount?: number;
  isUrgent?: boolean;
}

interface FreelancerResult {
  _id: string;
  firstName: string;
  lastName: string;
  skills?: string[];
  hourlyRate?: number;
  rating?: number;
  reviewCount?: number;
  location?: string;
  avatar?: string;
  isOnline?: boolean;
  username?: string;
}

interface ServiceResult {
  _id: string;
  title: string;
  category?: string;
  price?: number;
  rating?: number;
  reviewCount?: number;
  freelancer?: { firstName?: string; lastName?: string };
}

type Tab = 'jobs' | 'services' | 'freelancers';
type JobsNav = NativeStackNavigationProp<JobsStackParamList>;

// ─── Component ───────────────────────────────────────────────────────────────

export default function UniversalSearchScreen() {
  const navigation = useNavigation<JobsNav>();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('jobs');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [freelancers, setFreelancers] = useState<FreelancerResult[]>([]);
  const [services, setServices] = useState<ServiceResult[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const search = useCallback(async (q: string, isRefresh = false) => {
    if (!q.trim()) {
      setJobs([]); setFreelancers([]); setServices([]);
      return;
    }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [jobsRes, freelancersRes, servicesRes] = await Promise.allSettled([
        api.get(`/api/search?q=${encodeURIComponent(q)}&limit=20`),
        api.get(`/api/freelancers?search=${encodeURIComponent(q)}&limit=20`),
        api.get(`/api/services?search=${encodeURIComponent(q)}&limit=20`),
      ]);
      if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value.data?.jobs ?? []);
      if (freelancersRes.status === 'fulfilled') setFreelancers(Array.isArray(freelancersRes.value.data) ? freelancersRes.value.data : freelancersRes.value.data?.freelancers ?? []);
      if (servicesRes.status === 'fulfilled') setServices(Array.isArray(servicesRes.value.data) ? servicesRes.value.data : servicesRes.value.data?.services ?? []);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const onRefresh = () => search(query, true);

  const tabCounts: Record<Tab, number> = {
    jobs: jobs.length,
    services: services.length,
    freelancers: freelancers.length,
  };

  // ─── Renderers ─────────────────────────────────────────────────────────────

  const renderJob = ({ item }: { item: JobResult }) => (
    <Card onPress={() => navigation.navigate('JobDetail', { id: item._id })} style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        {item.isUrgent && <Badge label="Urgent" variant="danger" />}
      </View>
      <Text style={styles.meta}>
        {item.category?.replace(/_/g, ' ')}
        {item.budget?.amount ? ` · $${item.budget.amount}${item.budget.type === 'hourly' ? '/hr' : ''}` : ''}
        {item.location ? ` · ${item.location}` : ''}
      </Text>
      {item.proposalCount != null && (
        <Text style={styles.sub}>{item.proposalCount} proposal{item.proposalCount !== 1 ? 's' : ''}</Text>
      )}
    </Card>
  );

  const renderFreelancer = ({ item }: { item: FreelancerResult }) => (
    <Card
      onPress={() => {
        // Navigate to freelancer profile — route added by freelancer-discovery branch
        (navigation as any).navigate('FreelancerProfile', { freelancerId: item._id });
      }}
      style={styles.card}
    >
      <View style={styles.row}>
        <Avatar uri={item.avatar} name={`${item.firstName} ${item.lastName}`} size="md" />
        <View style={styles.freelancerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.cardTitle}>{item.firstName} {item.lastName}</Text>
            {item.isOnline && <View style={styles.onlineDot} />}
          </View>
          {item.hourlyRate != null && (
            <Text style={styles.meta}>${item.hourlyRate}/hr</Text>
          )}
          {item.rating != null && (
            <Text style={styles.sub}>⭐ {item.rating.toFixed(1)} ({item.reviewCount ?? 0})</Text>
          )}
        </View>
      </View>
      {!!item.skills?.length && (
        <View style={styles.skills}>
          {item.skills.slice(0, 3).map(s => (
            <View key={s} style={styles.skillTag}>
              <Text style={styles.skillText}>{s}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  const renderService = ({ item }: { item: ServiceResult }) => (
    <Card onPress={() => (navigation as any).navigate('ServiceDetail', { id: item._id })} style={styles.card}>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.meta}>
        {item.category?.replace(/_/g, ' ')}
        {item.price != null ? ` · From $${item.price}` : ''}
      </Text>
      {item.rating != null && (
        <Text style={styles.sub}>⭐ {item.rating.toFixed(1)} ({item.reviewCount ?? 0})</Text>
      )}
      {item.freelancer && (
        <Text style={styles.sub}>by {item.freelancer.firstName} {item.freelancer.lastName}</Text>
      )}
    </Card>
  );

  const currentData = activeTab === 'jobs' ? jobs : activeTab === 'freelancers' ? freelancers : services;
  const renderItem = activeTab === 'jobs' ? renderJob : activeTab === 'freelancers' ? renderFreelancer : renderService;

  const ListEmpty = () => {
    if (loading) return null;
    if (!query.trim()) return (
      <EmptyState emoji="🔍" title="Search Fetchwork" subtitle="Find jobs, services, or freelancers" />
    );
    return (
      <EmptyState emoji="🔍" title="No results" subtitle={`No ${activeTab} found for "${query}"`} />
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.icon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Search jobs, services, freelancers..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['jobs', 'services', 'freelancers'] as Tab[]).map(tab => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {query.trim() && tabCounts[tab] > 0 ? ` (${tabCounts[tab]})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {/* Results */}
      <FlatList
        data={currentData as any[]}
        keyExtractor={item => item._id}
        renderItem={renderItem as any}
        contentContainerStyle={styles.list}
        ListEmptyComponent={ListEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },
  icon: { marginRight: spacing.xs },
  input: { flex: 1, ...typography.body, color: colors.text, paddingVertical: 4 },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  tab: {
    flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabLabel: { ...typography.bodySmall, color: colors.textMuted, fontWeight: '500' },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },

  loadingRow: { paddingVertical: spacing.sm, alignItems: 'center' },
  list: { padding: spacing.md, flexGrow: 1 },

  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { ...typography.body, fontWeight: '600', color: colors.text, flex: 1, marginBottom: 2 },
  meta: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  sub: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },

  freelancerInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },

  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.xs },
  skillTag: {
    backgroundColor: colors.primaryLight ?? colors.border,
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  skillText: { ...typography.caption, color: colors.primary },
});
