import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, Pressable, Share, Platform,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { freelancersApi, FreelancerProfile, FreelancerReview } from '../../api/endpoints/freelancersApi';
import { messagesApi } from '../../api/endpoints/messagesApi';
import { JobsStackParamList } from '../../types/navigation';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import Badge from '../../components/common/Badge';
import { TrustBadgeRow } from '../../components/common/TrustBadge';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';
import { BadgeType } from '@fetchwork/shared';

type Props = NativeStackScreenProps<JobsStackParamList, 'FreelancerProfile'>;

export default function FreelancerPublicProfileScreen({ route, navigation }: Props) {
  const { id, username } = route.params;

  // Fetch profile
  const { data: profile, isLoading, isError } = useQuery<FreelancerProfile>({
    queryKey: ['freelancer-profile', id || username],
    queryFn: () => username
      ? freelancersApi.getByUsername(username)
      : freelancersApi.getById(id!),
  });

  // Fetch reviews
  const { data: reviewsData } = useQuery({
    queryKey: ['freelancer-reviews', profile?._id],
    queryFn: () => freelancersApi.getReviews(profile!._id, 5),
    enabled: !!profile?._id,
  });

  // Message mutation
  const messageMutation = useMutation({
    mutationFn: () => messagesApi.findOrCreate(profile!._id),
    onSuccess: ({ conversationId }) => {
      navigation.getParent()?.navigate('Messages', {
        screen: 'MessageThread',
        params: {
          conversationId,
          recipientName: `${profile!.firstName} ${profile!.lastName}`,
        },
      });
    },
  });

  const handleShare = async () => {
    if (!profile) return;
    const url = `https://fetchwork.net/freelancers/${profile.username || profile._id}`;
    await Share.share({
      message: Platform.OS === 'android'
        ? `Check out ${profile.firstName} on Fetchwork: ${url}`
        : `Check out ${profile.firstName} on Fetchwork`,
      url,
    });
  };

  const handleHire = () => {
    if (!profile) return;
    navigation.navigate('PostJob');
  };

  // Share button in header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={handleShare} hitSlop={8}>
          <Ionicons name="share-outline" size={22} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, profile]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (isError || !profile) {
    return <EmptyState emoji="⚠️" title="Profile not found" subtitle="This freelancer may no longer be available" />;
  }

  const fullName = `${profile.firstName} ${profile.lastName}`;
  const locationStr = [profile.location?.city, profile.location?.country].filter(Boolean).join(', ');
  const reviews: FreelancerReview[] = reviewsData?.reviews ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero section */}
        <View style={styles.hero}>
          <Avatar uri={profile.profilePicture} name={fullName} size="xl" online={profile.isOnline} />
          <Text style={styles.heroName}>{fullName}</Text>
          {!!profile.headline && <Text style={styles.heroHeadline}>{profile.headline}</Text>}
          {!!locationStr && (
            <Text style={styles.heroLocation}>📍 {locationStr}</Text>
          )}
          <View style={styles.heroStats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>⭐ {profile.rating?.toFixed(1) || '0.0'}</Text>
              <Text style={styles.statLabel}>{profile.totalReviews || 0} reviews</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile.completedJobs || 0}</Text>
              <Text style={styles.statLabel}>Jobs done</Text>
            </View>
            {!!profile.hourlyRate && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>${profile.hourlyRate}</Text>
                  <Text style={styles.statLabel}>per hour</Text>
                </View>
              </>
            )}
          </View>
          {!!profile.badges?.length && (
            <View style={styles.badgeRow}>
              <TrustBadgeRow badges={profile.badges as BadgeType[]} />
            </View>
          )}
        </View>

        {/* Skills */}
        {!!profile.skills?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsWrap}>
              {profile.skills.map(s => (
                <View key={s} style={styles.skillTag}>
                  <Text style={styles.skillText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* About */}
        {!!profile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{profile.bio}</Text>
          </View>
        )}

        {/* Services */}
        {!!profile.services?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.servicesRow}>
              {profile.services.map(svc => (
                <Card
                  key={svc._id}
                  onPress={() => navigation.getParent()?.navigate('Services', {
                    screen: 'ServiceDetail',
                    params: { id: svc._id },
                  })}
                  style={styles.serviceCard}
                >
                  <Text style={styles.serviceTitle} numberOfLines={2}>{svc.title}</Text>
                  {!!svc.pricing?.basic?.price && (
                    <Text style={styles.servicePrice}>
                      From ${svc.pricing.basic.price}
                      {svc.serviceType === 'recurring' ? '/mo' : ''}
                    </Text>
                  )}
                </Card>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Portfolio */}
        {!!profile.portfolio?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Portfolio</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.servicesRow}>
              {profile.portfolio.map(item => (
                <Card key={item._id} style={styles.portfolioCard}>
                  <Text style={styles.portfolioTitle} numberOfLines={2}>{item.title}</Text>
                  {!!item.description && (
                    <Text style={styles.portfolioDesc} numberOfLines={3}>{item.description}</Text>
                  )}
                </Card>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Reviews {reviewsData?.total ? `(${reviewsData.total})` : ''}
          </Text>
          {reviews.length === 0 ? (
            <Text style={styles.noReviews}>No reviews yet</Text>
          ) : (
            reviews.map(review => (
              <Card key={review._id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Avatar
                    uri={review.client.profilePicture}
                    name={`${review.client.firstName} ${review.client.lastName}`}
                    size="sm"
                  />
                  <View style={styles.reviewMeta}>
                    <Text style={styles.reviewAuthor}>
                      {review.client.firstName} {review.client.lastName}
                    </Text>
                    <Text style={styles.reviewDate}>
                      {new Date(review.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Badge label={`⭐ ${review.rating}`} variant="primary" />
                </View>
                {!!review.comment && (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                )}
              </Card>
            ))
          )}
        </View>

        {/* Bottom spacer for sticky bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={styles.bottomBar}>
        <Button
          label="Message"
          onPress={() => messageMutation.mutate()}
          loading={messageMutation.isPending}
          variant="secondary"
          size="lg"
          leftIcon="chatbubble-outline"
          style={styles.bottomBtnLeft}
        />
        <Button
          label="Hire"
          onPress={handleHire}
          size="lg"
          leftIcon="briefcase-outline"
          style={styles.bottomBtnRight}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bgSubtle },
  scroll:      { padding: spacing.md },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero
  hero: {
    alignItems: 'center', backgroundColor: colors.white,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  heroName:     { ...typography.h2, marginTop: spacing.sm },
  heroHeadline: { ...typography.bodySmall, textAlign: 'center', marginTop: 2 },
  heroLocation: { ...typography.caption, marginTop: 4 },
  heroStats: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.md, gap: spacing.md,
  },
  stat:         { alignItems: 'center' },
  statValue:    { fontSize: 16, fontWeight: '700', color: colors.textDark },
  statLabel:    { ...typography.caption, marginTop: 2 },
  statDivider:  { width: 1, height: 28, backgroundColor: colors.border },
  badgeRow:     { marginTop: spacing.sm },

  // Section
  section:      { marginBottom: spacing.md },
  sectionTitle: { ...typography.h4, marginBottom: spacing.sm },

  // Skills
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillTag:   { backgroundColor: colors.bgMuted, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  skillText:  { fontSize: 13, color: colors.textSecondary },

  // Bio
  bio: { ...typography.body, lineHeight: 22 },

  // Services
  servicesRow:   { gap: spacing.sm },
  serviceCard:   { width: 180 },
  serviceTitle:  { ...typography.label, marginBottom: 4 },
  servicePrice:  { ...typography.body, color: colors.primary, fontWeight: '700' },

  // Portfolio
  portfolioCard:  { width: 200 },
  portfolioTitle: { ...typography.label, marginBottom: 4 },
  portfolioDesc:  { ...typography.caption, lineHeight: 16 },

  // Reviews
  noReviews:     { ...typography.bodySmall, color: colors.textMuted },
  reviewCard:    { marginBottom: spacing.sm },
  reviewHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  reviewMeta:    { flex: 1, marginLeft: spacing.sm },
  reviewAuthor:  { ...typography.label },
  reviewDate:    { ...typography.caption },
  reviewComment: { ...typography.body, lineHeight: 20 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', padding: spacing.md, gap: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.md,
  },
  bottomBtnLeft:  { flex: 1 },
  bottomBtnRight: { flex: 1 },
});
