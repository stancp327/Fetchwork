import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from '../api/client';
import { getDeviceId } from './deviceId';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and store the token on the server.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get the Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: '7550a4f8-a14b-4568-a588-989666852755',
  });
  const token = tokenData.data;

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // Register token with server
  try {
    const deviceId = await getDeviceId();
    await api.post('/api/auth/push-token', { token, deviceId });
    console.log('Push token registered:', token.slice(0, 20) + '...');
  } catch (err) {
    console.error('Failed to register push token:', err);
  }

  return token;
}

/**
 * Listen for notification taps and return a cleanup function.
 */
export function setupNotificationListeners(
  onNotificationTap: (data: Record<string, unknown>) => void
) {
  // When user taps a notification
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    onNotificationTap(data);
  });

  return () => subscription.remove();
}
