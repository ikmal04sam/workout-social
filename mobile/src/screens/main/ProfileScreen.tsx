import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { apiService, Workout } from '../../services/api';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, logout, isLoading: authLoading } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWorkouts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getUserWorkouts();
      setWorkouts(response.workouts || []);
    } catch (error) {
      console.error('Error loading workouts:', error);
      Alert.alert('Error', 'Failed to load workouts');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load workouts when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadWorkouts();
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: logout
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Your fitness journey</Text>
      </View>
      
      <View style={styles.content}>
        <View style={styles.profileCard}>
          {/* Profile Picture */}
          <View style={styles.profilePicContainer}>
            {user?.profile_pic ? (
              <Image
                source={{
                  uri: user.profile_pic.startsWith('data:') 
                    ? user.profile_pic 
                    : `data:image/jpeg;base64,${user.profile_pic}`
                }}
                style={styles.profilePic}
              />
            ) : (
              <View style={styles.profilePicPlaceholder}>
                <Text style={styles.profilePicPlaceholderText}>
                  {user?.username?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.username}>{user?.username || 'Loading...'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
          <Text style={styles.bio}>{user?.bio || 'No bio yet'}</Text>
          <Text style={styles.memberSince}>
            Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : ''}
          </Text>

          {/* Edit Button */}
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProfile' as never)}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Workouts Section */}
        <View style={styles.workoutsSection}>
          <Text style={styles.sectionTitle}>My Workouts ({workouts.length})</Text>
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading workouts...</Text>
            </View>
          ) : workouts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No workouts yet</Text>
              <Text style={styles.emptySubtext}>Create your first workout to get started!</Text>
            </View>
          ) : (
            workouts.map((workout) => (
              <TouchableOpacity 
                key={workout.id} 
                style={styles.workoutCard}
                onPress={() => navigation.navigate('WorkoutDetail' as never, { workoutId: workout.id } as never)}
              >
                <View style={styles.workoutHeader}>
                  <Text style={styles.workoutTitle}>{workout.title}</Text>
                  <View style={styles.workoutBadge}>
                    <Text style={styles.workoutBadgeText}>
                      {workout.is_public ? 'Public' : 'Private'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.workoutDate}>{formatDate(workout.date)}</Text>
                {workout.duration && (
                  <Text style={styles.workoutDuration}>Duration: {workout.duration} min</Text>
                )}
                {workout.notes && (
                  <Text style={styles.workoutNotes} numberOfLines={2}>
                    {workout.notes}
                  </Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
        
        <TouchableOpacity 
          style={[styles.button, authLoading && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={authLoading}
        >
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  content: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  profilePicContainer: {
    marginBottom: 16,
  },
  profilePic: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e0e0e0',
  },
  profilePicPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicPlaceholderText: {
    color: 'white',
    fontSize: 40,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  bio: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  memberSince: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 8,
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  workoutsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  emptyContainer: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 8,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  workoutCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  workoutBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  workoutBadgeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  workoutDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  workoutDuration: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  workoutNotes: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
