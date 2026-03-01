import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { MainTabParamList } from '../types/navigation';

import HomeScreen from '../screens/HomeScreen';
import JobsStackNavigator from './JobsStackNavigator';
import ServicesStackNavigator from './ServicesStackNavigator';
import MessagesStackNavigator from './MessagesStackNavigator';
import ProfileStackNavigator from './ProfileStackNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { focused: IoniconName; unfocused: IoniconName }> = {
  Home:     { focused: 'home',             unfocused: 'home-outline' },
  Jobs:     { focused: 'briefcase',        unfocused: 'briefcase-outline' },
  Services: { focused: 'grid',             unfocused: 'grid-outline' },
  Messages: { focused: 'chatbubbles',      unfocused: 'chatbubbles-outline' },
  Profile:  { focused: 'person-circle',   unfocused: 'person-circle-outline' },
};

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.white,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', paddingBottom: 4 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const name = focused ? icons.focused : icons.unfocused;
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen}             options={{ title: 'Home' }} />
      <Tab.Screen name="Jobs"     component={JobsStackNavigator}     options={{ title: 'Jobs' }} />
      <Tab.Screen name="Services" component={ServicesStackNavigator} options={{ title: 'Services' }} />
      <Tab.Screen name="Messages" component={MessagesStackNavigator} options={{ title: 'Messages' }} />
      <Tab.Screen name="Profile"  component={ProfileStackNavigator}  options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
