import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import DateDisplay from '../../components/DateDisplay';
import ExerciseTutorialButton from '../../components/ExerciseTutorialButton';

type WorkoutDetailRouteParams = {
  WorkoutDetail: {
    workoutId: number;
  };
};

interface Exercise {
  exercise_id: number;
  exercise_name: string;
  exercise_description?: string;
  muscle_group: string;
  equipment_type: string;
  sets: Set[];
}

interface Set {
  id: number;
  set_number: number;
  reps?: number;
  weight?: number;
  rest_time?: number;
  notes?: string;
}

interface WorkoutDetail {
  id: number;
  user_id: number;
  title: string;
  date: string;
  duration?: number;
  notes?: string;
  is_public: boolean;
  created_at: string;
  exercises?: Exercise[];
}

export default function WorkoutDetailScreen() {
  const route = useRoute<RouteProp<WorkoutDetailRouteParams, 'WorkoutDetail'>>();
  const navigation = useNavigation();
  const { workoutId } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadWorkout = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getWorkout(workoutId);
      // The backend returns workout with exercises nested
      setWorkout(response.workout as any);
    } catch (error) {
      console.error('Error loading workout:', error);
      Alert.alert('Error', 'Failed to load workout details');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  }, [workoutId, navigation]);

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  useFocusEffect(
    useCallback(() => {
      loadWorkout();
    }, [loadWorkout])
  );

  const confirmDelete = () => {
    if (!workout || isDeleting) return;
    Alert.alert(
      'Delete workout?',
      'This workout and all of its exercises and sets will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isDeleting ? 'Deleting...' : 'Delete',
          style: 'destructive',
          onPress: handleDelete,
        },
      ]
    );
  };

  const handleDelete = async () => {
    if (!workout) return;
    try {
      setIsDeleting(true);
      await apiService.deleteWorkout(workout.id);
      Alert.alert('Workout deleted', 'Your workout has been removed.');
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting workout:', error);
      Alert.alert('Error', 'Failed to delete workout. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };


  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading workout...</Text>
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={styles.container}>
        <Text>Workout not found</Text>
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
        <Text style={styles.headerTitle}>Workout Details</Text>
        {user?.id === workout.user_id ? (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('EditWorkout' as never, { workoutId: workout.id } as never)}
            >
              <Text style={[styles.headerButton, styles.editButtonText]}>
                Edit
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={confirmDelete}
              disabled={isDeleting}
            >
              <Text style={[styles.headerButton, styles.deleteButtonText]}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Workout Info */}
        <View style={styles.workoutInfoCard}>
          <View style={styles.workoutHeader}>
            <Text style={styles.workoutTitle}>{workout.title}</Text>
            <View style={styles.workoutBadge}>
              <Text style={styles.workoutBadgeText}>
                {workout.is_public ? 'Public' : 'Private'}
              </Text>
            </View>
          </View>
          
          <DateDisplay dateString={workout.date} variant="list" />
          
          {workout.duration && (
            <Text style={styles.workoutDetail}>
              Duration: {workout.duration} minutes
            </Text>
          )}
          
          {workout.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes:</Text>
              <Text style={styles.notesText}>{workout.notes}</Text>
            </View>
          )}
        </View>

        {/* Exercises Section */}
        <View style={styles.exercisesSection}>
          <Text style={styles.sectionTitle}>
            Exercises ({workout.exercises?.length || 0})
          </Text>
          
          {!workout.exercises || workout.exercises.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No exercises in this workout</Text>
            </View>
          ) : (
            workout.exercises.map((exercise, index) => (
              <View key={exercise.exercise_id || index} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseNumber}>{index + 1}</Text>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {exercise.muscle_group} • {exercise.equipment_type}
                    </Text>
                  </View>
                </View>
                
                {exercise.exercise_description && (
                  <Text style={styles.exerciseDescription}>
                    {exercise.exercise_description}
                  </Text>
                )}

                <ExerciseTutorialButton
                  exerciseName={exercise.exercise_name}
                  muscleGroup={exercise.muscle_group}
                  equipmentType={exercise.equipment_type}
                  style={styles.tutorialButton}
                />

                {/* Sets */}
                {exercise.sets && exercise.sets.length > 0 && (
                  <View style={styles.setsContainer}>
                    <Text style={styles.setsLabel}>Sets:</Text>
                    <View style={styles.setsTable}>
                      <View style={styles.setsHeader}>
                        <Text style={styles.setHeaderText}>Set</Text>
                        <Text style={styles.setHeaderText}>Reps</Text>
                        <Text style={styles.setHeaderText}>Weight</Text>
                        {exercise.sets.some(s => s.rest_time) && (
                          <Text style={styles.setHeaderText}>Rest</Text>
                        )}
                      </View>
                      {exercise.sets.map((set) => (
                        <View key={set.id} style={styles.setRow}>
                          <Text style={styles.setCell}>{set.set_number}</Text>
                          <Text style={styles.setCell}>
                            {set.reps || '-'}
                          </Text>
                          <Text style={styles.setCell}>
                            {set.weight ? `${set.weight} lbs` : '-'}
                          </Text>
                          {exercise.sets.some(s => s.rest_time) && (
                            <Text style={styles.setCell}>
                              {set.rest_time ? `${set.rest_time}s` : '-'}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  editButtonText: {
    color: '#007AFF',
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteButtonText: {
    color: '#d93025',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  workoutInfoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
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
    marginBottom: 12,
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  workoutBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 12,
  },
  workoutBadgeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  workoutDate: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  workoutDetail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  notesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  exercisesSection: {
    marginBottom: 20,
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
  exerciseCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  exerciseHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  exerciseNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginRight: 12,
    width: 30,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  exerciseMeta: {
    fontSize: 14,
    color: '#666',
  },
  exerciseDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  tutorialButton: {
    marginBottom: 12,
  },
  setsContainer: {
    marginTop: 8,
  },
  setsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  setsTable: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  setsHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  setHeaderText: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  setCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
