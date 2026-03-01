import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usersApi } from '../../api/endpoints/usersApi';
import { ProfileStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { colors, spacing } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

type FormData = {
  firstName: string; lastName: string; headline: string;
  bio: string; hourlyRate: string; skills: string;
};

export default function EditProfileScreen({ navigation }: Props) {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();

  const { control, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      firstName: user?.firstName || '',
      lastName:  user?.lastName  || '',
      headline:  user?.headline  || '',
      bio:       user?.bio       || '',
      hourlyRate: user?.hourlyRate ? String(user.hourlyRate) : '',
      skills:    user?.skills?.join(', ') || '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => usersApi.updateProfile({
      firstName: data.firstName.trim(),
      lastName:  data.lastName.trim(),
      headline:  data.headline.trim(),
      bio:       data.bio.trim(),
      hourlyRate: data.hourlyRate ? Number(data.hourlyRate) : undefined,
      skills:    data.skills.split(',').map(s => s.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      refreshUser();
      qc.invalidateQueries({ queryKey: ['me'] });
      navigation.goBack();
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to update profile');
    },
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.row}>
            <Controller control={control} name="firstName"
              render={({ field: { onChange, value } }) => (
                <Input label="First Name" value={value} onChangeText={onChange} containerStyle={{ flex: 1 }} />
              )} />
            <Controller control={control} name="lastName"
              render={({ field: { onChange, value } }) => (
                <Input label="Last Name" value={value} onChangeText={onChange} containerStyle={{ flex: 1 }} />
              )} />
          </View>
          <Controller control={control} name="headline"
            render={({ field: { onChange, value } }) => (
              <Input label="Headline" placeholder="e.g. Full-Stack Developer & Designer"
                value={value} onChangeText={onChange} />
            )} />
          <Controller control={control} name="bio"
            render={({ field: { onChange, value } }) => (
              <Input label="Bio" placeholder="Tell clients about yourself..."
                value={value} onChangeText={onChange} multiline numberOfLines={4} />
            )} />
          {user?.role === 'freelancer' && (
            <Controller control={control} name="hourlyRate"
              render={({ field: { onChange, value } }) => (
                <Input label="Hourly Rate ($)" placeholder="e.g. 75" value={value}
                  onChangeText={onChange} keyboardType="numeric" />
              )} />
          )}
          <Controller control={control} name="skills"
            render={({ field: { onChange, value } }) => (
              <Input label="Skills (comma separated)" placeholder="React, Python, Figma"
                value={value} onChangeText={onChange} />
            )} />
          <Button label="Save Changes" onPress={handleSubmit(d => mutation.mutate(d))}
            loading={isSubmitting || mutation.isPending} fullWidth size="lg" style={{ marginTop: spacing.sm }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.white },
  scroll: { padding: spacing.lg, flexGrow: 1 },
  row:    { flexDirection: 'row', gap: spacing.sm },
});
