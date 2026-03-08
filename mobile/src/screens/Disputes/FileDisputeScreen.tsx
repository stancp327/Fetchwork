import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, Alert, Pressable,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { disputesApi, Dispute } from '../../api/endpoints/disputesApi';
import { ProfileStackParamList } from '../../types/navigation';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'FileDispute'>;

const TYPES: { value: Dispute['type']; label: string; desc: string }[] = [
  { value: 'payment',       label: 'Payment Issue',    desc: 'Late, missing, or incorrect payment' },
  { value: 'quality',       label: 'Quality Issue',    desc: 'Work did not meet agreed standards' },
  { value: 'communication', label: 'Communication',    desc: 'Unresponsive or unprofessional conduct' },
  { value: 'no_show',       label: 'No Show',          desc: 'Party did not show up or deliver' },
  { value: 'other',         label: 'Other',            desc: 'Something else' },
];

export default function FileDisputeScreen({ route, navigation }: Props) {
  const { jobId, orderId } = route.params ?? {};
  const qc = useQueryClient();

  const [type, setType] = useState<Dispute['type'] | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const canSubmit = type !== null && description.trim().length >= 20;

  const createMut = useMutation({
    mutationFn: () => disputesApi.create({
      type: type!,
      ...(jobId && { jobId }),
      ...(orderId && { orderId }),
      ...(amount && { amount: parseFloat(amount) }),
      description: description.trim(),
    }),
    onSuccess: (dispute) => {
      qc.invalidateQueries({ queryKey: ['disputes'] });
      Alert.alert('Dispute Filed', 'Your dispute has been submitted. Our team will review it shortly.', [
        { text: 'View Dispute', onPress: () => { navigation.goBack(); navigation.navigate('DisputeDetail', { disputeId: dispute._id }); } },
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>File a Dispute</Text>
        <Text style={styles.sub}>Tell us what happened and we'll help resolve it.</Text>

        {/* Type picker */}
        <Text style={styles.label}>Issue Type</Text>
        <View style={styles.typeGrid}>
          {TYPES.map(t => (
            <Pressable
              key={t.value}
              style={[styles.typeCard, type === t.value && styles.typeCardActive]}
              onPress={() => setType(t.value)}
            >
              <Text style={[styles.typeLabel, type === t.value && styles.typeLabelActive]}>{t.label}</Text>
              <Text style={styles.typeDesc}>{t.desc}</Text>
            </Pressable>
          ))}
        </View>

        {/* Amount (optional) */}
        <Text style={styles.label}>Amount in Dispute (optional)</Text>
        <Card style={styles.inputCard}>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
        </Card>

        {/* Description */}
        <Text style={styles.label}>Describe the Issue</Text>
        <Card style={styles.inputCard}>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Explain what happened in detail (min 20 characters)..."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={[styles.charCount, description.trim().length < 20 && description.length > 0 && styles.charWarn]}>
            {description.trim().length} / 20 min
          </Text>
        </Card>

        <Button
          label="Submit Dispute"
          onPress={() => createMut.mutate()}
          loading={createMut.isPending}
          disabled={!canSubmit}
          fullWidth
          size="lg"
          leftIcon="shield-checkmark-outline"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },
  heading: { ...typography.h2, marginBottom: spacing.xs },
  sub: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },

  typeGrid: { gap: spacing.sm, marginBottom: spacing.md },
  typeCard: {
    padding: spacing.md, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  typeCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight ?? '#eff6ff' },
  typeLabel: { ...typography.body, fontWeight: '600', color: colors.text },
  typeLabelActive: { color: colors.primary },
  typeDesc: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },

  inputCard: { marginBottom: spacing.md },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  currency: { ...typography.body, color: colors.textMuted, marginRight: spacing.xs },
  amountInput: { ...typography.body, flex: 1, color: colors.text },
  textArea: { ...typography.body, minHeight: 120, color: colors.text },
  charCount: { ...typography.caption, textAlign: 'right', marginTop: spacing.xs, color: colors.textMuted },
  charWarn: { color: colors.danger },
});
