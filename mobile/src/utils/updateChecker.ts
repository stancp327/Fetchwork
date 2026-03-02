import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

/**
 * Check for OTA updates on app launch.
 * Only runs in production (EAS builds), not in Expo Go.
 */
export async function checkForUpdates(): Promise<void> {
  if (__DEV__) return; // skip in development

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      Alert.alert(
        'Update Available',
        'A new version has been downloaded. Restart to apply?',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Restart',
            onPress: () => Updates.reloadAsync(),
          },
        ]
      );
    }
  } catch (err) {
    // Non-fatal — don't block the app
    console.log('Update check failed:', err);
  }
}
