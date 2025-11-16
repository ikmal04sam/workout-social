import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiService, Exercise } from '../../services/api';
import ExerciseSearchModal from '../../components/ExerciseSearchModal';
import SetInputForm from '../../components/SetInputForm';

type EditWorkoutRouteParams = {
  EditWorkout: {
    workoutId: number;
  };
};

interface EditableSet {
  id?: number; // Set ID if it exists in DB
  set_number: number;
  reps: number;
  weight: number;
  rest_time: number;
  isNew?: boolean; // True if this is a new set to be added
  toDelete?: boolean; // True if this set should be deleted
}

interface EditableExercise {
  workout_exercise_id?: number; // Workout exercise ID if it exists in DB
  exercise_id: number;
  exercise_name: string;
  exercise_description?: string;
  muscle_group: string;
  equipment_type: string;
  sets: EditableSet[];
  isNew?: boolean; // True if this is a new exercise to be added
  toDelete?: boolean; // True if this exercise should be deleted
}

export default function EditWorkoutScreen() {
  const route = useRoute<RouteProp<EditWorkoutRouteParams, 'EditWorkout'>>();
  const navigation = useNavigation();
  const { workoutId } = route.params;
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [exercises, setExercises] = useState<EditableExercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [currentSets, setCurrentSets] = useState<EditableSet[]>([]);
  const [isExerciseModalVisible, setIsExerciseModalVisible] = useState(false);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);

  useEffect(() => {
    loadWorkout();
  }, [workoutId]);

  const loadWorkout = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getWorkout(workoutId);
      const workout = response.workout as any;
      
      setTitle(workout.title || '');
      setDate(workout.date ? workout.date.split('T')[0] : '');
      setDuration(workout.duration ? workout.duration.toString() : '');
      setNotes(workout.notes || '');
      setIsPublic(workout.is_public !== false);

      // Load exercises with sets
      if (workout.exercises && workout.exercises.length > 0) {
        const loadedExercises: EditableExercise[] = workout.exercises.map((ex: any) => ({
          workout_exercise_id: ex.workout_exercise_id,
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          exercise_description: ex.exercise_description,
          muscle_group: ex.muscle_group,
          equipment_type: ex.equipment_type,
          sets: (ex.sets || []).map((s: any) => ({
            id: s.id,
            set_number: s.set_number,
            reps: s.reps || 0,
            weight: s.weight || 0,
            rest_time: s.rest_time || 0,
          })),
        }));
        setExercises(loadedExercises);
      }
    } catch (error) {
      console.error('Error loading workout:', error);
      Alert.alert('Error', 'Failed to load workout details');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSet = () => {
    const lastSet = currentSets[currentSets.length - 1];
    const newSet: EditableSet = {
      set_number: currentSets.length + 1,
      reps: lastSet?.reps ?? 0,
      weight: lastSet?.weight ?? 0,
      rest_time: lastSet?.rest_time ?? 0,
      isNew: true,
    };
    setCurrentSets([...currentSets, newSet]);
  };

  const handleUpdateSet = (visibleSetIndex: number, field: keyof EditableSet, value: number) => {
    // Map visible index back to actual index in currentSets
    const visibleSets = currentSets.filter(s => !s.toDelete);
    const actualIndex = currentSets.indexOf(visibleSets[visibleSetIndex]);
    
    const updatedSets = currentSets.map((set, index) => 
      index === actualIndex ? { ...set, [field]: value } : set
    );
    setCurrentSets(updatedSets);
  };

  const handleRemoveSet = (visibleSetIndex: number) => {
    // Map visible index back to actual index in currentSets
    const visibleSets = currentSets.filter(s => !s.toDelete);
    const actualIndex = currentSets.indexOf(visibleSets[visibleSetIndex]);
    
    if (visibleSets.length > 1) {
      const setToRemove = currentSets[actualIndex];
      // If it's an existing set (has ID), mark it for deletion
      if (setToRemove.id && !setToRemove.isNew) {
        const updatedSets = currentSets.map((set, index) => 
          index === actualIndex ? { ...set, toDelete: true } : set
        );
        setCurrentSets(updatedSets);
      } else {
        // If it's a new set, just remove it
        const updatedSets = currentSets.filter((_, index) => index !== actualIndex);
        const renumberedSets = updatedSets.map((set, index) => ({
          ...set,
          set_number: index + 1
        }));
        setCurrentSets(renumberedSets);
      }
    }
  };

  const handleAddExercise = () => {
    if (!selectedExercise) {
      Alert.alert('Error', 'Please select an exercise');
      return;
    }

    if (currentSets.length === 0) {
      Alert.alert('Error', 'Please add at least one set');
      return;
    }

    const newExercise: EditableExercise = {
      exercise_id: selectedExercise.id,
      exercise_name: selectedExercise.name,
      exercise_description: selectedExercise.description,
      muscle_group: selectedExercise.muscle_group,
      equipment_type: selectedExercise.equipment_type,
      sets: currentSets,
      isNew: true,
    };

    setExercises([...exercises, newExercise]);
    setSelectedExercise(null);
    setCurrentSets([{
      set_number: 1,
      reps: 0,
      weight: 0,
      rest_time: 0,
      isNew: true,
    }]);
    setIsExerciseModalVisible(false);
  };

  const handleRemoveExercise = (index: number) => {
    const exercise = exercises[index];
    if (exercise.workout_exercise_id) {
      // Mark existing exercise for deletion
      const updated = [...exercises];
      updated[index] = { ...exercise, toDelete: true };
      setExercises(updated);
    } else {
      // Remove new exercise that hasn't been saved yet
      setExercises(exercises.filter((_, i) => i !== index));
    }
  };

  const handleEditExerciseSets = (index: number) => {
    const exercise = exercises[index];
    if (exercise.toDelete) return;
    
    setEditingExerciseIndex(index);
    setCurrentSets(exercise.sets.map(s => ({ ...s })));
  };

  const handleSaveExerciseSets = () => {
    if (editingExerciseIndex === null) return;
    
    const updated = [...exercises];
    updated[editingExerciseIndex] = {
      ...updated[editingExerciseIndex],
      sets: currentSets,
    };
    setExercises(updated);
    setEditingExerciseIndex(null);
    setCurrentSets([{
      set_number: 1,
      reps: 0,
      weight: 0,
      rest_time: 0,
      isNew: true,
    }]);
  };

  const handleCancelEditSets = () => {
    setEditingExerciseIndex(null);
    setCurrentSets([{
      set_number: 1,
      reps: 0,
      weight: 0,
      rest_time: 0,
      isNew: true,
    }]);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a workout title');
      return;
    }

    setIsSaving(true);
    try {
      // Update workout metadata
      await apiService.updateWorkout(workoutId, {
        title: title.trim(),
        date: date || new Date().toISOString().split('T')[0],
        duration: duration ? parseInt(duration) : null,
        notes: notes.trim(),
        is_public: isPublic,
      });

      // Process exercises
      for (const exercise of exercises) {
        if (exercise.toDelete && exercise.workout_exercise_id) {
          // Delete existing exercise
          await apiService.removeExerciseFromWorkout(workoutId, exercise.exercise_id);
        } else if (exercise.isNew) {
          // Add new exercise
          const exerciseResponse = await apiService.addExerciseToWorkout(workoutId, {
            exercise_id: exercise.exercise_id,
            order_in_workout: exercises.indexOf(exercise) + 1,
          });
          const workoutExerciseId = exerciseResponse.workout_exercise.id;

          // Add sets for new exercise
          for (const set of exercise.sets) {
            await apiService.addSetsToExercise(workoutExerciseId, {
              set_number: set.set_number,
              reps: set.reps,
              weight: set.weight,
              rest_time: set.rest_time,
            });
          }
        } else if (exercise.workout_exercise_id) {
          // Update existing exercise sets
          for (const set of exercise.sets) {
            if (set.toDelete && set.id) {
              // Delete set
              await apiService.deleteSet(set.id);
            } else if (set.isNew) {
              // Add new set
              await apiService.addSetsToExercise(exercise.workout_exercise_id, {
                set_number: set.set_number,
                reps: set.reps,
                weight: set.weight,
                rest_time: set.rest_time,
              });
            } else if (set.id) {
              // Update existing set
              await apiService.updateSet(set.id, {
                reps: set.reps,
                weight: set.weight,
                rest_time: set.rest_time,
              });
            }
          }
        }
      }

      Alert.alert('Success', 'Workout updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error updating workout:', error);
      Alert.alert('Error', 'Failed to update workout. Please try again.');
    } finally {
      setIsSaving(false);
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

  const visibleExercises = exercises.filter(ex => !ex.toDelete);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Workout</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={[styles.headerButton, styles.saveButton, isSaving && styles.disabledButton]}>
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Workout Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter workout title"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
              />
            </View>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Duration (min)</Text>
              <TextInput
                style={styles.input}
                value={duration}
                onChangeText={setDuration}
                placeholder="60"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about your workout..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Public Workout</Text>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={isPublic ? '#007AFF' : '#f4f3f4'}
              />
            </View>
            <Text style={styles.switchDescription}>
              {isPublic
                ? 'Anyone can view this workout'
                : 'Only you can view this workout'}
            </Text>
          </View>
        </View>

        {/* Exercises Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exercises ({visibleExercises.length})</Text>

          {/* Existing Exercises */}
          {exercises.map((exercise, index) => {
            if (exercise.toDelete) return null;
            const isEditing = editingExerciseIndex === index;

            if (isEditing) {
              return (
                <View key={index} style={styles.exerciseCard}>
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                    <View style={styles.editActions}>
                      <TouchableOpacity onPress={handleSaveExerciseSets}>
                        <Text style={styles.saveSetButton}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleCancelEditSets}>
                        <Text style={styles.cancelSetButton}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <SetInputForm
                    sets={currentSets.filter(s => !s.toDelete).map(s => ({
                      set_number: s.set_number,
                      reps: s.reps,
                      weight: s.weight,
                      rest_time: s.rest_time,
                    }))}
                    onUpdateSet={handleUpdateSet}
                    onRemoveSet={handleRemoveSet}
                    onAddSet={handleAddSet}
                  />
                  {currentSets.some(s => s.toDelete) && (
                    <Text style={styles.deletedSetNote}>
                      Some sets will be deleted when you save
                    </Text>
                  )}
                </View>
              );
            }

            return (
              <View key={index} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {exercise.muscle_group} • {exercise.equipment_type}
                    </Text>
                  </View>
                  <View style={styles.exerciseActions}>
                    <TouchableOpacity
                      style={styles.editSetButton}
                      onPress={() => handleEditExerciseSets(index)}
                    >
                      <Text style={styles.editSetButtonText}>Edit Sets</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeExerciseButton}
                      onPress={() => handleRemoveExercise(index)}
                    >
                      <Text style={styles.removeExerciseButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.setsPreview}>
                  {exercise.sets.filter(s => !s.toDelete).map((set, setIdx) => (
                    <Text key={setIdx} style={styles.setPreviewText}>
                      Set {set.set_number}: {set.reps} reps × {set.weight} lbs
                      {set.rest_time > 0 && ` (${set.rest_time} min rest)`}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })}

          {/* Add New Exercise */}
          {editingExerciseIndex === null && (
            <>
              {!selectedExercise ? (
                <TouchableOpacity
                  style={styles.addExerciseButton}
                  onPress={() => setIsExerciseModalVisible(true)}
                >
                  <Text style={styles.addExerciseButtonText}>+ Add Exercise</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.newExerciseCard}>
                  <View style={styles.exerciseHeader}>
                    <View style={styles.exerciseInfo}>
                      <Text style={styles.exerciseName}>{selectedExercise.name}</Text>
                      <Text style={styles.exerciseMeta}>
                        {selectedExercise.muscle_group} • {selectedExercise.equipment_type}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setIsExerciseModalVisible(true)}>
                      <Text style={styles.changeButton}>Change</Text>
                    </TouchableOpacity>
                  </View>
                  <SetInputForm
                    sets={currentSets.filter(s => !s.toDelete).map(s => ({
                      set_number: s.set_number,
                      reps: s.reps,
                      weight: s.weight,
                      rest_time: s.rest_time,
                    }))}
                    onUpdateSet={handleUpdateSet}
                    onRemoveSet={handleRemoveSet}
                    onAddSet={handleAddSet}
                  />
                  {currentSets.some(s => s.toDelete) && (
                    <Text style={styles.deletedSetNote}>
                      Some sets will be deleted when you save
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.addExerciseButton}
                    onPress={handleAddExercise}
                  >
                    <Text style={styles.addExerciseButtonText}>Add to Workout</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          <ExerciseSearchModal
            visible={isExerciseModalVisible}
            onClose={() => setIsExerciseModalVisible(false)}
            onSelect={(exercise) => {
              setSelectedExercise(exercise);
              setCurrentSets([{
                set_number: 1,
                reps: 0,
                weight: 0,
                rest_time: 0,
                isNew: true,
              }]);
              setIsExerciseModalVisible(false);
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  saveButton: {
    fontWeight: '600',
  },
  disabledButton: {
    color: '#ccc',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  halfWidth: {
    flex: 1,
    marginRight: 10,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  switchDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  exerciseCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  newExerciseCard: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  exerciseMeta: {
    fontSize: 12,
    color: '#666',
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editSetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    marginRight: 8,
  },
  editSetButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  removeExerciseButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeExerciseButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  saveSetButton: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelSetButton: {
    color: '#666',
    fontSize: 14,
  },
  setsPreview: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  setPreviewText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  addExerciseButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  addExerciseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  changeButton: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  deletedSetNote: {
    fontSize: 12,
    color: '#FF3B30',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});
