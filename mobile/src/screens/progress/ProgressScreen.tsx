import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
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

export default function ProgressScreen() {
  const navigation = useNavigation();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadExercises = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getAllExercises();
      setExercises(response.exercises || []);
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
          {groupKeys.map((group) => (
            <View key={group} style={styles.groupSection}>
              <Text style={styles.groupTitle}>{group}</Text>
              {groupedExercises[group].map((exercise) => (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.exerciseCard}
                  activeOpacity={0.75}
                  onPress={() =>
                    navigation.navigate('ExerciseProgress' as never, {
                      exerciseId: exercise.id,
                      exerciseName: exercise.name,
                      muscleGroup: normalizeMuscleGroup(exercise.muscle_group),
                    } as never)
                  }
                >
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseChevron}>›</Text>
                  </View>
                  <Text style={styles.exerciseMeta}>
                    {normalizeMuscleGroup(exercise.muscle_group)}
                    {exercise.equipment_type ? ` • ${exercise.equipment_type}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
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
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  exerciseChevron: {
    fontSize: 20,
    color: '#c7cdd9',
    marginLeft: 8,
  },
  exerciseMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
});

