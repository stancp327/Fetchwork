import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { JobsStackParamList } from '../types/navigation';
import BrowseJobsScreen from '../screens/Jobs/BrowseJobsScreen';
import JobDetailScreen from '../screens/Jobs/JobDetailScreen';
import PostJobScreen from '../screens/Jobs/PostJobScreen';
import MyJobsScreen from '../screens/Jobs/MyJobsScreen';
import JobProposalsScreen from '../screens/Jobs/JobProposalsScreen';
import JobProgressScreen from '../screens/Jobs/JobProgressScreen';

const Stack = createNativeStackNavigator<JobsStackParamList>();

export default function JobsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerBackTitleVisible: false,
        headerStyle: { backgroundColor: colors.white },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="BrowseJobs" component={BrowseJobsScreen} options={{ title: 'Find Jobs' }} />
      <Stack.Screen name="JobDetail"  component={JobDetailScreen}  options={{ title: 'Job Details' }} />
      <Stack.Screen name="PostJob"    component={PostJobScreen}    options={{ title: 'Post a Job' }} />
      <Stack.Screen name="MyJobs"     component={MyJobsScreen}     options={{ title: 'My Jobs' }} />
      <Stack.Screen name="JobProposals" component={JobProposalsScreen} options={{ title: 'Proposals' }} />
      <Stack.Screen name="JobProgress"  component={JobProgressScreen}  options={{ title: 'Job Progress' }} />
    </Stack.Navigator>
  );
}
