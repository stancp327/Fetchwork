import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, Alert, Pressable,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { reviewsApi } from '../../api/endpoints/reviewsApi';
import { ProfileStackParamList } from '../../types/navigation';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'WriteReview'>;
const MIN_CHARS = 20;

export default function WriteReviewScreen({ route, navigation }: Props) {
  const { jobId, orderId, serviceId, targetName } = route.params;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const submitMut = useMutation({
    mutationFn: () =>
      reviewsApi.create({
        rating,
        comment: comment.trim(),
        ...(jobId && { jobId }),
        ...(serviceId && { serviceId }),
        ...(orderId && { orderId }),
      }),
    onSuccess: () => {
      Alert.alert('Review Submitted', 'Thank you for your feedback!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  const canSubmit = rating > 0 && comment.trim().length >= MIN_CHARS;

  const handleSubmit = () => {
    if (!canSubmit) return;
    submitMut.mutate();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Review {targetName}</Text>

        {/* Star Selector */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Your Rating</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                hitSlop={8}
                accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={40}
                  color={star <= rating ? colors.warning : colors.textMuted}
                />
              </Pressable>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingLabel}>
              {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
            </Text>
          )}
        </Card>

        {/* Comment */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Your Review</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Share your experience (min 20 characters)..."
            placeholderTextColor={colors.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={[styles.charCount, comment.trim().length < MIN_CHARS && styles.charCountWarn]}>
            {comment.trim().length} / {MIN_CHARS} min
          </Text>
        </Card>

        <Button
          label="Submit Review"
          onPress={handleSubmit}
          loading={submitMut.isPending}
          disabled={!canSubmit}
          fullWidth
          size="lg"
          leftIcon="send-outline"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bgSubtle },
  scroll:       { padding: spacing.md, paddingBottom: spacing.xl },
  heading:      { ...typography.h2, marginBottom: spacing.md },
  section:      { marginBottom: spacing.md },
  sectionLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  starsRow:     { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', paddingVertical: spacing.sm },
  ratingLabel:  { ...typography.body, textAlign: 'center', color: colors.text, marginTop: spacing.xs },
  textArea: {
    ...typography.body,
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
  },
  charCount:     { ...typography.caption, textAlign: 'right', marginTop: spacing.xs },
  charCountWarn: { color: colors.danger },
});
