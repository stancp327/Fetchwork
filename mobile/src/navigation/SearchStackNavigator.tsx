import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SearchStackParamList } from '../types/navigation';
import UniversalSearchScreen from '../screens/Search/UniversalSearchScreen';

const Stack = createNativeStackNavigator<SearchStackParamList>();

export default function SearchStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UniversalSearch" component={UniversalSearchScreen} />
    </Stack.Navigator>
  );
}
