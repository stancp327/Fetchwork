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
import TeamDetailScreen from '../screens/Profile/TeamDetailScreen';
import WalletScreen from '../screens/Profile/WalletScreen';
import PaymentsScreen from '../screens/Profile/PaymentsScreen';
import ContractsScreen    from '../screens/Profile/ContractsScreen';
import EarningsScreen         from '../screens/Profile/EarningsScreen';
import SkillAssessmentScreen  from '../screens/Skills/SkillAssessmentScreen';
import BookingListScreen   from '../screens/Bookings/BookingListScreen';
import BookingDetailScreen from '../screens/Bookings/BookingDetailScreen';
import GroupSlotsScreen    from '../screens/Bookings/GroupSlotsScreen';
import EscrowConfirmScreen from '../screens/Payments/EscrowConfirmScreen';
import TipScreen           from '../screens/Payments/TipScreen';
import WriteReviewScreen   from '../screens/Reviews/WriteReviewScreen';
import ReviewListScreen    from '../screens/Reviews/ReviewListScreen';

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
      <Stack.Screen name="TeamDetail"        component={TeamDetailScreen}        options={{ title: 'Team Details' }} />
      <Stack.Screen name="Wallet"            component={WalletScreen}            options={{ title: 'Wallet' }} />
      <Stack.Screen name="Payments"          component={PaymentsScreen}          options={{ title: 'Payments' }} />
      <Stack.Screen name="Contracts"         component={ContractsScreen}         options={{ title: 'Contracts' }} />
      <Stack.Screen name="Earnings"          component={EarningsScreen}          options={{ title: 'My Earnings' }} />
      <Stack.Screen name="Skills"            component={SkillAssessmentScreen}   options={{ title: 'Skill Assessments' }} />
      <Stack.Screen name="Bookings"          component={BookingListScreen}        options={{ title: 'My Bookings' }} />
      <Stack.Screen name="BookingDetail"     component={BookingDetailScreen}      options={{ title: 'Booking Details' }} />
      <Stack.Screen name="GroupSlots"        component={GroupSlotsScreen}         options={{ title: 'Available Sessions' }} />
      <Stack.Screen name="EscrowConfirm"    component={EscrowConfirmScreen}      options={{ title: 'Confirm Payment' }} />
      <Stack.Screen name="TipScreen"        component={TipScreen}               options={{ title: 'Send Tip' }} />
      <Stack.Screen name="WriteReview"     component={WriteReviewScreen}        options={{ title: 'Write Review' }} />
      <Stack.Screen name="ReviewList"      component={ReviewListScreen}         options={{ title: 'Reviews' }} />
    </Stack.Navigator>
  );
}
