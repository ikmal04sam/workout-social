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
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
  like_count: string;
  comment_count: string;
  is_liked?: boolean;
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

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Your Feed</Text>
        <Text style={styles.subtitle}>Workouts from people you follow</Text>
      </View>
      
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
          {workouts.map((workout) => (
            <TouchableOpacity
              key={workout.id}
              style={styles.workoutCard}
              onPress={() => navigation.navigate('WorkoutDetail' as never, { workoutId: workout.id } as never)}
              activeOpacity={0.7}
            >
              {/* User Info */}
              <View style={styles.userInfo}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {workout.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userDetails}>
                  <Text style={styles.username}>{workout.username}</Text>
                  <Text style={styles.workoutTime}>{formatDate(workout.created_at)}</Text>
                </View>
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

              {/* Workout Notes Preview */}
              {workout.notes && (
                <Text style={styles.workoutNotes} numberOfLines={2}>
                  {workout.notes}
                </Text>
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
                  <Text style={[
                    styles.actionIcon,
                    workout.is_liked && styles.likedIcon
                  ]}>
                    {workout.is_liked ? '❤️' : '🤍'}
                  </Text>
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
                    // TODO: Navigate to comments
                  }}
                >
                  <Text style={styles.actionIcon}>💬</Text>
                  <Text style={styles.actionText}>{workout.comment_count}</Text>
                </TouchableOpacity>

                <View style={styles.actionSpacer} />
              </View>
            </TouchableOpacity>
          ))}
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
    fontSize: 20,
    marginRight: 6,
  },
  likedIcon: {
    // Heart emoji already red when liked
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
