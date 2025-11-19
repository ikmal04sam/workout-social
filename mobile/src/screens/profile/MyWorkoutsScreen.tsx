import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { apiService, Workout } from '../../services/api';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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

export default function MyWorkoutsScreen() {
  const navigation = useNavigation<any>();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutsWithDetails, setWorkoutsWithDetails] = useState<WorkoutWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadWorkouts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getUserWorkouts();
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
        <View style={styles.content}>
          {workouts.map((workout, index) => {
            const workoutData = transformWorkoutForCard(workout);
            
            return (
              <TouchableOpacity
                key={workout.id}
                style={[
                  styles.workoutCard,
                  index % 2 === 1 && styles.workoutCardAlternate,
                ]}
                onPress={() => handleWorkoutPress(workout.id)}
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
  content: {
    padding: 16,
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

