import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Image } from 'react-native';

// Import your screens
import OnboardingScreen, { checkOnboardingStatus } from './src/screens/onboarding/OnboardingScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';
import WorkoutDetailScreen from './src/screens/workout/WorkoutDetailScreen';
import EditWorkoutScreen from './src/screens/workout/EditWorkoutScreen';
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
  const [showSplash, setShowSplash] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [startTime] = useState(() => Date.now());

  useEffect(() => {
    // Check onboarding status
    // TEMPORARY: Force onboarding to show for testing
    // checkOnboardingStatus().then((completed) => {
    //   setHasSeenOnboarding(completed);
    // });
    setHasSeenOnboarding(false); // Force show onboarding

    // Minimum splash screen display time (2 seconds)
    const minDisplayTime = 2000;

    if (!isLoading) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minDisplayTime - elapsed);

      const timer = setTimeout(() => {
        setShowSplash(false);
      }, remaining);

      return () => clearTimeout(timer);
    }
  }, [isLoading, startTime]);

  // Keep showing splash until both auth is loaded, onboarding status is checked, and minimum time has passed
  if (isLoading || showSplash || hasSeenOnboarding === null) {
    return (
      <View style={styles.loadingContainer}>
        <Image 
          source={require('./assets/icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    );
  }

  // Determine initial route
  let initialRoute = "Login";
  if (isAuthenticated) {
    initialRoute = "Main";
  } else if (!hasSeenOnboarding) {
    initialRoute = "Onboarding";
  }

  return (
    <Stack.Navigator 
      initialRouteName={initialRoute}
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
            name="EditWorkout" 
            component={EditWorkoutScreen}
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
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
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
    backgroundColor: '#ffffff',
  },
  logo: {
    width: 150,
    height: 150,
  },
});
