import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { apiService, Exercise } from '../../services/api';

type GroupedExercises = Record<string, Exercise[]>;

const normalizeMuscleGroup = (muscleGroup?: string | null) => {
  if (!muscleGroup) return 'Other';
  return muscleGroup
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Muscle group icons mapping
const muscleGroupIcons: Record<string, string> = {
  'Chest': 'body',
  'Back': 'fitness',
  'Shoulders': 'barbell',
  'Arms': 'fitness',
  'Biceps': 'fitness',
  'Triceps': 'fitness',
  'Legs': 'walk',
  'Quadriceps': 'walk',
  'Hamstrings': 'walk',
  'Calves': 'footsteps',
  'Core': 'ellipse',
  'Abs': 'ellipse',
  'Cardio': 'pulse',
  'Other': 'ellipse-outline',
};

// Muscle group colors
const muscleGroupColors: Record<string, string> = {
  'Chest': '#FF6B35',
  'Back': '#0A84FF',
  'Shoulders': '#10B981',
  'Arms': '#8B5CF6',
  'Biceps': '#8B5CF6',
  'Triceps': '#EC4899',
  'Legs': '#F59E0B',
  'Quadriceps': '#F59E0B',
  'Hamstrings': '#EF4444',
  'Calves': '#14B8A6',
  'Core': '#06B6D4',
  'Abs': '#06B6D4',
  'Cardio': '#EC4899',
  'Other': '#6B7280',
};

// Equipment type icons
const getEquipmentIcon = (equipment?: string | null): string => {
  if (!equipment) return 'ellipse-outline';
  const eq = equipment.toLowerCase();
  if (eq.includes('barbell')) return 'barbell';
  if (eq.includes('dumbbell')) return 'fitness';
  if (eq.includes('cable')) return 'git-network';
  if (eq.includes('machine')) return 'hardware-chip';
  if (eq.includes('bodyweight')) return 'body';
  if (eq.includes('kettlebell')) return 'disc';
  return 'ellipse-outline';
};

export default function ProgressScreen() {
  const navigation = useNavigation();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [exerciseProgressMap, setExerciseProgressMap] = useState<Record<number, boolean>>({});
  const animatedValues = useRef<Record<number, Animated.Value>>({});

  const loadExercises = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getAllExercises();
      const exercisesList = response.exercises || [];
      setExercises(exercisesList);
      
      // Initialize animated values for each exercise
      exercisesList.forEach((exercise) => {
        if (!animatedValues.current[exercise.id]) {
          animatedValues.current[exercise.id] = new Animated.Value(1);
        }
      });
      
      // Check progress for exercises (batch check for first 20 to avoid too many requests)
      const progressChecks: Promise<void>[] = exercisesList.slice(0, 20).map(async (exercise) => {
        try {
          const progressResponse = await apiService.getExerciseProgress(exercise.id);
          if (progressResponse.progress && progressResponse.progress.length > 0) {
            setExerciseProgressMap((prev) => ({
              ...prev,
              [exercise.id]: true,
            }));
          }
        } catch (error) {
          // Silently fail - exercise might not have progress yet
        }
      });
      
      await Promise.all(progressChecks);
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadExercises();
    }, [])
  );

  const filteredExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return exercises;
    return exercises.filter((exercise) => exercise.name.toLowerCase().includes(query));
  }, [exercises, searchQuery]);

  const groupedExercises: GroupedExercises = useMemo(() => {
    return filteredExercises.reduce<GroupedExercises>((groups, exercise) => {
      const group = normalizeMuscleGroup(exercise.muscle_group);
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(exercise);
      return groups;
    }, {});
  }, [filteredExercises]);

  const groupKeys = useMemo(() => Object.keys(groupedExercises).sort(), [groupedExercises]);

  const getMuscleGroupIcon = (group: string): string => {
    return muscleGroupIcons[group] || 'ellipse-outline';
  };

  const getMuscleGroupColor = (group: string): string => {
    return muscleGroupColors[group] || '#6B7280';
  };

  const handlePressIn = (exerciseId: number) => {
    Animated.spring(animatedValues.current[exerciseId] || new Animated.Value(1), {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (exerciseId: number) => {
    Animated.spring(animatedValues.current[exerciseId] || new Animated.Value(1), {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={18} color="#8E8E93" style={styles.searchInputIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0A84FF" />
          <Text style={styles.loadingText}>Loading progress...</Text>
        </View>
      ) : groupKeys.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No exercises found</Text>
          <Text style={styles.emptySubtitle}>Try a different search term.</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {groupKeys.map((group) => {
            const groupColor = getMuscleGroupColor(group);
            const groupIcon = getMuscleGroupIcon(group);
            const exerciseCount = groupedExercises[group].length;
            
            return (
              <View key={group} style={styles.groupSection}>
                <View style={styles.groupHeader}>
                  <View style={styles.groupHeaderLeft}>
                    <View style={[styles.groupIconContainer, { backgroundColor: `${groupColor}15` }]}>
                      <Ionicons name={groupIcon as any} size={18} color={groupColor} />
                    </View>
                    <Text style={styles.groupTitle}>{group}</Text>
                  </View>
                  <View style={[styles.groupBadge, { backgroundColor: `${groupColor}15` }]}>
                    <Text style={[styles.groupBadgeText, { color: groupColor }]}>
                      {exerciseCount}
                    </Text>
                  </View>
                </View>
                {groupedExercises[group].map((exercise) => {
                  const equipmentIcon = getEquipmentIcon(exercise.equipment_type);
                  const hasProgress = exerciseProgressMap[exercise.id] || false;
                  const scaleAnim = animatedValues.current[exercise.id] || new Animated.Value(1);
                  
                  return (
                    <Animated.View
                      key={exercise.id}
                      style={[
                        { transform: [{ scale: scaleAnim }] },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.exerciseCard}
                        activeOpacity={1}
                        onPressIn={() => handlePressIn(exercise.id)}
                        onPressOut={() => handlePressOut(exercise.id)}
                        onPress={() =>
                          navigation.navigate('ExerciseProgress' as never, {
                            exerciseId: exercise.id,
                            exerciseName: exercise.name,
                            muscleGroup: normalizeMuscleGroup(exercise.muscle_group),
                          } as never)
                        }
                      >
                        <View style={styles.exerciseContent}>
                          <View style={styles.exerciseInfo}>
                            <View style={styles.exerciseHeader}>
                              <Text style={styles.exerciseName}>{exercise.name}</Text>
                              {hasProgress && (
                                <View style={styles.progressIndicator}>
                                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                </View>
                              )}
                            </View>
                            <View style={styles.exerciseMetaRow}>
                              {equipmentIcon && exercise.equipment_type && (
                                <View style={styles.equipmentTag}>
                                  <Ionicons name={equipmentIcon as any} size={12} color="#6B7280" />
                                  <Text style={styles.equipmentText}>
                                    {exercise.equipment_type}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <View style={styles.exerciseArrow}>
                            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                          </View>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInputIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 17,
    color: '#000',
  },
  clearButton: {
    marginLeft: 8,
    padding: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  groupSection: {
    marginBottom: 24,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  groupBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  groupBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  exerciseContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  progressIndicator: {
    marginLeft: 4,
  },
  exerciseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  equipmentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  equipmentText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  exerciseArrow: {
    padding: 4,
  },
});

