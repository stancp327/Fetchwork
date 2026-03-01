import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'fetchwork_device_id';

export async function getDeviceId(): Promise<string> {
  // Prefer platform-native stable ID
  if (Platform.OS === 'ios') {
    const id = await Application.getIosIdForVendorAsync();
    if (id) return id;
  }
  if (Platform.OS === 'android') {
    const id = Application.getAndroidId();
    if (id) return id;
  }

  // Fallback: generate and persist a UUID
  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (stored) return stored;

  const uuid = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, uuid);
  return uuid;
}
