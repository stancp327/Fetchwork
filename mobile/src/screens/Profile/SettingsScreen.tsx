import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography, radius } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

type SettingsRow = { label: string; action: () => void; danger?: boolean };

export default function SettingsScreen({ navigation }: Props) {
  const { logout } = useAuth();

  const rows: SettingsRow[] = [
    { label: '🔒 Change Password', action: () => Alert.alert('Coming soon', 'Password change coming soon.') },
    { label: '🔔 Notification Preferences', action: () => Alert.alert('Coming soon', 'Notification settings coming soon.') },
    { label: '💳 Payment Methods', action: () => Alert.alert('Coming soon', 'Payment settings coming soon.') },
    { label: '📜 Terms of Service', action: () => Alert.alert('Terms', 'Visit fetchwork.net/terms') },
    { label: '🔏 Privacy Policy', action: () => Alert.alert('Privacy', 'Visit fetchwork.net/privacy') },
    { label: '🚪 Log Out', action: logout, danger: true },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.section}>
        {rows.map((row, i) => (
          <Pressable key={row.label} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
            onPress={row.action}>
            <Text style={[styles.label, row.danger && styles.danger]}>{row.label}</Text>
            {!row.danger && <Text style={styles.arrow}>›</Text>}
          </Pressable>
        ))}
      </View>
      <Text style={styles.version}>Fetchwork v1.0.0</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.bgSubtle },
  section:   { margin: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label:     { ...typography.body },
  danger:    { color: colors.danger },
  arrow:     { color: colors.textMuted, fontSize: 18 },
  version:   { textAlign: 'center', ...typography.caption, marginTop: spacing.lg },
});
