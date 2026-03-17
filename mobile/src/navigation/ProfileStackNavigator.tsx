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
import TeamJobsScreen from '../screens/Profile/TeamJobsScreen';
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
import DisputeListScreen   from '../screens/Disputes/DisputeListScreen';
import DisputeDetailScreen from '../screens/Disputes/DisputeDetailScreen';
import FileDisputeScreen   from '../screens/Disputes/FileDisputeScreen';
import BoostsScreen        from '../screens/Boosts/BoostsScreen';
import AnalyticsScreen     from '../screens/Analytics/AnalyticsScreen';
import OffersScreen        from '../screens/Profile/OffersScreen';
import ReferralScreen      from '../screens/Profile/ReferralScreen';

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
      <Stack.Screen name="TeamJobs"          component={TeamJobsScreen}          options={{ title: 'Team Jobs' }} />
      <Stack.Screen name="Wallet"            component={WalletScreen}            options={{ title: 'Wallet' }} />
      <Stack.Screen name="Payments"          component={PaymentsScreen}          options={{ title: 'Payments' }} />
      <Stack.Screen name="Contracts"         component={ContractsScreen}         options={{ title: 'Contracts' }} />
      <Stack.Screen name="Offers"            component={OffersScreen}            options={{ title: 'My Offers' }} />
      <Stack.Screen name="Referrals"         component={ReferralScreen}          options={{ title: 'Referrals' }} />
      <Stack.Screen name="Earnings"          component={EarningsScreen}          options={{ title: 'My Earnings' }} />
      <Stack.Screen name="Skills"            component={SkillAssessmentScreen}   options={{ title: 'Skill Assessments' }} />
      <Stack.Screen name="Bookings"          component={BookingListScreen}        options={{ title: 'My Bookings' }} />
      <Stack.Screen name="BookingDetail"     component={BookingDetailScreen}      options={{ title: 'Booking Details' }} />
      <Stack.Screen name="GroupSlots"        component={GroupSlotsScreen}         options={{ title: 'Available Sessions' }} />
      <Stack.Screen name="EscrowConfirm"    component={EscrowConfirmScreen}      options={{ title: 'Confirm Payment' }} />
      <Stack.Screen name="TipScreen"        component={TipScreen}               options={{ title: 'Send Tip' }} />
      <Stack.Screen name="WriteReview"     component={WriteReviewScreen}        options={{ title: 'Write Review' }} />
      <Stack.Screen name="ReviewList"      component={ReviewListScreen}         options={{ title: 'Reviews' }} />
      <Stack.Screen name="Disputes"        component={DisputeListScreen}       options={{ title: 'My Disputes' }} />
      <Stack.Screen name="DisputeDetail"   component={DisputeDetailScreen}     options={{ title: 'Dispute Details' }} />
      <Stack.Screen name="FileDispute"     component={FileDisputeScreen}       options={{ title: 'File a Dispute' }} />
      <Stack.Screen name="Boosts"          component={BoostsScreen}            options={{ title: 'Boost Listings' }} />
      <Stack.Screen name="Analytics"       component={AnalyticsScreen}         options={{ title: 'My Analytics' }} />
    </Stack.Navigator>
  );
}


