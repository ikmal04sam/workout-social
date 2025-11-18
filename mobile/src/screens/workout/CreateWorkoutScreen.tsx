import React, { useState, useRef, useMemo } from 'react';
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
  Animated,
  PanResponder,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { apiService, Exercise } from '../../services/api';
import ExerciseSearchModal from '../../components/ExerciseSearchModal';
import SetInputForm from '../../components/SetInputForm';

interface WorkoutSet {
  set_number: number;
  reps: number;
  weight: number;
  rest_time: number;
}

interface WorkoutExercise {
  exercise_id: number;
  exercise_name: string;
  exercise_description?: string;
  muscle_group: string;
  equipment_type: string;
  sets: WorkoutSet[];
}

export default function CreateWorkoutScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sliderTrackWidth, setSliderTrackWidth] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const sliderTrackRef = useRef<View>(null);
  const trackLayoutRef = useRef({ x: 0, width: 0 });

  const updateDurationFromPosition = (x: number) => {
    const { width } = trackLayoutRef.current;
    if (width > 0) {
      const percentage = Math.max(0, Math.min(1, x / width));
      const newDuration = Math.round(percentage * 300);
      setDuration(newDuration);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (sliderTrackRef.current) {
          sliderTrackRef.current.measure((x, y, width, height, pageX, pageY) => {
            trackLayoutRef.current = { x: pageX, width };
            const touchX = evt.nativeEvent.pageX - pageX;
            updateDurationFromPosition(touchX);
          });
        }
      },
      onPanResponderMove: (evt) => {
        const { x } = trackLayoutRef.current;
        const touchX = evt.nativeEvent.pageX - x;
        updateDurationFromPosition(touchX);
      },
      onPanResponderRelease: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    })
  ).current;

  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [currentSets, setCurrentSets] = useState<WorkoutSet[]>([
    {
      set_number: 1,
      reps: 0,
      weight: 0,
      rest_time: 0,
    },
  ]);
  const [isExerciseModalVisible, setIsExerciseModalVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));

  const handleAddSet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lastSet = currentSets[currentSets.length - 1];
    const newSet: WorkoutSet = {
      set_number: currentSets.length + 1,
      reps: lastSet?.reps ?? 0,
      weight: lastSet?.weight ?? 0,
      rest_time: lastSet?.rest_time ?? 0,
    };
    setCurrentSets([...currentSets, newSet]);
  };

  const handleUpdateSet = (setIndex: number, field: keyof WorkoutSet, value: number) => {
    const updatedSets = currentSets.map((set, index) =>
      index === setIndex ? { ...set, [field]: value } : set
    );
    setCurrentSets(updatedSets);
  };

  const handleRemoveSet = (setIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentSets.length > 1) {
      const updatedSets = currentSets.filter((_, index) => index !== setIndex);
      const renumberedSets = updatedSets.map((set, index) => ({
        ...set,
        set_number: index + 1,
      }));
      setCurrentSets(renumberedSets);
    }
  };

  const handleAddExercise = () => {
    if (!selectedExercise) {
      Alert.alert('Select Exercise', 'Please select an exercise first');
      return;
    }

    if (currentSets.length === 0) {
      Alert.alert('Add Sets', 'Please add at least one set');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const newExercise: WorkoutExercise = {
      exercise_id: selectedExercise.id,
      exercise_name: selectedExercise.name,
      exercise_description: selectedExercise.description,
      muscle_group: selectedExercise.muscle_group,
      equipment_type: selectedExercise.equipment_type,
      sets: currentSets,
    };

    setExercises([...exercises, newExercise]);
    setSelectedExercise(null);
    setCurrentSets([
      {
        set_number: 1,
        reps: 0,
        weight: 0,
        rest_time: 0,
      },
    ]);
    setIsExerciseModalVisible(false);

    // Animate fade
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleRemoveExercise = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a workout title');
      return;
    }

    if (exercises.length === 0) {
      Alert.alert('No Exercises', 'Please add at least one exercise to your workout');
      return;
    }

    setIsSaving(true);
    try {
      // Create workout
      const workoutResponse = await apiService.createWorkout({
        title: title.trim(),
        date: date || new Date().toISOString().split('T')[0],
        duration: duration > 0 ? duration : undefined,
        notes: notes.trim() || undefined,
        is_public: isPublic,
      });

      const workoutId = workoutResponse.workout.id;

      // Add exercises with sets
      for (let i = 0; i < exercises.length; i++) {
        const exercise = exercises[i];
        const exerciseResponse = await apiService.addExerciseToWorkout(workoutId, {
          exercise_id: exercise.exercise_id,
          order_in_workout: i + 1,
        });

        const workoutExerciseId = exerciseResponse.workout_exercise.id;

        // Add sets for this exercise
        for (const set of exercise.sets) {
          await apiService.addSetsToExercise(workoutExerciseId, {
            set_number: set.set_number,
            reps: set.reps,
            weight: set.weight,
            rest_time: set.rest_time,
          });
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Workout created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setTitle('');
            setDate(new Date().toISOString().split('T')[0]);
            setDuration(60);
            setNotes('');
            setIsPublic(true);
            setExercises([]);
            setSelectedExercise(null);
            setCurrentSets([
              {
                set_number: 1,
                reps: 0,
                weight: 0,
                rest_time: 0,
              },
            ]);
            // Navigate to home or workout detail
            navigation.navigate('Home' as never);
          },
        },
      ]);
    } catch (error) {
      console.error('Error creating workout:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to create workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getTotalVolume = () => {
    return exercises.reduce((total, exercise) => {
      const exerciseVolume = exercise.sets.reduce((sum, set) => sum + set.reps * set.weight, 0);
      return total + exerciseVolume;
    }, 0);
  };

  const getTotalSets = () => {
    return exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  };

  const formatDateDisplay = (dateString: string) => {
    const date = new Date(dateString + 'T12:00:00');
    const today = new Date();
    
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const dayAbbreviation = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const dayNumber = date.getDate().toString();
    
    return {
      dayAbbreviation,
      dayNumber,
      isToday: dateOnly.getTime() === todayOnly.getTime(),
    };
  };

  const handleDateChange = (daysOffset: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentDate = new Date(date + 'T12:00:00');
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + daysOffset);
    
    // Don't allow dates in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (newDate > today) {
      return;
    }
    
    const dateString = newDate.toISOString().split('T')[0];
    setDate(dateString);
  };

  const handleSetToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
  };

  const handleDatePickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selectedDate > today) {
        return;
      }
      const dateString = selectedDate.toISOString().split('T')[0];
      setDate(dateString);
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    }
  };

  const isToday = () => {
    const today = new Date().toISOString().split('T')[0];
    return date === today;
  };

  const isFutureDate = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const selectedDate = new Date(date + 'T12:00:00');
    return selectedDate >= today;
  };

  const formattedDate = useMemo(() => formatDateDisplay(date), [date]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Workout</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving || !title.trim() || exercises.length === 0}
          style={styles.saveButton}
          activeOpacity={0.7}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text
              style={[
                styles.saveButtonText,
                (!title.trim() || exercises.length === 0) && styles.saveButtonTextDisabled,
              ]}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Workout Summary Card */}
        {exercises.length > 0 && (
          <Animated.View style={[styles.summaryCard, { opacity: fadeAnim }]}>
            <View style={styles.summaryHeader}>
              <Ionicons name="stats-chart" size={20} color="#007AFF" />
              <Text style={styles.summaryTitle}>Workout Summary</Text>
            </View>
            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>{exercises.length}</Text>
                <Text style={styles.summaryStatLabel}>Exercises</Text>
              </View>
              <View style={styles.summaryStatDivider} />
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>{getTotalSets()}</Text>
                <Text style={styles.summaryStatLabel}>Sets</Text>
              </View>
              <View style={styles.summaryStatDivider} />
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>
                  {getTotalVolume() > 0 ? Math.round(getTotalVolume()) : '0'}
                </Text>
                <Text style={styles.summaryStatLabel}>Total Volume (lbs)</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Workout Details Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={20} color="#333" />
            <Text style={styles.sectionTitle}>Workout Details</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Push Day, Leg Day"
              placeholderTextColor="#999"
              maxLength={100}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Date</Text>
              <View style={styles.dateContainer}>
                <TouchableOpacity
                  style={styles.dateNavButton}
                  onPress={() => handleDateChange(-1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={16} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateDisplay}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowDatePicker(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.dateTextContainer}>
                    <Text style={styles.dateDayAbbreviation}>
                      {formattedDate.dayAbbreviation}
                    </Text>
                    <Text style={styles.dateDayNumber}>
                      {formattedDate.dayNumber}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dateNavButton,
                    isFutureDate() && styles.dateNavButtonDisabled,
                  ]}
                  onPress={() => {
                    if (!isFutureDate()) {
                      handleDateChange(1);
                    }
                  }}
                  activeOpacity={0.7}
                  disabled={isFutureDate()}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={isFutureDate() ? '#d1d5db' : '#007AFF'}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Duration (min)</Text>
              <View style={styles.durationContainer}>
                <TouchableOpacity
                  style={styles.durationButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDuration(Math.max(0, duration - 1));
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={20} color="#007AFF" />
                </TouchableOpacity>
                <View style={styles.durationValueContainer}>
                  <Text style={styles.durationValue}>{duration}</Text>
                  <Text style={styles.durationLabel}>min</Text>
                </View>
                <TouchableOpacity
                  style={styles.durationButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDuration(Math.min(300, duration + 1));
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>
              <View style={styles.sliderContainer}>
                <View
                  ref={sliderTrackRef}
                  style={styles.sliderTrack}
                  onLayout={(e) => {
                    const { width } = e.nativeEvent.layout;
                    setSliderTrackWidth(width);
                    trackLayoutRef.current.width = width;
                  }}
                  {...panResponder.panHandlers}
                >
                  <View
                    style={[
                      styles.sliderFill,
                      { width: `${(duration / 300) * 100}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.sliderThumb,
                      { left: `${(duration / 300) * 100}%` },
                    ]}
                  />
                </View>
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>0</Text>
                  <Text style={styles.sliderLabel}>300</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did you feel? Any notes..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          <View style={styles.switchContainer}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Ionicons
                  name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
                  size={18}
                  color="#666"
                />
                <Text style={styles.switchLabel}>
                  {isPublic ? 'Public Workout' : 'Private Workout'}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                thumbColor={isPublic ? '#007AFF' : '#f4f3f4'}
                ios_backgroundColor="#d1d5db"
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
          <View style={styles.sectionHeader}>
            <Ionicons name="barbell-outline" size={20} color="#333" />
            <Text style={styles.sectionTitle}>
              Exercises {exercises.length > 0 && `(${exercises.length})`}
            </Text>
          </View>

          {/* Existing Exercises */}
          {exercises.map((exercise, index) => (
            <View key={index} style={styles.exerciseCard}>
              <View style={styles.exerciseCardHeader}>
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                  <View style={styles.exerciseMetaRow}>
                    <View style={styles.exerciseMetaBadge}>
                      <Text style={styles.exerciseMetaText}>{exercise.muscle_group}</Text>
                    </View>
                    <View style={styles.exerciseMetaBadge}>
                      <Text style={styles.exerciseMetaText}>{exercise.equipment_type}</Text>
                    </View>
                    <Text style={styles.exerciseSetsCount}>{exercise.sets.length} sets</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.removeExerciseButton}
                  onPress={() => handleRemoveExercise(index)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
              <View style={styles.setsPreview}>
                {exercise.sets.map((set, setIdx) => (
                  <View key={setIdx} style={styles.setPreviewItem}>
                    <Text style={styles.setPreviewText}>
                      Set {set.set_number}: {set.reps} reps × {set.weight} lbs
                      {set.rest_time > 0 && ` • ${set.rest_time} min rest`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* Add Exercise Section */}
          {!selectedExercise ? (
            <TouchableOpacity
              style={styles.addExerciseButton}
              onPress={() => setIsExerciseModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
              <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.newExerciseCard}>
              <View style={styles.newExerciseHeader}>
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{selectedExercise.name}</Text>
                  <View style={styles.exerciseMetaRow}>
                    <View style={styles.exerciseMetaBadge}>
                      <Text style={styles.exerciseMetaText}>{selectedExercise.muscle_group}</Text>
                    </View>
                    <View style={styles.exerciseMetaBadge}>
                      <Text style={styles.exerciseMetaText}>{selectedExercise.equipment_type}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedExercise(null);
                    setCurrentSets([
                      {
                        set_number: 1,
                        reps: 0,
                        weight: 0,
                        rest_time: 0,
                      },
                    ]);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={24} color="#999" />
                </TouchableOpacity>
              </View>

              <SetInputForm
                sets={currentSets}
                onUpdateSet={handleUpdateSet}
                onRemoveSet={handleRemoveSet}
                onAddSet={handleAddSet}
              />

              <TouchableOpacity
                style={styles.addToWorkoutButton}
                onPress={handleAddExercise}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-circle" size={20} color="white" />
                <Text style={styles.addToWorkoutButtonText}>Add to Workout</Text>
              </TouchableOpacity>
            </View>
          )}

          <ExerciseSearchModal
            visible={isExerciseModalVisible}
            onClose={() => setIsExerciseModalVisible(false)}
            onSelect={(exercise) => {
              setSelectedExercise(exercise);
              setCurrentSets([
                {
                  set_number: 1,
                  reps: 0,
                  weight: 0,
                  rest_time: 0,
                },
              ]);
              setIsExerciseModalVisible(false);
            }}
          />
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Date Picker Modal */}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerModalContent}>
              <View style={styles.datePickerModalHeader}>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={styles.datePickerCancelButton}
                >
                  <Text style={styles.datePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerModalTitle}>Select Date</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={styles.datePickerConfirmButton}
                >
                  <Text style={styles.datePickerConfirmText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={new Date(date + 'T12:00:00')}
                mode="date"
                display="spinner"
                onChange={handleDatePickerChange}
                maximumDate={new Date()}
                style={styles.datePicker}
              />
            </View>
          </View>
        </Modal>
      ) : (
        showDatePicker && (
          <DateTimePicker
            value={new Date(date + 'T12:00:00')}
            mode="date"
            display="default"
            onChange={handleDatePickerChange}
            maximumDate={new Date()}
          />
        )
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  saveButton: {
    padding: 4,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveButtonTextDisabled: {
    color: '#9ca3af',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryStat: {
    alignItems: 'center',
    flex: 1,
  },
  summaryStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  summaryStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  summaryStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    color: '#111827',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  durationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  durationValueContainer: {
    alignItems: 'center',
    flex: 1,
  },
  durationValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  durationLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 2,
  },
  sliderContainer: {
    marginTop: 4,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    position: 'relative',
    marginBottom: 8,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    borderWidth: 3,
    borderColor: 'white',
    position: 'absolute',
    top: -7,
    marginLeft: -10,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  switchContainer: {
    marginTop: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  switchDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  exerciseCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  exerciseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseMetaBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  exerciseMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338ca',
    textTransform: 'capitalize',
  },
  exerciseSetsCount: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  removeExerciseButton: {
    padding: 4,
  },
  setsPreview: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  setPreviewItem: {
    paddingVertical: 6,
  },
  setPreviewText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  addExerciseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
  },
  newExerciseCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  newExerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  addToWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addToWorkoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 40,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  dateNavButtonDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    gap: 4,
    minHeight: 50,
    width: 55,
  },
  dateTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
  dateDayAbbreviation: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 2,
    letterSpacing: 0.5,
    width: '100%',
    overflow: 'hidden',
  },
  dateDayNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 26,
    width: '100%',
    overflow: 'hidden',
  },
  todayButtonInline: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
  },
  datePickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  datePickerModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  datePickerCancelButton: {
    padding: 4,
  },
  datePickerCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  datePickerModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  datePickerConfirmButton: {
    padding: 4,
  },
  datePickerConfirmText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  datePicker: {
    width: '100%',
    height: 200,
  },
});

