import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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

interface WorkoutWithDetails extends Workout {
  exercises?: Array<{
    exercise_name?: string;
    name?: string;
    muscle_group?: string;
    sets: Array<{
      reps?: number;
      weight?: number;
    }>;
  }>;
}

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
  const [workoutsWithDetails, setWorkoutsWithDetails] = useState<WorkoutWithDetails[]>([]);
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
      const fetchedWorkouts = response.workouts || [];
      setWorkouts(fetchedWorkouts);

      // Fetch full workout details to get exercises and sets
      const workoutsWithFullDetails = await Promise.all(
        fetchedWorkouts.map(async (workout) => {
          try {
            const workoutDetail = await apiService.getWorkout(workout.id);
            return workoutDetail.workout as WorkoutWithDetails;
          } catch (error) {
            console.error(`Error loading workout ${workout.id}:`, error);
            return workout as WorkoutWithDetails;
          }
        })
      );
      setWorkoutsWithDetails(workoutsWithFullDetails);
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

  // Helper functions
  const formatWeight = (weight: number) => {
    if (!weight || weight <= 0) return '0 lb';
    const isInteger = Number.isInteger(weight);
    return `${isInteger ? weight : weight.toFixed(1)} lb`;
  };

  // Transform workout data to match feed format
  const transformWorkoutForCard = useCallback((workout: Workout) => {
    const workoutDetail = workoutsWithDetails.find(w => w.id === workout.id);
    if (!workoutDetail?.exercises) {
      return {
        exerciseCount: 0,
        totalSets: 0,
        totalVolume: 0,
        muscleGroups: [],
        exercisePreviews: [],
      };
    }

    let totalSets = 0;
    let totalVolume = 0;
    const muscleGroupsSet = new Set<string>();
    const exercisePreviews: Array<{
      name: string;
      set_count: number;
      total_reps: number;
      top_weight: number;
      total_volume: number;
    }> = [];

    workoutDetail.exercises.forEach((exercise) => {
      if (exercise.muscle_group) {
        muscleGroupsSet.add(exercise.muscle_group);
      }

      if (exercise.sets && Array.isArray(exercise.sets)) {
        const setCount = exercise.sets.length;
        totalSets += setCount;
        
        let exerciseTotalReps = 0;
        let exerciseTopWeight = 0;
        let exerciseVolume = 0;

        exercise.sets.forEach((set) => {
          const reps = Number(set.reps) || 0;
          const weight = Number(set.weight) || 0;
          exerciseTotalReps += reps;
          if (weight > exerciseTopWeight) {
            exerciseTopWeight = weight;
          }
          if (reps > 0 && weight > 0) {
            exerciseVolume += reps * weight;
            totalVolume += reps * weight;
          }
        });

        exercisePreviews.push({
          name: exercise.exercise_name || exercise.name || 'Unknown',
          set_count: setCount,
          total_reps: exerciseTotalReps,
          top_weight: exerciseTopWeight,
          total_volume: exerciseVolume,
        });
      }
    });

    return {
      exerciseCount: workoutDetail.exercises.length,
      totalSets,
      totalVolume,
      muscleGroups: Array.from(muscleGroupsSet),
      exercisePreviews: exercisePreviews.slice(0, 3), // Show first 3 exercises
    };
  }, [workoutsWithDetails]);


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
            <View style={styles.workoutsContent}>
              {workouts.map((workout, index) => {
                const workoutData = transformWorkoutForCard(workout);
                
                return (
                  <TouchableOpacity
                    key={workout.id}
                    style={[
                      styles.workoutCard,
                      index % 2 === 1 && styles.workoutCardAlternate,
                    ]}
                    onPress={() =>
                      navigation.navigate('WorkoutDetail' as never, {
                        workoutId: workout.id,
                      } as never)
                    }
                    activeOpacity={0.7}
                  >
                    {/* Workout Title */}
                    <Text style={styles.workoutTitle}>{workout.title}</Text>

                    {/* Workout Details */}
                    <View style={styles.workoutMeta}>
                      <DateDisplay dateString={workout.date} variant="feed" />
                      {workout.duration && (
                        <Text style={styles.workoutMetaText}>
                          • {workout.duration} min
                        </Text>
                      )}
                    </View>

                    {/* Workout Summary Chips */}
                    <View style={styles.chipGrid}>
                      <View style={styles.chip}>
                        <Ionicons name="barbell-outline" size={16} color="#5a6bff" style={styles.chipIcon} />
                        <View style={styles.chipTextContainer}>
                          <Text style={styles.chipLabel}>Exercises</Text>
                          <Text style={styles.chipValue}>{workoutData.exerciseCount || 0}</Text>
                        </View>
                      </View>
                      <View style={styles.chip}>
                        <Ionicons name="repeat-outline" size={16} color="#5a6bff" style={styles.chipIcon} />
                        <View style={styles.chipTextContainer}>
                          <Text style={styles.chipLabel}>Sets</Text>
                          <Text style={styles.chipValue}>{workoutData.totalSets || 0}</Text>
                        </View>
                      </View>
                      {workoutData.totalVolume > 0 ? (
                        <View style={styles.chip}>
                          <Ionicons name="stats-chart-outline" size={16} color="#5a6bff" style={styles.chipIcon} />
                          <View style={styles.chipTextContainer}>
                            <Text style={styles.chipLabel}>Volume</Text>
                            <Text style={styles.chipValue}>
                              {Math.round(workoutData.totalVolume)} lb
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.chipPlaceholder} />
                      )}
                      {(workoutData.muscleGroups && workoutData.muscleGroups.length > 0) ? (
                        <View style={styles.chip}>
                          <Ionicons name="fitness-outline" size={16} color="#5a6bff" style={styles.chipIcon} />
                          <View style={styles.chipTextContainer}>
                            <Text style={styles.chipLabel}>Muscles</Text>
                            <Text style={styles.chipValue} numberOfLines={1}>
                              {workoutData.muscleGroups.slice(0, 2).join(', ')}
                              {workoutData.muscleGroups.length > 2 ? ' +' : ''}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.chipPlaceholder} />
                      )}
                    </View>

                    {/* Workout Notes Preview */}
                    {workout.notes && (
                      <Text style={styles.workoutNotes} numberOfLines={2}>
                        {workout.notes}
                      </Text>
                    )}

                    {/* Exercise Preview List */}
                    {workoutData.exercisePreviews && workoutData.exercisePreviews.length > 0 && (
                      <View style={styles.exercisePreviewContainer}>
                        {workoutData.exercisePreviews.map((exercise, exIndex) => {
                          const isEvenRow = exIndex % 2 === 0;
                          const hasHighWeight = exercise.top_weight > 0;
                          const hasHighReps = exercise.total_reps > 50;
                          
                          return (
                            <View 
                              key={`${workout.id}-exercise-${exIndex}`} 
                              style={[
                                styles.exercisePreviewRow,
                                isEvenRow && styles.exercisePreviewRowEven
                              ]}
                            >
                              <Ionicons name="barbell" size={14} color="#5a6bff" style={styles.exerciseIcon} />
                              <View style={styles.exercisePreviewContent}>
                                <View style={styles.exercisePreviewHeader}>
                                  <View style={styles.exerciseNameContainer}>
                                    <Text style={styles.exercisePreviewName}>{exercise.name}</Text>
                                    {hasHighWeight && (
                                      <View style={styles.prBadge}>
                                        <Text style={styles.prBadgeText}>PR</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={styles.exercisePreviewSets}>{exercise.set_count} sets</Text>
                                </View>
                                <View style={styles.exercisePreviewMeta}>
                                  {exercise.total_reps > 0 ? (
                                    <Text style={[
                                      styles.exercisePreviewMetaText,
                                      hasHighReps && styles.exercisePreviewMetaBlue
                                    ]}>
                                      {exercise.total_reps} reps
                                    </Text>
                                  ) : (
                                    <Text style={styles.exercisePreviewMetaText}>—</Text>
                                  )}
                                  {exercise.top_weight > 0 && (
                                    <Text style={[
                                      styles.exercisePreviewMetaText,
                                      styles.exercisePreviewMetaGreen
                                    ]}>
                                      {' • '}Top {formatWeight(exercise.top_weight)}
                                    </Text>
                                  )}
                                </View>
                              </View>
                            </View>
                          );
                        })}
                        {workoutData.exerciseCount && workoutData.exerciseCount > 3 && (
                          <Text style={styles.exercisePreviewMore}>
                            +{workoutData.exerciseCount - 3} more exercises
                          </Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
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
  workoutsContent: {
    padding: 0,
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#e5e7eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  workoutCardAlternate: {
    backgroundColor: '#fafafa',
  },
  workoutTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutMetaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
    fontWeight: '400',
  },
  workoutNotes: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
    fontWeight: '300',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    marginHorizontal: -6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  chipPlaceholder: {
    width: '48%',
    marginHorizontal: '1%',
  },
  chipIcon: {
    marginRight: 8,
  },
  chipTextContainer: {
    flex: 1,
  },
  chipLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#6b7280',
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  chipValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  exercisePreviewContainer: {
    borderWidth: 1,
    borderColor: '#eef0f5',
    borderRadius: 12,
    padding: 8,
    backgroundColor: '#fafbff',
    marginBottom: 12,
  },
  exercisePreviewRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  exercisePreviewRowEven: {
    backgroundColor: '#f5f7ff',
  },
  exerciseIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  exercisePreviewContent: {
    flex: 1,
  },
  exercisePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  exercisePreviewName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginRight: 6,
  },
  prBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  prBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.3,
  },
  exercisePreviewSets: {
    fontSize: 13,
    color: '#667085',
    fontWeight: '500',
  },
  exercisePreviewMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  exercisePreviewMetaText: {
    fontSize: 13,
    color: '#667085',
  },
  exercisePreviewMetaBlue: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  exercisePreviewMetaGreen: {
    color: '#10b981',
    fontWeight: '600',
  },
  exercisePreviewMore: {
    marginTop: 4,
    fontSize: 12,
    color: '#5a6bff',
    fontWeight: '600',
  },
});

