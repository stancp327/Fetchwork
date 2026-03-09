import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, Alert, TouchableOpacity, TextInput, RefreshControl,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStripe } from '@stripe/stripe-react-native';
import { servicesApi } from '../../api/endpoints/servicesApi';
import { paymentsApi } from '../../api/endpoints/paymentsApi';
import { messagesApi } from '../../api/endpoints/messagesApi';
import { ServicesStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import { colors, spacing, typography, radius } from '../../theme';

type Props = NativeStackScreenProps<ServicesStackParamList, 'ServiceDetail'>;

const PKG_LABELS: Record<string, string> = { basic: 'Basic', standard: 'Standard', premium: 'Premium' };

type PaymentMode = 'order' | 'subscribe' | 'bundle';

export default function ServiceDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [selectedPkg,    setSelectedPkg]    = useState<'basic' | 'standard' | 'premium'>('basic');
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [requirements,   setRequirements]   = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // ── Fetch service ───────────────────────────────────────────────
  const { data: service, isLoading, error, isRefetching, refetch } = useQuery({
    queryKey: ['service', id],
    queryFn:  () => servicesApi.getById(id),
  });

  // ── Message mutation ────────────────────────────────────────────
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

  // ── Core payment flow ───────────────────────────────────────────
  const handlePayment = async (mode: PaymentMode) => {
    if (!service) return;
    setPaymentLoading(true);
    try {
      // Step 1: create order/subscribe/bundle → get clientSecret
      let clientSecret: string;
      let successMessage: string;

      if (mode === 'order') {
        const res = await servicesApi.order(id, { package: selectedPkg, requirements: requirements.trim() || undefined });
        clientSecret   = res.clientSecret;
        successMessage = `Order placed for "${res.packageName}"!`;
      } else if (mode === 'subscribe') {
        const res = await servicesApi.subscribe(id, { tier: selectedPkg });
        clientSecret   = res.clientSecret;
        successMessage = `Subscribed! You'll be charged $${res.amountPerCycle} ${res.billingCycle}.`;
      } else {
        if (!selectedBundle) { Alert.alert('Select a bundle', 'Please tap a bundle to select it first.'); return; }
        const res = await servicesApi.purchaseBundle(id, { bundleId: selectedBundle });
        clientSecret   = res.clientSecret;
        successMessage = `Bundle purchased! ${res.sessions} sessions ready to schedule.`;
      }

      // Step 2: get ephemeral key + customerId for payment sheet
      const { ephemeralKey, customerId } = await paymentsApi.getEphemeralKey();

      // Step 3: init Stripe payment sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName:         'Fetchwork',
        customerId,
        customerEphemeralKeySecret:  ephemeralKey,
        paymentIntentClientSecret:   clientSecret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails:       { name: `${user?.firstName} ${user?.lastName}` },
      });

      if (initError) {
        Alert.alert('Payment error', initError.message);
        return;
      }

      // Step 4: present sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Payment failed', presentError.message);
        }
        return;
      }

      // Step 5: success
      Alert.alert('✅ Success', successMessage, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Payment failed. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  // ── Loading / error states ──────────────────────────────────────
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
  if (!service)  return <View style={styles.center}><Text>Service not found</Text></View>;

  const isRecurring  = service.serviceType === 'recurring';
  const currentPkg   = service.pricing?.[selectedPkg];
  const availablePkgs = (['basic', 'standard', 'premium'] as const).filter(p => !!service.pricing?.[p]);
  const isOwnService = service.freelancer?._id === user?.id || service.freelancer?._id === (user as any)?._id;
  const activeBundles = (service as any).bundles?.filter((b: any) => b.active) ?? [];

  const getPriceLabel = (pkg = currentPkg) => {
    if (!pkg?.price) return '—';
    const cycle = service.recurring?.billingCycle;
    const suffix = isRecurring
      ? ` / ${cycle === 'per_session' ? 'session' : cycle === 'weekly' ? 'wk' : 'mo'}`
      : '';
    const feeBadge = (service as any).feesIncluded ? ' (incl. fees)' : '';
    return `$${pkg.price}${suffix}${feeBadge}`;
  };

  const primaryButtonLabel = () => {
    if (paymentLoading) return 'Processing...';
    if (isRecurring)    return `Subscribe — ${getPriceLabel()}`;
    return `Order — ${getPriceLabel()}`;
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}>

        {/* Provider card */}
        <Card style={styles.providerCard}>
          <View style={styles.providerRow}>
            <Avatar name={`${service.freelancer?.firstName} ${service.freelancer?.lastName}`} size="lg" />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={typography.h4}>{service.freelancer?.firstName} {service.freelancer?.lastName}</Text>
              {(service.freelancer?.rating ?? 0) > 0 && (
                <Text style={typography.bodySmall}>⭐ {(service.freelancer as any).rating.toFixed(1)}</Text>
              )}
            </View>
          </View>
          {isRecurring && (
            <View style={styles.badgeRow}>
              <View style={styles.recurringBadge}><Text style={styles.recurringBadgeText}>🔄 Recurring</Text></View>
              {service.recurring?.sessionDuration && (
                <View style={styles.infoBadge}>
                  <Text style={styles.infoBadgeText}>
                    ⏱ {service.recurring.sessionDuration < 60
                      ? `${service.recurring.sessionDuration}min`
                      : `${service.recurring.sessionDuration / 60}hr`}
                  </Text>
                </View>
              )}
              {service.recurring?.locationType && (
                <View style={styles.infoBadge}>
                  <Text style={styles.infoBadgeText}>
                    {service.recurring.locationType === 'online' ? '💻 Online'
                      : service.recurring.locationType === 'in_person' ? '📍 In-Person'
                      : '🔀 Hybrid'}
                  </Text>
                </View>
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

            <View style={styles.pkgMeta}>
              <View style={styles.pkgMetaItem}>
                <Text style={styles.pkgMetaLabel}>Price</Text>
                <Text style={styles.pkgMetaValue}>{getPriceLabel()}</Text>
              </View>
              {isRecurring ? (
                currentPkg.sessionsIncluded ? (
                  <View style={styles.pkgMetaItem}>
                    <Text style={styles.pkgMetaLabel}>Sessions</Text>
                    <Text style={styles.pkgMetaValue}>{currentPkg.sessionsIncluded}</Text>
                  </View>
                ) : null
              ) : (
                <>
                  {currentPkg.deliveryTime && (
                    <View style={styles.pkgMetaItem}>
                      <Text style={styles.pkgMetaLabel}>Delivery</Text>
                      <Text style={styles.pkgMetaValue}>{currentPkg.deliveryTime}d</Text>
                    </View>
                  )}
                  <View style={styles.pkgMetaItem}>
                    <Text style={styles.pkgMetaLabel}>Revisions</Text>
                    <Text style={styles.pkgMetaValue}>{currentPkg.revisions ?? 0}</Text>
                  </View>
                </>
              )}
            </View>

            {isRecurring && service.recurring?.trialEnabled && service.recurring?.trialPrice && (
              <View style={styles.trialBanner}>
                <Text style={styles.trialText}>🎯 Trial session available: ${service.recurring.trialPrice}</Text>
              </View>
            )}
          </Card>
        )}

        {/* ── Bundles section ──────────────────────────────── */}
        {activeBundles.length > 0 && !isOwnService && (
          <View style={styles.bundlesSection}>
            <Text style={styles.bundlesSectionTitle}>📦 Session Bundles</Text>
            <Text style={styles.bundlesSubtitle}>Buy sessions upfront at a discount. Funds held securely and released per session.</Text>

            <View style={styles.bundlesGrid}>
              {activeBundles.map((b: any) => (
                <TouchableOpacity
                  key={b._id}
                  style={[styles.bundleCard, selectedBundle === b._id && styles.bundleCardSelected]}
                  onPress={() => setSelectedBundle(prev => prev === b._id ? null : b._id)}
                  activeOpacity={0.7}
                >
                  {b.savings > 0 && (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsBadgeText}>Save ${b.savings}</Text>
                    </View>
                  )}
                  <Text style={styles.bundleCardName}>{b.name}</Text>
                  <Text style={styles.bundleCardSessions}>{b.sessions} sessions</Text>
                  <Text style={styles.bundleCardPrice}>
                    ${b.price}{(service as any).feesIncluded ? '\n(fees incl.)' : ''}
                  </Text>
                  <Text style={styles.bundleCardPer}>${(b.price / b.sessions).toFixed(2)}/session</Text>
                  {b.expiresInDays && (
                    <Text style={styles.bundleCardExpiry}>⏱ {b.expiresInDays}d to use</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Requirements (one-time only) ─────────────────── */}
        {!isOwnService && !isRecurring && (
          <View style={styles.reqSection}>
            <Text style={styles.reqLabel}>Additional Requirements (optional)</Text>
            <TextInput
              style={styles.reqInput}
              value={requirements}
              onChangeText={setRequirements}
              placeholder="Any specific details or instructions..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* ── Action buttons ───────────────────────────────── */}
        {!isOwnService && (
          <View style={styles.actions}>
            {/* Order / Subscribe button */}
            <Button
              label={primaryButtonLabel()}
              onPress={() => handlePayment(isRecurring ? 'subscribe' : 'order')}
              disabled={paymentLoading}
              fullWidth size="lg"
            />

            {/* Buy bundle button — only when bundle is selected */}
            {selectedBundle && (
              <Button
                label={paymentLoading ? 'Processing...' : `Buy Bundle — $${activeBundles.find((b: any) => b._id === selectedBundle)?.price}`}
                onPress={() => handlePayment('bundle')}
                disabled={paymentLoading}
                fullWidth size="lg"
                style={{ marginTop: spacing.sm, backgroundColor: colors.success }}
              />
            )}

            <Button
              label="Message"
              onPress={() => messageMutation.mutate()}
              loading={messageMutation.isPending}
              variant="secondary" fullWidth size="lg"
              style={{ marginTop: spacing.sm }}
            />
          </View>
        )}

        {isOwnService && (
          <View style={styles.ownNotice}>
            <Text style={styles.ownNoticeText}>This is your service listing</Text>
          </View>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:                 { flex: 1, backgroundColor: colors.bgSubtle },
  scroll:               { padding: spacing.md },
  center:               { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:            { ...typography.bodySmall, color: colors.danger },
  providerCard:         { marginBottom: spacing.md },
  providerRow:          { flexDirection: 'row', alignItems: 'center' },
  badgeRow:             { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  recurringBadge:       { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  recurringBadgeText:   { fontSize: 12, fontWeight: '600', color: '#166534' },
  infoBadge:            { backgroundColor: colors.bgMuted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  infoBadgeText:        { fontSize: 12, color: colors.textSecondary },
  title:                { ...typography.h2, marginBottom: spacing.sm },
  desc:                 { ...typography.body, marginBottom: spacing.md, lineHeight: 22 },
  pkgSelector:          { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  pkgCard:              { marginBottom: spacing.md },
  pkgTitle:             { ...typography.h4, marginBottom: 4 },
  pkgDesc:              { ...typography.bodySmall, marginBottom: spacing.md },
  pkgMeta:              { flexDirection: 'row', gap: spacing.md },
  pkgMetaItem:          { flex: 1 },
  pkgMetaLabel:         { ...typography.caption, marginBottom: 2 },
  pkgMetaValue:         { ...typography.label, color: colors.primary },
  trialBanner:          { marginTop: spacing.sm, backgroundColor: '#f0fdf4', borderRadius: radius.md, padding: spacing.sm },
  trialText:            { fontSize: 13, color: '#166534', fontWeight: '600' },

  // Bundles
  bundlesSection:       { marginBottom: spacing.md },
  bundlesSectionTitle:  { ...typography.h4, marginBottom: 4 },
  bundlesSubtitle:      { ...typography.caption, marginBottom: spacing.md, lineHeight: 18 },
  bundlesGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  bundleCard:           {
    width: '47%', padding: spacing.md, borderWidth: 2,
    borderColor: colors.border, borderRadius: radius.lg,
    backgroundColor: colors.bgCard, alignItems: 'center',
  },
  bundleCardSelected:   { borderColor: colors.primary, backgroundColor: colors.primaryLight ?? '#eff6ff' },
  savingsBadge:         { backgroundColor: '#f59e0b', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
  savingsBadgeText:     { fontSize: 11, fontWeight: '700', color: 'white' },
  bundleCardName:       { fontWeight: '700', fontSize: 14, color: colors.textDark, textAlign: 'center', marginBottom: 2 },
  bundleCardSessions:   { fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  bundleCardPrice:      { fontSize: 18, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  bundleCardPer:        { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  bundleCardExpiry:     { fontSize: 11, color: '#f59e0b', marginTop: 4 },

  // Requirements
  reqSection:           { marginBottom: spacing.md },
  reqLabel:             { ...typography.label, marginBottom: spacing.xs },
  reqInput:             {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.sm, minHeight: 80, ...typography.body,
    backgroundColor: colors.bgCard,
  },

  // Actions
  actions:              { marginTop: spacing.sm },
  ownNotice:            { alignItems: 'center', padding: spacing.lg },
  ownNoticeText:        { ...typography.bodySmall, color: colors.textSecondary },
});
