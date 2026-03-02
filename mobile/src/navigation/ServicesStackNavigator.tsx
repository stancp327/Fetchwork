import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { ServicesStackParamList } from '../types/navigation';
import BrowseServicesScreen from '../screens/Services/BrowseServicesScreen';
import ServiceDetailScreen from '../screens/Services/ServiceDetailScreen';
import MyServicesScreen from '../screens/Services/MyServicesScreen';
import MyBundlesScreen from '../screens/Services/MyBundlesScreen';

const Stack = createNativeStackNavigator<ServicesStackParamList>();

export default function ServicesStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerBackTitleVisible: false,
        headerStyle: { backgroundColor: colors.white },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="BrowseServices" component={BrowseServicesScreen} options={{ title: 'Browse Services' }} />
      <Stack.Screen name="ServiceDetail"  component={ServiceDetailScreen}  options={{ title: 'Service Details' }} />
      <Stack.Screen name="MyServices"     component={MyServicesScreen}     options={{ title: 'My Services' }} />
      <Stack.Screen name="MyBundles"      component={MyBundlesScreen}      options={{ title: 'Subscriptions & Bundles' }} />
    </Stack.Navigator>
  );
}
