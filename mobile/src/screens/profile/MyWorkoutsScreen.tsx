import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { apiService, Workout } from '../../services/api';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DateDisplay from '../../components/DateDisplay';

export default function MyWorkoutsScreen() {
  const navigation = useNavigation<any>();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadWorkouts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getUserWorkouts();
      setWorkouts(response.workouts || []);
    } catch (error) {
      console.error('Error loading workouts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts])
  );

  const handleWorkoutPress = useCallback(
    (workoutId: number) => {
      navigation.navigate('WorkoutDetail' as never, { workoutId } as never);
    },
    [navigation]
  );


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading workouts...</Text>
        </View>
      ) : workouts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No workouts yet</Text>
          <Text style={styles.emptySubtext}>Create a workout to get started.</Text>
        </View>
      ) : (
        workouts.map((workout) => (
          <TouchableOpacity
            key={workout.id}
            style={styles.workoutCard}
            onPress={() => handleWorkoutPress(workout.id)}
          >
            <View style={styles.workoutHeader}>
              <Text style={styles.workoutTitle}>{workout.title}</Text>
              <View style={[styles.badge, workout.is_public ? styles.publicBadge : styles.privateBadge]}>
                <Text style={[styles.badgeText, workout.is_public ? styles.publicBadgeText : styles.privateBadgeText]}>
                  {workout.is_public ? 'Public' : 'Private'}
                </Text>
              </View>
            </View>
            <DateDisplay dateString={workout.date} />
            {workout.duration && (
              <Text style={styles.workoutMeta}>Duration: {workout.duration} min</Text>
            )}
            {workout.notes ? (
              <Text style={styles.workoutNotes} numberOfLines={2}>
                {workout.notes}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    paddingTop: 48,
    paddingBottom: 32,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  workoutCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
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
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  publicBadge: {
    backgroundColor: '#E3F2FD',
  },
  privateBadge: {
    backgroundColor: '#fdecea',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  publicBadgeText: {
    color: '#0A84FF',
  },
  privateBadgeText: {
    color: '#d93025',
  },
  workoutMeta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  workoutNotes: {
    fontSize: 14,
    color: '#888',
    marginTop: 6,
  },
});

