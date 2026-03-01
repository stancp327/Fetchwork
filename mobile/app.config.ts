import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Fetchwork',
  slug: 'fetchwork',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'fetchwork',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#2563eb',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.fetchwork.app',
    infoPlist: {
      NSCameraUsageDescription: 'Used for profile photo and ID verification uploads.',
      NSPhotoLibraryUsageDescription: 'Used for profile photo and portfolio uploads.',
      NSPhotoLibraryAddUsageDescription: 'Used to save images from Fetchwork.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2563eb',
    },
    package: 'com.fetchwork.app',
    permissions: ['CAMERA', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE'],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID || 'YOUR_EAS_PROJECT_ID',
    },
  },
  plugins: [
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#2563eb',
        sounds: [],
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        project: 'fetchwork-mobile',
        organization: 'fetchwork',
      },
    ],
  ],
});
