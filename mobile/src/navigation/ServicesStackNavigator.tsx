import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { ServicesStackParamList } from '../types/navigation';
import BrowseServicesScreen      from '../screens/Services/BrowseServicesScreen';
import ServiceDetailScreen       from '../screens/Services/ServiceDetailScreen';
import MyServicesScreen          from '../screens/Services/MyServicesScreen';
import MyBundlesScreen           from '../screens/Services/MyBundlesScreen';
import AvailabilityManagerScreen from '../screens/Services/AvailabilityManagerScreen';
import ServiceOrderProgressScreen from '../screens/Services/ServiceOrderProgressScreen';
import CreateServiceScreen from '../screens/Services/CreateServiceScreen';

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
      <Stack.Screen name="BrowseServices"      component={BrowseServicesScreen}      options={{ title: 'Browse Services' }} />
      <Stack.Screen name="ServiceDetail"       component={ServiceDetailScreen}       options={{ title: 'Service Details' }} />
      <Stack.Screen name="MyServices"          component={MyServicesScreen}          options={{ title: 'My Services' }} />
      <Stack.Screen name="MyBundles"           component={MyBundlesScreen}           options={{ title: 'Subscriptions & Bundles' }} />
      <Stack.Screen name="CreateService"        component={CreateServiceScreen}        options={{ title: 'Create Service' }} />
      <Stack.Screen name="AvailabilityManager"  component={AvailabilityManagerScreen}  options={{ title: 'Manage Availability' }} />
      <Stack.Screen name="ServiceOrderProgress" component={ServiceOrderProgressScreen} options={{ title: 'Order Progress' }} />
    </Stack.Navigator>
  );
}
