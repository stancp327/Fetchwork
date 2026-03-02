import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, typography } from '../theme';

const PROMPT_KEY = 'push_permission_prompted';

interface Props {
  /** Only show after user is authenticated */
  isAuthenticated: boolean;
  onGranted?: () => void;
}

export function PushPermissionPrompt({ isAuthenticated, onGranted }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      const already = await AsyncStorage.getItem(PROMPT_KEY);
      if (already) return;

      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') return; // already granted

      // Show our custom prompt
      setVisible(true);
    })();
  }, [isAuthenticated]);

  const handleEnable = async () => {
    await AsyncStorage.setItem(PROMPT_KEY, 'true');
    setVisible(false);

    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      try {
        const { registerForPushNotifications } = require('../utils/pushNotifications');
        await registerForPushNotifications();
        onGranted?.();
      } catch { /* non-fatal */ }
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(PROMPT_KEY, 'true');
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🔔</Text>
          <Text style={styles.title}>Stay in the Loop</Text>
          <Text style={styles.body}>
            Get notified when you receive messages, job proposals, booking updates, and payment confirmations.
          </Text>
          <TouchableOpacity style={styles.enableBtn} onPress={handleEnable}>
            <Text style={styles.enableText}>Enable Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  enableBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  enableText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  skipBtn: {
    paddingVertical: 10,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
