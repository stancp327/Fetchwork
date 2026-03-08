import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput,
  TouchableOpacity,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { paymentsApi } from '../../api/endpoints/paymentsApi';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';
import { ProfileStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TipScreen'>;

const PRESETS = [5, 10, 15, 20];

export default function TipScreen({ route, navigation }: Props) {
  const { jobId, freelancerName, freelancerId } = route.params;
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [success, setSuccess] = useState(false);

  const amount = selectedPreset ?? (customAmount ? Number(customAmount) : 0);

  const tipMutation = useMutation({
    mutationFn: () =>
      paymentsApi.sendTip({
        jobId,
        amount,
        recipientId: freelancerId,
        paymentMethodId: 'default',
      }),
    onSuccess: () => setSuccess(true),
    onError: () => {},
  });

  const selectPreset = (value: number) => {
    setSelectedPreset(value);
    setCustomAmount('');
  };

  const handleCustomChange = (text: string) => {
    setCustomAmount(text.replace(/[^0-9.]/g, ''));
    setSelectedPreset(null);
  };

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <Ionicons name="heart-circle" size={72} color={colors.success} />
          <Text style={styles.successTitle}>Tip Sent!</Text>
          <Text style={styles.successSub}>
            ${amount.toFixed(2)} sent to {freelancerName}
          </Text>
          <Button
            label="Done"
            onPress={() => navigation.goBack()}
            size="lg"
            style={{ marginTop: spacing.lg, minWidth: 160 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.heading}>Send a Tip</Text>
        <Text style={styles.subheading}>Show appreciation to {freelancerName}</Text>

        {/* Preset buttons */}
        <View style={styles.presetsRow}>
          {PRESETS.map(value => (
            <TouchableOpacity
              key={value}
              style={[styles.presetBtn, selectedPreset === value && styles.presetBtnActive]}
              onPress={() => selectPreset(value)}
            >
              <Text style={[styles.presetText, selectedPreset === value && styles.presetTextActive]}>
                ${value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom amount */}
        <View style={styles.customRow}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={styles.customInput}
            value={customAmount}
            onChangeText={handleCustomChange}
            placeholder="Custom amount"
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {tipMutation.isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {(tipMutation.error as Error)?.message || 'Failed to send tip. Please try again.'}
            </Text>
          </View>
        )}

        <Button
          label={tipMutation.isPending ? 'Sending…' : `Confirm Tip — $${amount.toFixed(2)}`}
          onPress={() => tipMutation.mutate()}
          loading={tipMutation.isPending}
          disabled={tipMutation.isPending || amount <= 0}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgSubtle },
  content: { flex: 1, padding: spacing.md, justifyContent: 'center' },

  heading:    { ...typography.h2, textAlign: 'center', marginBottom: spacing.xs },
  subheading: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },

  presetsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  presetBtn:  {
    width: 72, height: 72, borderRadius: radius.lg,
    borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  presetBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  presetText:       { ...typography.h3, color: colors.text },
  presetTextActive: { color: colors.primary },

  customRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  dollarSign:  { ...typography.h3, color: colors.textMuted, marginRight: spacing.xs },
  customInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.sm, minHeight: 48, fontSize: 18, backgroundColor: colors.white, color: colors.text,
  },

  errorBox:  { backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { ...typography.bodySmall, color: colors.danger, textAlign: 'center' },

  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  successTitle:     { ...typography.h2, color: colors.success, marginTop: spacing.md },
  successSub:       { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
});
