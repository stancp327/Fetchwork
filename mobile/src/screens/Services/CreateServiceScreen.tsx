import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform, Pressable, Alert, Switch,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ServicesStackParamList } from '../../types/navigation';
import { servicesApi } from '../../api/endpoints/servicesApi';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { colors, spacing, typography, radius } from '../../theme';

type Props = NativeStackScreenProps<ServicesStackParamList, 'CreateService'>;

const CATEGORIES = [
  'web_dev', 'mobile', 'design', 'writing', 'marketing',
  'photography', 'fitness', 'tutoring', 'cooking', 'cleaning', 'other',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  web_dev: 'Web Dev', mobile: 'Mobile', design: 'Design', writing: 'Writing',
  marketing: 'Marketing', photography: 'Photography', fitness: 'Fitness',
  tutoring: 'Tutoring', cooking: 'Cooking', cleaning: 'Cleaning', other: 'Other',
};

const DELIVERY_OPTIONS = [
  { value: 1, label: '1 day' },
  { value: 2, label: '2 days' },
  { value: 3, label: '3 days' },
  { value: 5, label: '5 days' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

const LOCATION_MODES = ['remote', 'in_person', 'both'] as const;
const LOCATION_LABELS: Record<string, string> = {
  remote: 'Remote', in_person: 'In-Person', both: 'Both',
};

interface PackageData {
  label: string;
  price: string;
  description: string;
}

const TOTAL_STEPS = 4;

export default function CreateServiceScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);

  // Step 1
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  // Step 2
  const [priceType, setPriceType] = useState<'fixed' | 'hourly'>('fixed');
  const [price, setPrice] = useState('');
  const [deliveryDays, setDeliveryDays] = useState(3);
  const [packagesEnabled, setPackagesEnabled] = useState(false);
  const [packages, setPackages] = useState<PackageData[]>([
    { label: 'Basic', price: '', description: '' },
    { label: 'Standard', price: '', description: '' },
    { label: 'Premium', price: '', description: '' },
  ]);

  // Step 3
  const [tagsInput, setTagsInput] = useState('');
  const [requirements, setRequirements] = useState('');
  const [locationMode, setLocationMode] = useState<'remote' | 'in_person' | 'both'>('remote');

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (!title.trim()) errs.title = 'Title is required';
      else if (title.trim().length > 80) errs.title = 'Max 80 characters';
      if (!category) errs.category = 'Pick a category';
      if (description.trim().length < 50) errs.description = 'At least 50 characters';
      else if (description.trim().length > 2000) errs.description = 'Max 2000 characters';
    } else if (s === 2) {
      const p = parseFloat(price);
      if (!price || isNaN(p) || p <= 0) errs.price = 'Enter a valid price';
      if (packagesEnabled) {
        packages.forEach((pkg, i) => {
          const pkgPrice = parseFloat(pkg.price);
          if (!pkg.label.trim()) errs[`pkg_label_${i}`] = 'Label required';
          if (!pkg.price || isNaN(pkgPrice) || pkgPrice <= 0) errs[`pkg_price_${i}`] = 'Valid price required';
        });
      }
    } else if (s === 3) {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      if (tags.length > 10) errs.tags = 'Max 10 tags';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (validateStep(step)) setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };

  const goBack = () => setStep(s => Math.max(s - 1, 1));

  const updatePackage = (index: number, field: keyof PackageData, value: string) => {
    setPackages(prev => prev.map((pkg, i) => i === index ? { ...pkg, [field]: value } : pkg));
  };

  const mutation = useMutation({
    mutationFn: () => {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      return servicesApi.create({
        title: title.trim(),
        category,
        description: description.trim(),
        price: parseFloat(price),
        priceType,
        deliveryDays,
        tags,
        requirements: requirements.trim() || undefined,
        serviceLocation: { mode: locationMode },
        packages: packagesEnabled
          ? packages.map(pkg => ({ label: pkg.label.trim(), price: parseFloat(pkg.price), description: pkg.description.trim() }))
          : undefined,
      });
    },
    onSuccess: (data) => {
      Alert.alert('Service Published!', 'Your service is now live.');
      qc.invalidateQueries({ queryKey: ['myServices'] });
      qc.invalidateQueries({ queryKey: ['services'] });
      navigation.navigate('ServiceDetail', { id: data._id });
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to create service');
    },
  });

  const handlePublish = () => {
    if (validateStep(3)) mutation.mutate();
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>Step {step} of {TOTAL_STEPS}</Text>
    </View>
  );

  const renderStep1 = () => (
    <>
      <Text style={styles.stepTitle}>Basics</Text>
      <Text style={styles.stepSubtitle}>Tell clients what you're offering</Text>

      <Input
        label="Title *"
        placeholder="e.g. Professional Logo Design"
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        error={errors.title}
      />
      <Text style={styles.charCount}>{title.length}/80</Text>

      <Text style={styles.fieldLabel}>Category *</Text>
      {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <View style={styles.chipRow}>
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat}
              style={[styles.chip, category === cat && styles.chipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                {CATEGORY_LABELS[cat]}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Input
        label="Description *"
        placeholder="Describe your service in detail (min 50 characters)…"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={5}
        maxLength={2000}
        error={errors.description}
      />
      <Text style={styles.charCount}>{description.length}/2000</Text>
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.stepTitle}>Pricing</Text>
      <Text style={styles.stepSubtitle}>Set your price and delivery time</Text>

      <Text style={styles.fieldLabel}>Price Model *</Text>
      <View style={styles.toggleRow}>
        {(['fixed', 'hourly'] as const).map(t => (
          <Pressable
            key={t}
            style={[styles.toggleBtn, priceType === t && styles.toggleBtnActive]}
            onPress={() => setPriceType(t)}
          >
            <Text style={[styles.toggleBtnText, priceType === t && styles.toggleBtnTextActive]}>
              {t === 'fixed' ? 'Fixed' : 'Hourly'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input
        label={priceType === 'fixed' ? 'Price ($) *' : 'Rate ($/hr) *'}
        placeholder="e.g. 50"
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
        error={errors.price}
        leftIcon="cash-outline"
      />

      <Text style={styles.fieldLabel}>Delivery Time *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <View style={styles.chipRow}>
          {DELIVERY_OPTIONS.map(opt => (
            <Pressable
              key={opt.value}
              style={[styles.chip, deliveryDays === opt.value && styles.chipActive]}
              onPress={() => setDeliveryDays(opt.value)}
            >
              <Text style={[styles.chipText, deliveryDays === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Text style={styles.fieldLabel}>Offer Packages</Text>
          <Text style={styles.switchHint}>Basic / Standard / Premium tiers</Text>
        </View>
        <Switch
          value={packagesEnabled}
          onValueChange={setPackagesEnabled}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>

      {packagesEnabled && packages.map((pkg, i) => (
        <Card key={i} style={styles.packageCard}>
          <Text style={styles.packageTitle}>{['Basic', 'Standard', 'Premium'][i]}</Text>
          <Input
            label="Label"
            placeholder="e.g. Starter Package"
            value={pkg.label}
            onChangeText={v => updatePackage(i, 'label', v)}
            error={errors[`pkg_label_${i}`]}
          />
          <Input
            label="Price ($)"
            placeholder="e.g. 50"
            value={pkg.price}
            onChangeText={v => updatePackage(i, 'price', v)}
            keyboardType="numeric"
            error={errors[`pkg_price_${i}`]}
          />
          <Input
            label="Description"
            placeholder="What's included in this tier?"
            value={pkg.description}
            onChangeText={v => updatePackage(i, 'description', v)}
            multiline
            numberOfLines={2}
          />
        </Card>
      ))}
    </>
  );

  const renderStep3 = () => (
    <>
      <Text style={styles.stepTitle}>Details</Text>
      <Text style={styles.stepSubtitle}>Help clients find your service</Text>

      <Input
        label="Tags"
        placeholder="react, typescript, frontend (comma separated)"
        value={tagsInput}
        onChangeText={setTagsInput}
        error={errors.tags}
        hint="Up to 10 tags"
      />
      {tagsInput.trim().length > 0 && (
        <View style={styles.tagsPreview}>
          {tagsInput.split(',').map(t => t.trim()).filter(Boolean).map((tag, i) => (
            <Badge key={i} label={tag} variant="primary" />
          ))}
        </View>
      )}

      <Input
        label="Requirements"
        placeholder="What do you need from the client?"
        value={requirements}
        onChangeText={setRequirements}
        multiline
        numberOfLines={3}
        hint="Optional — list what clients should provide"
      />

      <Text style={styles.fieldLabel}>Service Location *</Text>
      <View style={styles.toggleRow}>
        {LOCATION_MODES.map(mode => (
          <Pressable
            key={mode}
            style={[styles.toggleBtn, locationMode === mode && styles.toggleBtnActive]}
            onPress={() => setLocationMode(mode)}
          >
            <Text style={[styles.toggleBtnText, locationMode === mode && styles.toggleBtnTextActive]}>
              {LOCATION_LABELS[mode]}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  const renderStep4 = () => {
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    return (
      <>
        <Text style={styles.stepTitle}>Review & Publish</Text>
        <Text style={styles.stepSubtitle}>Make sure everything looks good</Text>

        <Card style={styles.reviewCard}>
          <Text style={styles.reviewSection}>Basics</Text>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Title</Text>
            <Text style={styles.reviewValue}>{title}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Category</Text>
            <Badge label={CATEGORY_LABELS[category] || category} variant="primary" />
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Description</Text>
            <Text style={styles.reviewValue} numberOfLines={3}>{description}</Text>
          </View>
        </Card>

        <Card style={styles.reviewCard}>
          <Text style={styles.reviewSection}>Pricing</Text>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Price</Text>
            <Text style={styles.reviewValue}>
              ${price}{priceType === 'hourly' ? '/hr' : ''} ({priceType})
            </Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Delivery</Text>
            <Text style={styles.reviewValue}>{deliveryDays} day{deliveryDays !== 1 ? 's' : ''}</Text>
          </View>
          {packagesEnabled && (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Packages</Text>
              <View style={{ flex: 1 }}>
                {packages.map((pkg, i) => (
                  <Text key={i} style={styles.reviewValue}>
                    {pkg.label}: ${pkg.price}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </Card>

        <Card style={styles.reviewCard}>
          <Text style={styles.reviewSection}>Details</Text>
          {tags.length > 0 && (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Tags</Text>
              <View style={styles.tagsPreview}>
                {tags.map((tag, i) => (
                  <Badge key={i} label={tag} variant="primary" />
                ))}
              </View>
            </View>
          )}
          {requirements.trim() && (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Requirements</Text>
              <Text style={styles.reviewValue}>{requirements}</Text>
            </View>
          )}
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Location</Text>
            <Text style={styles.reviewValue}>{LOCATION_LABELS[locationMode]}</Text>
          </View>
        </Card>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {renderProgressBar()}
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 && (
            <Button label="Back" onPress={goBack} variant="secondary" style={{ flex: 1 }} />
          )}
          {step < TOTAL_STEPS ? (
            <Button label="Next" onPress={goNext} variant="primary" style={{ flex: 1 }} />
          ) : (
            <Button
              label="Publish Service"
              onPress={handlePublish}
              loading={mutation.isPending}
              variant="primary"
              size="lg"
              style={{ flex: 1 }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  // Progress
  progressContainer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  progressTrack: { height: 4, backgroundColor: colors.bgMuted, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  progressText: { ...typography.caption, textAlign: 'center', marginTop: spacing.xs },

  // Step headers
  stepTitle: { ...typography.h2, marginBottom: spacing.xs },
  stepSubtitle: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.lg },

  // Fields
  fieldLabel: { ...typography.label, marginBottom: 6 },
  charCount: { ...typography.caption, textAlign: 'right', marginTop: -4, marginBottom: spacing.sm },
  errorText: { fontSize: 12, color: colors.danger, marginBottom: 6 },

  // Chips
  chipScroll: { marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.white,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.primary },

  // Toggle row
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  toggleBtn: {
    flex: 1, padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  toggleBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  toggleBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  toggleBtnTextActive: { color: colors.primary },

  // Switch
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.sm },
  switchLabel: { flex: 1 },
  switchHint: { ...typography.caption, color: colors.textMuted },

  // Packages
  packageCard: { marginBottom: spacing.sm },
  packageTitle: { ...typography.h4, color: colors.primary, marginBottom: spacing.sm },

  // Tags preview
  tagsPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },

  // Review
  reviewCard: { marginBottom: spacing.sm },
  reviewSection: { ...typography.h4, marginBottom: spacing.sm },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewLabel: { ...typography.label, color: colors.textSecondary, width: 100 },
  reviewValue: { ...typography.body, flex: 1, textAlign: 'right' },

  // Footer
  footer: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
});
