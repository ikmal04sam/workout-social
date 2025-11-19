import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  Animated,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService, Workout } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import DateDisplay from '../../components/DateDisplay';

type UserProfileRouteParams = {
  UserProfile: {
    userId: number;
  };
};

interface UserProfile {
  id: number;
  username: string;
  bio?: string;
  created_at: string;
  follower_count: string;
  following_count: string;
  is_following: boolean;
}

export default function UserProfileScreen() {
  const route = useRoute<RouteProp<UserProfileRouteParams, 'UserProfile'>>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const { userId } = route.params;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [following, setFollowing] = useState(false);
  const [isFollowingAction, setIsFollowingAction] = useState(false);
  const animatedValues = useRef<Record<string, Animated.Value>>({
    workouts: new Animated.Value(1),
    followers: new Animated.Value(1),
    following: new Animated.Value(1),
  });

  const loadUserProfile = useCallback(async () => {
    try {
      const response = await apiService.getUserProfile(userId);
      const userData = response.user;
      setUser({
        ...userData,
        follower_count: parseInt(userData.follower_count) || 0,
        following_count: parseInt(userData.following_count) || 0,
        is_following: userData.is_following === true || userData.is_following === 'true',
      });
      setFollowing(userData.is_following === true || userData.is_following === 'true');
    } catch (error) {
      console.error('Error loading user profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
      navigation.goBack();
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [userId, navigation]);

  const loadWorkouts = useCallback(async () => {
    try {
      setIsLoadingWorkouts(true);
      const response = await apiService.getUserWorkoutsByUserId(userId);
      setWorkouts(response.workouts || []);
    } catch (error) {
      console.error('Error loading workouts:', error);
    } finally {
      setIsLoadingWorkouts(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUserProfile();
    loadWorkouts();
  }, [loadUserProfile, loadWorkouts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadUserProfile();
    loadWorkouts();
  };

  const handleStatPress = (statType: 'workouts' | 'followers' | 'following') => {
    // Add press animation
    Animated.sequence([
      Animated.spring(animatedValues.current[statType], {
        toValue: 0.95,
        useNativeDriver: true,
      }),
      Animated.spring(animatedValues.current[statType], {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate based on stat type
    if (statType === 'followers') {
      // Could navigate to followers list if implemented
    } else if (statType === 'following') {
      // Could navigate to following list if implemented
    }
  };

  const handleFollow = async () => {
    if (isFollowingAction || !user) return;

    setIsFollowingAction(true);
    const wasFollowing = following;

    try {
      // Optimistic update
      setFollowing(!following);
      if (user) {
        setUser({
          ...user,
          follower_count: following ? user.follower_count - 1 : user.follower_count + 1,
          is_following: !following,
        });
      }

      if (wasFollowing) {
        await apiService.unfollowUser(userId);
      } else {
        await apiService.followUser(userId);
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      // Revert optimistic update
      setFollowing(wasFollowing);
      if (user) {
        setUser({
          ...user,
          follower_count: wasFollowing ? user.follower_count + 1 : user.follower_count - 1,
          is_following: wasFollowing,
        });
      }
      Alert.alert('Error', error.message || 'Failed to update follow status');
    } finally {
      setIsFollowingAction(false);
    }
  };


  const isOwnProfile = currentUser?.id === userId;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>User not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* User Info Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {user.profile_pic ? (
              <Image
                source={{
                  uri: user.profile_pic.startsWith('data:') 
                    ? user.profile_pic 
                    : `data:image/jpeg;base64,${user.profile_pic}`
                }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.username}>{user.username}</Text>

          {user.bio && (
            <Text style={styles.bio}>{user.bio}</Text>
          )}

          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={styles.statItem}
              activeOpacity={0.7}
              onPress={() => handleStatPress('workouts')}
            >
              <Animated.View
                style={[
                  styles.statItemContent,
                  { transform: [{ scale: animatedValues.current.workouts }] },
                ]}
              >
                <View style={[styles.statIconContainer, { backgroundColor: '#0A84FF15' }]}>
                  <Ionicons name="barbell" size={20} color="#0A84FF" />
                </View>
                <Text style={styles.statValue}>{workouts.length}</Text>
                <Text style={styles.statLabel}>WORKOUTS</Text>
              </Animated.View>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              style={styles.statItem}
              activeOpacity={0.7}
              onPress={() => handleStatPress('followers')}
            >
              <Animated.View
                style={[
                  styles.statItemContent,
                  { transform: [{ scale: animatedValues.current.followers }] },
                ]}
              >
                <View style={[styles.statIconContainer, { backgroundColor: '#10B98115' }]}>
                  <Ionicons name="people" size={20} color="#10B981" />
                </View>
                <Text style={styles.statValue}>{user.follower_count}</Text>
                <Text style={styles.statLabel}>FOLLOWERS</Text>
              </Animated.View>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              style={styles.statItem}
              activeOpacity={0.7}
              onPress={() => handleStatPress('following')}
            >
              <Animated.View
                style={[
                  styles.statItemContent,
                  { transform: [{ scale: animatedValues.current.following }] },
                ]}
              >
                <View style={[styles.statIconContainer, { backgroundColor: '#8B5CF615' }]}>
                  <Ionicons name="person-add" size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.statValue}>{user.following_count}</Text>
                <Text style={styles.statLabel}>FOLLOWING</Text>
              </Animated.View>
            </TouchableOpacity>
          </View>

          {!isOwnProfile && (
            <TouchableOpacity
              style={[
                styles.followButton,
                following && styles.followingButton,
                isFollowingAction && styles.followButtonDisabled,
              ]}
              onPress={handleFollow}
              disabled={isFollowingAction}
            >
              <Text style={[
                styles.followButtonText,
                following && styles.followingButtonText,
              ]}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.memberSinceContainer}>
            <Text style={styles.memberSince}>Member since </Text>
            <DateDisplay dateString={user.created_at} variant="list" />
          </View>
        </View>

        {/* Workouts Section */}
        <View style={styles.workoutsSection}>
          <Text style={styles.sectionTitle}>
            Public Workouts ({workouts.length})
          </Text>

          {isLoadingWorkouts ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : workouts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No public workouts yet</Text>
            </View>
          ) : (
            workouts.map((workout) => (
              <TouchableOpacity
                key={workout.id}
                style={styles.workoutCard}
                onPress={() =>
                  navigation.navigate('WorkoutDetail' as never, {
                    workoutId: workout.id,
                  } as never)
                }
              >
                <View style={styles.workoutHeader}>
                  <Text style={styles.workoutTitle}>{workout.title}</Text>
                </View>
                <DateDisplay dateString={workout.date} variant="list" />
                {workout.duration && (
                  <Text style={styles.workoutDuration}>
                    Duration: {workout.duration} min
                  </Text>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: 'white',
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 24,
    marginBottom: 20,
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statItemContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  followButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 16,
    minWidth: 120,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  followButtonDisabled: {
    opacity: 0.6,
  },
  followButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#333',
  },
  memberSinceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberSince: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  workoutsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  emptyContainer: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  workoutCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
});

