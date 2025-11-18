import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';

interface FeedWorkout {
  id: number;
  title: string;
  date: string;
  duration?: number;
  notes?: string;
  is_public: boolean;
  created_at: string;
  user_id: number;
  username: string;
  bio?: string;
  profile_pic?: string | null;
  like_count: number;
  comment_count: number;
  is_liked?: boolean;
  exercise_count?: number;
  total_sets?: number;
  total_volume?: number;
  muscle_groups?: string[];
  exercise_previews?: ExercisePreview[];
}

interface ExercisePreview {
  name: string;
  set_count: number;
  total_reps: number;
  top_weight: number;
  total_volume: number;
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const [workouts, setWorkouts] = useState<FeedWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likingWorkoutId, setLikingWorkoutId] = useState<number | null>(null);

  const loadWorkouts = useCallback(async () => {
    try {
      const response = await apiService.getFeed();
      // Convert counts from strings to numbers and ensure is_liked is boolean
      const formattedWorkouts = response.feed.map((w: any) => ({
        ...w,
        like_count: parseInt(w.like_count) || 0,
        comment_count: parseInt(w.comment_count) || 0,
        is_liked: w.is_liked === true || w.is_liked === 'true',
        profile_pic: typeof w.profile_pic === 'string' && w.profile_pic.length > 0 ? w.profile_pic : null,
        exercise_count: w.exercise_count !== undefined ? parseInt(w.exercise_count) || 0 : 0,
        total_sets: w.total_sets !== undefined ? parseInt(w.total_sets) || 0 : 0,
        total_volume: w.total_volume !== undefined ? parseInt(w.total_volume) || 0 : 0,
        muscle_groups: Array.isArray(w.muscle_groups) ? w.muscle_groups : [],
        exercise_previews: Array.isArray(w.exercise_previews)
          ? w.exercise_previews.map((preview: any) => ({
              name: preview?.name || 'Exercise',
              set_count: parseInt(preview?.set_count) || 0,
              total_reps: parseInt(preview?.total_reps) || 0,
              top_weight: parseFloat(preview?.top_weight) || 0,
              total_volume: parseFloat(preview?.total_volume) || 0,
            }))
          : [],
      }));
      setWorkouts(formattedWorkouts);
    } catch (error) {
      console.error('Error loading feed:', error);
      Alert.alert('Error', 'Failed to load feed');
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

  const handleLike = async (workoutId: number, isLiked: boolean) => {
    if (likingWorkoutId) return; // Prevent multiple rapid clicks
    
    setLikingWorkoutId(workoutId);
    try {
      if (isLiked) {
        await apiService.unlikeWorkout(workoutId);
        // Update local state optimistically
        setWorkouts(prev => prev.map(w => 
          w.id === workoutId 
            ? { ...w, is_liked: false, like_count: Math.max(0, w.like_count - 1) }
            : w
        ));
      } else {
        await apiService.likeWorkout(workoutId);
        // Update local state optimistically
        setWorkouts(prev => prev.map(w => 
          w.id === workoutId 
            ? { ...w, is_liked: true, like_count: w.like_count + 1 }
            : w
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Reload to get accurate state
      loadWorkouts();
    } finally {
      setLikingWorkoutId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const formatWeight = (weight: number) => {
    if (!weight || weight <= 0) return '0 lb';
    const isInteger = Number.isInteger(weight);
    return `${isInteger ? weight : weight.toFixed(1)} lb`;
  };

  const getProfileImageUri = (profilePic?: string | null) => {
    if (!profilePic) return null;
    return profilePic.startsWith('data:') ? profilePic : `data:image/jpeg;base64,${profilePic}`;
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      ) : workouts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No workouts yet</Text>
          <Text style={styles.emptySubtext}>
            Follow some users to see their workouts here!
          </Text>
          <Text style={styles.emptyHint}>
            Check out the Discover tab to find users to follow
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          {workouts.map((workout) => {
            const profileImageUri = getProfileImageUri(workout.profile_pic);

            return (
              <TouchableOpacity
              key={workout.id}
              style={styles.workoutCard}
              onPress={() => navigation.navigate('WorkoutDetail' as never, { workoutId: workout.id } as never)}
              activeOpacity={0.7}
            >
              {/* User Info */}
              <View style={styles.userInfo}>
                <TouchableOpacity
                  style={styles.userAvatar}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate('UserProfile' as never, {
                      userId: workout.user_id,
                    } as never);
                  }}
                >
                  {profileImageUri ? (
                    <Image source={{ uri: profileImageUri }} style={styles.userAvatarImage} />
                  ) : (
                    <Text style={styles.userAvatarText}>
                      {workout.username.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.userDetails}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate('UserProfile' as never, {
                      userId: workout.user_id,
                    } as never);
                  }}
                >
                  <Text style={styles.username}>{workout.username}</Text>
                  <Text style={styles.workoutTime}>{formatDate(workout.created_at)}</Text>
                </TouchableOpacity>
              </View>

              {/* Workout Title */}
              <Text style={styles.workoutTitle}>{workout.title}</Text>

              {/* Workout Details */}
              <View style={styles.workoutMeta}>
                <Text style={styles.workoutDate}>
                  {new Date(workout.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
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
                    <Text style={styles.chipValue}>{workout.exercise_count || 0}</Text>
                  </View>
                </View>
                <View style={styles.chip}>
                  <Ionicons name="repeat-outline" size={16} color="#5a6bff" style={styles.chipIcon} />
                  <View style={styles.chipTextContainer}>
                    <Text style={styles.chipLabel}>Sets</Text>
                    <Text style={styles.chipValue}>{workout.total_sets || 0}</Text>
                  </View>
                </View>
                {workout.total_volume ? (
                  <View style={styles.chip}>
                    <Ionicons name="stats-chart-outline" size={16} color="#5a6bff" style={styles.chipIcon} />
                    <View style={styles.chipTextContainer}>
                      <Text style={styles.chipLabel}>Volume</Text>
                      <Text style={styles.chipValue}>
                        {Math.round(workout.total_volume)} lb
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.chipPlaceholder} />
                )}
                {(workout.muscle_groups && workout.muscle_groups.length > 0) ? (
                  <View style={styles.chip}>
                    <Ionicons name="fitness-outline" size={16} color="#5a6bff" style={styles.chipIcon} />
                    <View style={styles.chipTextContainer}>
                      <Text style={styles.chipLabel}>Muscles</Text>
                      <Text style={styles.chipValue} numberOfLines={1}>
                        {workout.muscle_groups.slice(0, 2).join(', ')}
                        {workout.muscle_groups.length > 2 ? ' +' : ''}
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
              {workout.exercise_previews && workout.exercise_previews.length > 0 && (
                <View style={styles.exercisePreviewContainer}>
                  {workout.exercise_previews.map((exercise, index) => (
                    <View key={`${workout.id}-exercise-${index}`} style={styles.exercisePreviewRow}>
                      <View style={styles.exercisePreviewHeader}>
                        <Text style={styles.exercisePreviewName}>{exercise.name}</Text>
                        <Text style={styles.exercisePreviewSets}>{exercise.set_count} sets</Text>
                      </View>
                      <Text style={styles.exercisePreviewMeta}>
                        {exercise.total_reps > 0 ? `${exercise.total_reps} reps` : '—'}
                        {exercise.top_weight > 0 ? ` • Top ${formatWeight(exercise.top_weight)}` : ''}
                      </Text>
                    </View>
                  ))}
                  {workout.exercise_count && workout.exercise_count > 3 && (
                    <Text style={styles.exercisePreviewMore}>
                      +{workout.exercise_count - 3} more exercises
                    </Text>
                  )}
                </View>
              )}

              {/* Social Actions */}
              <View style={styles.socialActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleLike(workout.id, workout.is_liked || false);
                  }}
                  disabled={likingWorkoutId === workout.id}
                >
                  <Ionicons 
                    name={workout.is_liked ? "heart" : "heart-outline"} 
                    size={20} 
                    color={workout.is_liked ? "#FF3B30" : "#666"} 
                    style={styles.actionIcon}
                  />
                  <Text style={[
                    styles.actionText,
                    workout.is_liked && styles.likedText
                  ]}>
                    {workout.like_count}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate('Comments' as never, { 
                      workoutId: workout.id,
                      workoutTitle: workout.title 
                    } as never);
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={20} color="#666" style={styles.actionIcon} />
                  <Text style={styles.actionText}>{workout.comment_count}</Text>
                </TouchableOpacity>

                <View style={styles.actionSpacer} />
              </View>
            </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
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
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 10,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  content: {
    padding: 16,
  },
  workoutCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  workoutTime: {
    fontSize: 12,
    color: '#999',
  },
  workoutTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutDate: {
    fontSize: 14,
    color: '#666',
  },
  workoutMetaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  workoutNotes: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
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
    padding: 12,
    backgroundColor: '#fafbff',
    marginBottom: 12,
  },
  exercisePreviewRow: {
    marginBottom: 10,
  },
  exercisePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exercisePreviewName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  exercisePreviewSets: {
    fontSize: 13,
    color: '#667085',
    fontWeight: '500',
  },
  exercisePreviewMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#667085',
  },
  exercisePreviewMore: {
    marginTop: 4,
    fontSize: 12,
    color: '#5a6bff',
    fontWeight: '600',
  },
  socialActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionIcon: {
    marginRight: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  likedText: {
    color: '#FF3B30',
  },
  actionSpacer: {
    flex: 1,
  },
});
