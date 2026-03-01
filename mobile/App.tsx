import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';
import { QueryContext } from './src/context/QueryContext';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { linking } from './src/navigation/linking';

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PK || '';

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
              <NavigationContainer linking={linking}>
                <RootNavigator />
              </NavigationContainer>
            </AuthProvider>
          </QueryContext>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
