import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import HomeScreen from '../screens/main/HomeScreen';
import DiscoverScreen from '../screens/main/DiscoverScreen';
import ProgressScreen from '../screens/progress/ProgressScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import CreateWorkoutScreen from '../screens/workout/CreateWorkoutScreen';

const Tab = createBottomTabNavigator();

// Discover button component for header
function DiscoverHeaderButton() {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      style={headerStyles.searchButton}
      onPress={() => navigation.navigate('Discover' as never)}
      activeOpacity={0.7}
    >
      <Ionicons name="search" size={18} color="#007AFF" />
    </TouchableOpacity>
  );
}

// Profile button component for header
function ProfileHeaderButton() {
  const navigation = useNavigation();
  const { user } = useAuth();

  return (
    <TouchableOpacity
      style={headerStyles.profileButton}
      onPress={() => {
        navigation.navigate('You' as never);
      }}
      activeOpacity={0.7}
    >
      {user?.profile_pic ? (
        <Image
          source={{
            uri: user.profile_pic.startsWith('data:') 
              ? user.profile_pic 
              : `data:image/jpeg;base64,${user.profile_pic}`
          }}
          style={headerStyles.profilePic}
        />
      ) : (
        <View style={headerStyles.profilePicPlaceholder}>
          <Text style={headerStyles.profilePicText}>
            {user?.username?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          height: 85,
          paddingBottom: 25,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 8,
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: 'white',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 3,
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          headerTitle: 'Your Feed',
          headerLeft: () => <DiscoverHeaderButton />,
          headerLeftContainerStyle: {
            paddingLeft: 16,
          },
          headerRight: () => <ProfileHeaderButton />,
          headerRightContainerStyle: {
            paddingRight: 16,
          },
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Discover" 
        component={DiscoverScreen}
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Record" 
        component={CreateWorkoutScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: () => (
            <View style={styles.recordFab} accessibilityLabel="Create workout">
              <Ionicons name="add" size={32} color="white" />
            </View>
          ),
        }}
      />
      <Tab.Screen 
        name="Progress" 
        component={ProgressScreen}
        options={{
          tabBarLabel: 'Progress',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="You" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'You',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  recordFab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    backgroundColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
});

const headerStyles = StyleSheet.create({
  profileButton: {
    marginRight: 4,
    marginTop: -6,
  },
  profilePic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e0e0',
  },
  profilePicPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
  searchButton: {
    width: 36,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f4ff',
    borderRadius: 18,
    marginBottom: 0,
    marginTop: -6,
  },
});
