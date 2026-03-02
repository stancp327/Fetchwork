import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';
import * as SplashScreen from 'expo-splash-screen';
import { QueryContext } from './src/context/QueryContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { linking } from './src/navigation/linking';
import { PushPermissionPrompt } from './src/components/PushPermissionPrompt';
import { setupNotificationListeners } from './src/utils/pushNotifications';
import { RootStackParamList } from './src/types/navigation';
import { checkForUpdates } from './src/utils/updateChecker';

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PK || '';

// Keep splash visible while we load auth state
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppInner() {
  const { isAuthenticated, isLoading } = useAuth();
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  // Hide splash once auth state is resolved + check for OTA updates
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
      checkForUpdates();
    }
  }, [isLoading]);

  // Handle notification taps → navigate to relevant screen
  useEffect(() => {
    if (!isAuthenticated) return;

    const cleanup = setupNotificationListeners((data) => {
      const nav = navRef.current;
      if (!nav) return;

      const type = data.type as string | undefined;
      const id = data.id as string | undefined;

      switch (type) {
        case 'message':
          if (id) nav.navigate('Main', { screen: 'Messages', params: { screen: 'MessageThread', params: { conversationId: id } } });
          break;
        case 'job':
          if (id) nav.navigate('Main', { screen: 'Jobs', params: { screen: 'JobDetail', params: { id } } });
          break;
        case 'service':
          if (id) nav.navigate('Main', { screen: 'Services', params: { screen: 'ServiceDetail', params: { id } } });
          break;
        case 'booking':
        case 'payment':
          nav.navigate('Main', { screen: 'Profile', params: { screen: 'Notifications' } });
          break;
        default:
          nav.navigate('Main', { screen: 'Profile', params: { screen: 'Notifications' } });
      }
    });

    return cleanup;
  }, [isAuthenticated]);

  return (
    <>
      <NavigationContainer ref={navRef} linking={linking}>
        <RootNavigator />
      </NavigationContainer>
      <PushPermissionPrompt isAuthenticated={isAuthenticated} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StripeProvider
          publishableKey={STRIPE_PK}
          merchantIdentifier="merchant.com.fetchwork"
          urlScheme="fetchwork"
        >
          <QueryContext>
            <AuthProvider>
              <AppInner />
            </AuthProvider>
          </QueryContext>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
