import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Fetchwork',
  slug: 'fetchwork',
  owner: 'zestyfresh925s-organization',
  version: '1.0.0',
  runtimeVersion: {
    policy: 'appVersion',
  },
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'fetchwork',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#2563eb',
  },
  updates: {
    enabled: true,
    fallbackToCacheTimeout: 5000,
    url: `https://u.expo.dev/7550a4f8-a14b-4568-a588-989666852755`,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.fetchwork.app',
    buildNumber: '1',
    infoPlist: {
      NSCameraUsageDescription: 'Fetchwork needs camera access for video calls and profile photo uploads.',
      NSMicrophoneUsageDescription: 'Fetchwork needs microphone access for calls.',
      NSPhotoLibraryUsageDescription: 'Used for profile photo and portfolio uploads.',
      NSPhotoLibraryAddUsageDescription: 'Used to save images from Fetchwork.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2563eb',
    },
    package: 'com.fetchwork.app',
    versionCode: 7,
    permissions: [
      'CAMERA',
      'RECORD_AUDIO',
      'MODIFY_AUDIO_SETTINGS',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'fetchwork' },
          { scheme: 'https', host: 'fetchwork.net', pathPrefix: '/' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    eas: {
      projectId: '7550a4f8-a14b-4568-a588-989666852755',
    },
  },
  plugins: [
    'expo-font',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#2563eb',
        sounds: [],
      },
    ],
    'expo-splash-screen',
  ],
});
