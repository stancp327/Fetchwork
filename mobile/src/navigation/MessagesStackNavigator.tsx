import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { MessagesStackParamList } from '../types/navigation';
import ConversationListScreen from '../screens/Messages/ConversationListScreen';
import MessageThreadScreen from '../screens/Messages/MessageThreadScreen';

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export default function MessagesStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerBackTitleVisible: false,
        headerStyle: { backgroundColor: colors.white },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="ConversationList" component={ConversationListScreen} options={{ title: 'Messages' }} />
      <Stack.Screen name="MessageThread"    component={MessageThreadScreen}    options={{ title: '' }} />
    </Stack.Navigator>
  );
}
