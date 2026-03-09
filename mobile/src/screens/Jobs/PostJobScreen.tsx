import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { jobsApi } from '../../api/endpoints/jobsApi';
import { aiApi } from '../../api/endpoints/aiApi';
import PricingInsightWidget from '../../components/PricingInsightWidget';
import { JobsStackParamList } from '../../types/navigation';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';

type Props = NativeStackScreenProps<JobsStackParamList, 'PostJob'>;

const schema = z.object({
  title:       z.string().min(10, 'At least 10 characters'),
  description: z.string().min(50, 'At least 50 characters'),
  category:    z.string().min(1, 'Required'),
  budgetType:  z.enum(['fixed', 'hourly']),
  budgetMin:   z.coerce.number().min(1, 'Required'),
  budgetMax:   z.coerce.number().optional(),
  skills:      z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function PostJobScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMsg, setAiMsg] = useState('');

  const { control, handleSubmit, watch, setValue, getValues, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', category: '', budgetType: 'fixed', budgetMin: 0, skills: '' },
  });

  const budgetType    = watch('budgetType');
  const watchCategory = watch('category');
  const watchBudget   = watch('budgetMin');

  const handleGenerate = async () => {
    const { title, category, skills, budgetType: bt, budgetMin } = getValues();
    if (!title) {
      Alert.alert('Add a title first', 'I need a job title to generate a description.');
      return;
    }
    setAiGenerating(true);
    setAiMsg('');
    try {
      const result = await aiApi.generateDescription({ title, category, skills, budgetType: bt, budgetAmount: budgetMin });
      setValue('description', result.description);
      setAiMsg(result.aiGenerated ? '✨ AI-generated — feel free to edit' : '📝 Template applied — make it yours');
      setTimeout(() => setAiMsg(''), 5000);
    } catch (err: any) {
      if (err?.response?.data?.error === 'upgrade_required') {
        Alert.alert('Plus feature', 'AI job descriptions are available on Plus and above.\n\nUpgrade at fetchwork.net/pricing');
      } else {
        Alert.alert('Error', 'Could not generate description — try again.');
      }
    } finally {
      setAiGenerating(false);
    }
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) => jobsApi.create({
      title: data.title,
      description: data.description,
      category: data.category,
      budget: { type: data.budgetType, amount: data.budgetMin, max: data.budgetMax },
      skills: data.skills?.split(',').map(s => s.trim()).filter(Boolean) || [],
      status: 'open',
    }),
    onSuccess: () => {
      Alert.alert('Job Posted!', 'Your job is now live.');
      qc.invalidateQueries({ queryKey: ['jobs'] });
      navigation.navigate('MyJobs');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to post job');
    },
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Controller control={control} name="title"
            render={({ field: { onChange, value } }) => (
              <Input label="Job Title *" placeholder="e.g. Need a plumber for kitchen fix"
                value={value} onChangeText={onChange} error={errors.title?.message} />
            )} />

          <View style={styles.descLabelRow}>
            <Text style={styles.descLabel}>Description *</Text>
            <Pressable style={[styles.aiBtnInline, aiGenerating && styles.aiBtnDisabled]}
              onPress={handleGenerate} disabled={aiGenerating}>
              {aiGenerating
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.aiBtnText}>✨ Write for me</Text>
              }
            </Pressable>
          </View>
          {!!aiMsg && <Text style={styles.aiMsg}>{aiMsg}</Text>}
          <Controller control={control} name="description"
            render={({ field: { onChange, value } }) => (
              <Input placeholder="Describe the job in detail, or tap ✨ Write for me…" value={value}
                onChangeText={onChange} multiline numberOfLines={5} error={errors.description?.message} />
            )} />

          <Controller control={control} name="category"
            render={({ field: { onChange, value } }) => (
              <Input label="Category *" placeholder="e.g. Plumbing, Tutoring, Design"
                value={value} onChangeText={onChange} error={errors.category?.message} />
            )} />

          {/* Budget type selector */}
          <Text style={styles.fieldLabel}>Budget Type *</Text>
          <View style={styles.budgetRow}>
            {(['fixed', 'hourly'] as const).map(t => (
              <Pressable key={t} style={[styles.budgetBtn, budgetType === t && styles.budgetBtnActive]}
                onPress={() => setValue('budgetType', t)}>
                <Text style={[styles.budgetBtnText, budgetType === t && styles.budgetBtnTextActive]}>
                  {t === 'fixed' ? '💰 Fixed' : '⏱ Hourly'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.amountRow}>
            <Controller control={control} name="budgetMin"
              render={({ field: { onChange, value } }) => (
                <Input label={budgetType === 'fixed' ? 'Budget ($) *' : 'Min Rate ($/hr) *'}
                  placeholder="e.g. 100" value={String(value || '')} onChangeText={onChange}
                  keyboardType="numeric" error={errors.budgetMin?.message} containerStyle={{ flex: 1 }} />
              )} />
            {budgetType === 'fixed' && (
              <Controller control={control} name="budgetMax"
                render={({ field: { onChange, value } }) => (
                  <Input label="Max Budget ($)" placeholder="e.g. 500"
                    value={String(value || '')} onChangeText={onChange} keyboardType="numeric"
                    containerStyle={{ flex: 1 }} />
                )} />
            )}
          </View>

          {/* Market budget insight */}
          {watchCategory ? (
            <PricingInsightWidget
              category={watchCategory}
              currentPrice={watchBudget || undefined}
              mode="job"
            />
          ) : null}

          <Controller control={control} name="skills"
            render={({ field: { onChange, value } }) => (
              <Input label="Required Skills" placeholder="React, Python, Photoshop (comma separated)"
                value={value || ''} onChangeText={onChange} />
            )} />

          <Button label="Post Job" onPress={handleSubmit(d => mutation.mutate(d))}
            loading={isSubmitting || mutation.isPending} fullWidth size="lg" style={styles.postBtn} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: colors.white },
  flex1:              { flex: 1 },
  postBtn:            { marginTop: spacing.sm },
  scroll:             { padding: spacing.lg, flexGrow: 1 },
  fieldLabel:         { ...typography.label, marginBottom: 6 },
  budgetRow:          { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  budgetBtn:          { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  budgetBtnActive:    { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  budgetBtnText:      { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  budgetBtnTextActive:{ color: colors.primary },
  amountRow:          { flexDirection: 'row', gap: spacing.sm },
  // AI gen
  descLabelRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  descLabel:      { ...typography.label },
  aiBtnInline:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: 9999, minHeight: 32, backgroundColor: colors.purple },
  aiBtnDisabled:  { opacity: 0.55 },
  aiBtnText:      { color: colors.white, fontSize: 12, fontWeight: '700' },
  aiMsg:          { fontSize: 12, color: colors.primary, backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 4, marginBottom: spacing.xs },
});
