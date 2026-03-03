import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { ProfileStackParamList } from '../types/navigation';
import MyProfileScreen from '../screens/Profile/MyProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import VerificationScreen from '../screens/Profile/VerificationScreen';
import SettingsScreen from '../screens/Profile/SettingsScreen';
import DiscoverySettingsScreen from '../screens/Profile/DiscoverySettingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import TeamsScreen from '../screens/Profile/TeamsScreen';
import WalletScreen from '../screens/Profile/WalletScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerBackTitleVisible: false,
        headerStyle: { backgroundColor: colors.white },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="MyProfile"    component={MyProfileScreen}    options={{ headerShown: false }} />
      <Stack.Screen name="EditProfile"  component={EditProfileScreen}  options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="Verification" component={VerificationScreen} options={{ title: 'Verification & Badges' }} />
      <Stack.Screen name="Settings"          component={SettingsScreen}          options={{ title: 'Settings' }} />
      <Stack.Screen name="DiscoverySettings" component={DiscoverySettingsScreen} options={{ title: 'Discovery' }} />
      <Stack.Screen name="Notifications"     component={NotificationsScreen}     options={{ title: 'Notifications' }} />
      <Stack.Screen name="Teams"             component={TeamsScreen}             options={{ title: 'Teams' }} />
      <Stack.Screen name="Wallet"            component={WalletScreen}            options={{ title: 'Wallet' }} />
    </Stack.Navigator>
  );
}
