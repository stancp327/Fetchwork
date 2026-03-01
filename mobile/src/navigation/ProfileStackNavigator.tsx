import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { ProfileStackParamList } from '../types/navigation';
import MyProfileScreen from '../screens/Profile/MyProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import VerificationScreen from '../screens/Profile/VerificationScreen';

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
    </Stack.Navigator>
  );
}
