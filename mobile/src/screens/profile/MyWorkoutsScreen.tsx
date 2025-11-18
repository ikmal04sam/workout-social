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
            activeOpacity={0.7}
          >
            <View style={styles.workoutContent}>
              <View style={styles.workoutMain}>
                <View style={styles.workoutHeader}>
                  <Text style={styles.workoutTitle} numberOfLines={1}>
                    {workout.title}
                  </Text>
                  <View style={[styles.badge, workout.is_public ? styles.publicBadge : styles.privateBadge]}>
                    <Text style={[styles.badgeText, workout.is_public ? styles.publicBadgeText : styles.privateBadgeText]}>
                      {workout.is_public ? 'Public' : 'Private'}
                    </Text>
                  </View>
                </View>
                {workout.duration && (
                  <Text style={styles.workoutMeta}>Duration: {workout.duration} min</Text>
                )}
                {workout.notes ? (
                  <Text style={styles.workoutNotes} numberOfLines={2}>
                    {workout.notes}
                  </Text>
                ) : null}
              </View>
              <View style={styles.dateContainer}>
                <DateDisplay dateString={workout.date} variant="list" />
              </View>
            </View>
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
    marginVertical: 8,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  workoutContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workoutMain: {
    flex: 1,
    marginRight: 16,
    minWidth: 0,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 0,
  },
  publicBadge: {
    backgroundColor: '#E3F2FD',
  },
  privateBadge: {
    backgroundColor: '#fdecea',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  publicBadgeText: {
    color: '#0A84FF',
  },
  privateBadgeText: {
    color: '#d93025',
  },
  dateContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexShrink: 0,
  },
  workoutMeta: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
    fontWeight: '500',
  },
  workoutNotes: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 20,
  },
});

