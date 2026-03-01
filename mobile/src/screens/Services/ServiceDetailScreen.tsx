import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { servicesApi } from '../../api/endpoints/servicesApi';
import { messagesApi } from '../../api/endpoints/messagesApi';
import { ServicesStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import { colors, spacing, typography, radius } from '../../theme';

type Props = NativeStackScreenProps<ServicesStackParamList, 'ServiceDetail'>;

const PKG_LABELS: Record<string, string> = { basic: 'Basic', standard: 'Standard', premium: 'Premium' };

export default function ServiceDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const [selectedPkg, setSelectedPkg] = useState<'basic' | 'standard' | 'premium'>('basic');

  const { data: service, isLoading } = useQuery({
    queryKey: ['service', id],
    queryFn: () => servicesApi.getById(id),
  });

  const messageMutation = useMutation({
    mutationFn: () => messagesApi.findOrCreate(service!.freelancer._id),
    onSuccess: ({ conversationId }) => {
      navigation.getParent()?.navigate('Messages', {
        screen: 'MessageThread',
        params: { conversationId, recipientName: `${service!.freelancer.firstName} ${service!.freelancer.lastName}` },
      });
    },
    onError: () => Alert.alert('Error', 'Could not start conversation'),
  });

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!service) return <View style={styles.center}><Text>Service not found</Text></View>;

  const isRecurring = service.serviceType === 'recurring';
  const currentPkg = service.pricing?.[selectedPkg];
  const availablePkgs = (['basic', 'standard', 'premium'] as const).filter(p => !!service.pricing?.[p]);
  const isOwnService = service.freelancer?._id === user?.id || service.freelancer?._id === user?._id;

  const getPriceLabel = () => {
    if (!currentPkg?.price) return '—';
    if (!isRecurring) return `$${currentPkg.price}`;
    const cycle = service.recurring?.billingCycle;
    return `$${currentPkg.price} / ${cycle === 'per_session' ? 'session' : cycle === 'weekly' ? 'week' : 'month'}`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Provider */}
        <Card style={styles.providerCard}>
          <View style={styles.providerRow}>
            <Avatar name={`${service.freelancer?.firstName} ${service.freelancer?.lastName}`} size="lg" />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={typography.h4}>{service.freelancer?.firstName} {service.freelancer?.lastName}</Text>
              {(service.freelancer?.rating ?? 0) > 0 && (
                <Text style={typography.bodySmall}>⭐ {service.freelancer!.rating!.toFixed(1)}</Text>
              )}
            </View>
          </View>
          {isRecurring && (
            <View style={styles.recurringRow}>
              <Text style={styles.recurringBadge}>🔄 Recurring Sessions</Text>
              {service.recurring?.sessionDuration && (
                <Text style={styles.sessionInfo}>
                  ⏱ {service.recurring.sessionDuration < 60
                    ? `${service.recurring.sessionDuration} min`
                    : `${service.recurring.sessionDuration / 60} hr`} sessions
                </Text>
              )}
              {service.recurring?.locationType && (
                <Text style={styles.sessionInfo}>
                  {service.recurring.locationType === 'online' ? '💻 Online' : service.recurring.locationType === 'in_person' ? '📍 In-Person' : '🔀 Online & In-Person'}
                </Text>
              )}
            </View>
          )}
        </Card>

        {/* Title + desc */}
        <Text style={styles.title}>{service.title}</Text>
        <Text style={styles.desc}>{service.description}</Text>

        {/* Package selector */}
        {availablePkgs.length > 1 && (
          <View style={styles.pkgSelector}>
            {availablePkgs.map(p => (
              <Button key={p} label={PKG_LABELS[p]} onPress={() => setSelectedPkg(p)}
                variant={selectedPkg === p ? 'primary' : 'secondary'} size="sm" style={{ flex: 1 }} />
            ))}
          </View>
        )}

        {/* Package details */}
        {currentPkg && (
          <Card style={styles.pkgCard}>
            <Text style={styles.pkgTitle}>{currentPkg.title}</Text>
            <Text style={styles.pkgDesc}>{currentPkg.description}</Text>
            <View style={styles.pkgDetails}>
              <View style={styles.pkgDetail}>
                <Text style={styles.pkgDetailLabel}>Price</Text>
                <Text style={styles.pkgDetailValue}>{getPriceLabel()}</Text>
              </View>
              {isRecurring ? (
                currentPkg.sessionsIncluded ? (
                  <View style={styles.pkgDetail}>
                    <Text style={styles.pkgDetailLabel}>Sessions</Text>
                    <Text style={styles.pkgDetailValue}>{currentPkg.sessionsIncluded}</Text>
                  </View>
                ) : null
              ) : (
                <>
                  {currentPkg.deliveryTime && (
                    <View style={styles.pkgDetail}>
                      <Text style={styles.pkgDetailLabel}>Delivery</Text>
                      <Text style={styles.pkgDetailValue}>{currentPkg.deliveryTime} days</Text>
                    </View>
                  )}
                  <View style={styles.pkgDetail}>
                    <Text style={styles.pkgDetailLabel}>Revisions</Text>
                    <Text style={styles.pkgDetailValue}>{currentPkg.revisions ?? 0}</Text>
                  </View>
                </>
              )}
            </View>
            {isRecurring && service.recurring?.trialEnabled && service.recurring?.trialPrice && (
              <View style={styles.trialBanner}>
                <Text style={styles.trialText}>🎯 Trial session available for ${service.recurring.trialPrice}</Text>
              </View>
            )}
          </Card>
        )}

        {/* Actions */}
        {!isOwnService && (
          <View style={styles.actions}>
            <Button label={`Order — ${getPriceLabel()}`} onPress={() => Alert.alert('Coming soon', 'Payment flow coming soon')}
              fullWidth size="lg" />
            <Button label="Message" onPress={() => messageMutation.mutate()} loading={messageMutation.isPending}
              variant="secondary" fullWidth size="lg" style={{ marginTop: spacing.sm }} />
          </View>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.bgSubtle },
  scroll:          { padding: spacing.md },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  providerCard:    { marginBottom: spacing.md },
  providerRow:     { flexDirection: 'row', alignItems: 'center' },
  recurringRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  recurringBadge:  { fontSize: 12, fontWeight: '600', color: '#166534', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sessionInfo:     { fontSize: 12, color: colors.textSecondary, backgroundColor: colors.bgMuted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  title:           { ...typography.h2, marginBottom: spacing.sm },
  desc:            { ...typography.body, marginBottom: spacing.md, lineHeight: 22 },
  pkgSelector:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  pkgCard:         { marginBottom: spacing.md },
  pkgTitle:        { ...typography.h4, marginBottom: 4 },
  pkgDesc:         { ...typography.bodySmall, marginBottom: spacing.md },
  pkgDetails:      { flexDirection: 'row', gap: spacing.md },
  pkgDetail:       { flex: 1 },
  pkgDetailLabel:  { ...typography.caption, marginBottom: 2 },
  pkgDetailValue:  { ...typography.label, color: colors.primary },
  trialBanner:     { marginTop: spacing.sm, backgroundColor: '#f0fdf4', borderRadius: radius.md, padding: spacing.sm },
  trialText:       { fontSize: 13, color: '#166534', fontWeight: '600' },
  actions:         { marginTop: spacing.sm },
});
