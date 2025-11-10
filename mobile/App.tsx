import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Import your screens
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';
import WorkoutDetailScreen from './src/screens/workout/WorkoutDetailScreen';
import CommentsScreen from './src/screens/workout/CommentsScreen';
import UserProfileScreen from './src/screens/user/UserProfileScreen';
import EditProfileScreen from './src/screens/user/EditProfileScreen';
import FollowersScreen from './src/screens/profile/FollowersScreen';
import FollowingScreen from './src/screens/profile/FollowingScreen';
import MyWorkoutsScreen from './src/screens/profile/MyWorkoutsScreen';
import ExerciseProgressScreen from './src/screens/progress/ExerciseProgressScreen';

// Import AuthContext
import { AuthProvider, useAuth } from './src/contexts/AuthContext';

const Stack = createStackNavigator();

function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack.Navigator 
      initialRouteName={isAuthenticated ? "Main" : "Login"}
      screenOptions={{ headerShown: false }}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen 
            name="WorkoutDetail" 
            component={WorkoutDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Comments" 
            component={CommentsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="UserProfile" 
            component={UserProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="EditProfile" 
            component={EditProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Followers"
            component={FollowersScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Following"
            component={FollowingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="MyWorkoutsList"
            component={MyWorkoutsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ExerciseProgress"
            component={ExerciseProgressScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
