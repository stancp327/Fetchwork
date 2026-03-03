import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  Pressable, RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/endpoints/authApi';
import { ProfileStackParamList } from '../../types/navigation';
import Avatar from '../../components/common/Avatar';
import { TrustBadgeRow } from '../../components/common/TrustBadge';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';
import { BadgeType } from '@fetchwork/shared';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MyProfile'>;

function StatBox({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function MyProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();

  const { data: me, isRefetching, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.getMe(),
    select: d => d.user ?? d,
  });

  const profile = me ?? user;

  const earnedBadges: BadgeType[] = [];
  if (profile?.isEmailVerified || profile?.isVerified) earnedBadges.push('email_verified');
  if (profile?.verificationLevel === 'identity' || profile?.verificationLevel === 'full') earnedBadges.push('id_verified');
  if ((profile?.rating ?? 0) >= 4.5 && (profile?.totalReviews ?? 0) >= 5) earnedBadges.push('top_rated');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {/* Header card */}
        <View style={styles.headerCard}>
          <Avatar
            uri={profile?.profilePicture}
            name={`${profile?.firstName} ${profile?.lastName}`}
            size="xl"
          />
          <Text style={styles.name}>{profile?.firstName} {profile?.lastName}</Text>
          {profile?.headline && <Text style={styles.headline}>{profile.headline}</Text>}
          <Text style={styles.role}>{profile?.role === 'freelancer' ? '💼 Freelancer' : '🏢 Client'}</Text>

          {earnedBadges.length > 0 && (
            <View style={{ marginTop: spacing.sm }}>
              <TrustBadgeRow badges={earnedBadges} />
            </View>
          )}

          <View style={styles.actions}>
            <Button label="Edit Profile" onPress={() => navigation.navigate('EditProfile')}
              variant="secondary" size="sm" style={{ flex: 1 }} />
            <Button label="Verification" onPress={() => navigation.navigate('Verification')}
              variant="secondary" size="sm" style={{ flex: 1 }} />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {(profile?.rating ?? 0) > 0 && <StatBox value={`⭐ ${profile!.rating!.toFixed(1)}`} label="Rating" />}
          <StatBox value={profile?.totalReviews ?? 0} label="Reviews" />
          <StatBox value={profile?.completedJobs ?? 0} label="Completed" />
          {profile?.role === 'freelancer' && profile?.hourlyRate && (
            <StatBox value={`$${profile.hourlyRate}/hr`} label="Rate" />
          )}
        </View>

        {/* Bio */}
        {profile?.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{profile.bio}</Text>
          </View>
        )}

        {/* Skills */}
        {profile?.skills?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skills}>
              {profile.skills.map((s: string) => (
                <View key={s} style={styles.skillTag}><Text style={styles.skillText}>{s}</Text></View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Settings links */}
        <View style={styles.section}>
          {[
            { label: '🔔 Notifications',            onPress: () => navigation.navigate('Notifications') },
            { label: '🔍 Discovery Settings',      onPress: () => navigation.navigate('DiscoverySettings') },
            { label: '📦 Subscriptions & Bundles', onPress: () => (navigation as any).navigate('Services', { screen: 'MyBundles' }) },
            { label: '👥 Teams',                   onPress: () => navigation.navigate('Teams') },
            { label: '💼 Wallet',                  onPress: () => navigation.navigate('Wallet') },
            { label: '🔒 Verification & Badges',  onPress: () => navigation.navigate('Verification') },
            { label: '⚙️ Account Settings',        onPress: () => navigation.navigate('Settings') },
          ].map(item => (
            <Pressable key={item.label} style={styles.menuRow} onPress={item.onPress}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={{ color: colors.textMuted }}>›</Text>
            </Pressable>
          ))}
        </View>

        {/* Logout */}
        <Button label="Log Out" onPress={logout} variant="danger" fullWidth style={{ marginTop: spacing.sm }} />
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bgSubtle },
  scroll:      { padding: spacing.md },
  headerCard:  {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.xl, alignItems: 'center',
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  name:        { ...typography.h2, marginTop: spacing.sm, textAlign: 'center' },
  headline:    { ...typography.bodySmall, textAlign: 'center', marginTop: 4 },
  role:        { ...typography.caption, marginTop: 4, color: colors.textSecondary },
  actions:     { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, width: '100%' },
  statsRow:    {
    flexDirection: 'row', backgroundColor: colors.white,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md, overflow: 'hidden',
  },
  statBox:     { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRightWidth: 1, borderRightColor: colors.border },
  statValue:   { ...typography.h4, color: colors.textDark },
  statLabel:   { ...typography.caption, marginTop: 2 },
  section:     {
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm,
  },
  sectionTitle:{ ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  bio:         { ...typography.body, lineHeight: 22 },
  skills:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillTag:    { backgroundColor: colors.bgMuted, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  skillText:   { fontSize: 12, color: colors.textSecondary },
  menuRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuLabel:   { ...typography.body },
});
