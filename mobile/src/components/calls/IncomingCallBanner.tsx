/**
 * IncomingCallBanner – slides in from the top when receiving an incoming call.
 * Shows caller name + avatar; accept / decline actions.
 * Auto-dismisses after 30s (missed call).
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../common/Avatar';
import { colors, spacing, radius, typography } from '../../theme';
import type { RemoteUser } from '../../screens/VideoCallScreen';

interface IncomingCallBannerProps {
  callId: string;
  caller: RemoteUser;
  callType: 'video' | 'audio';
  onAccept: () => void;
  onDecline: () => void;
}

const BANNER_HEIGHT = 100;
const AUTO_DISMISS_MS = 30_000;

export default function IncomingCallBanner({
  callId: _callId,
  caller,
  callType,
  onAccept,
  onDecline,
}: IncomingCallBannerProps) {
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT - 20)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Slide in
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();

    // Auto-dismiss after 30s
    dismissTimer.current = setTimeout(() => {
      slideOut(onDecline);
    }, AUTO_DISMISS_MS);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slideOut = (callback: () => void) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.timing(translateY, {
      toValue: -BANNER_HEIGHT - 40,
      duration: 300,
      useNativeDriver: true,
    }).start(() => callback());
  };

  const handleAccept = () => slideOut(onAccept);
  const handleDecline = () => slideOut(onDecline);

  const callerName = `${caller.firstName} ${caller.lastName}`;

  return (
    <Animated.View
      style={[
        styles.banner,
        { transform: [{ translateY }] },
      ]}
    >
      <View style={styles.callerRow}>
        <Avatar name={callerName} size="sm" />
        <View style={styles.callerInfo}>
          <Text style={styles.callerName} numberOfLines={1}>{callerName}</Text>
          <Text style={styles.callType}>
            Incoming {callType === 'video' ? 'video' : 'audio'} call…
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {/* Decline */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.declineBtn]}
          onPress={handleDecline}
          accessibilityLabel="Decline call"
        >
          <Ionicons name="call" size={22} color={colors.white} style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>

        {/* Accept */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.acceptBtn]}
          onPress={handleAccept}
          accessibilityLabel="Accept call"
        >
          <Ionicons name="call" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 16,
    left: spacing.md,
    right: spacing.md,
    height: BANNER_HEIGHT,
    backgroundColor: '#1a1a2e',
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    zIndex: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  callerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  callerInfo: {
    flex: 1,
    minWidth: 0,
  },
  callerName: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  callType: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineBtn: {
    backgroundColor: colors.danger,
  },
  acceptBtn: {
    backgroundColor: colors.success,
  },
});
