import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiService, Exercise } from '../services/api';
import ExerciseTutorialButton from './ExerciseTutorialButton';

interface ExerciseSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}

export default function ExerciseSearchModal({ visible, onClose, onSelect }: ExerciseSearchModalProps) {
  const [query, setQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadExercises();
    }
  }, [visible]);

  const loadExercises = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiService.getAllExercises();
      setExercises(res.exercises || []);
    } catch (err) {
      console.error('Error loading exercises:', err);
      setError('Failed to load exercises');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return exercises;
    const q = query.trim().toLowerCase();
    return exercises.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.muscle_group.toLowerCase().includes(q) ||
      e.equipment_type.toLowerCase().includes(q)
    );
  }, [query, exercises]);

  const getEquipmentEmoji = (equipmentType: string) => {
    switch (equipmentType.toLowerCase()) {
      case 'barbell':
        return '🏋️';
      case 'dumbbell':
        return '🏋️‍♂️';
      case 'bodyweight':
        return '🤸';
      case 'machine':
        return '🏋️‍♀️';
      case 'cable':
        return '🔗';
      case 'kettlebell':
        return '⚡';
      default:
        return '💪';
    }
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Exercise</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises, muscle, equipment"
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>Loading exercises...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadExercises}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {filtered.map(exercise => (
              <TouchableOpacity key={exercise.id} style={styles.item} onPress={() => onSelect(exercise)}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemEmoji}>{getEquipmentEmoji(exercise.equipment_type)}</Text>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{exercise.name}</Text>
                    <Text style={styles.itemMeta}>
                      {exercise.muscle_group} · {exercise.equipment_type}
                    </Text>
                  </View>
                </View>
                {exercise.description ? (
                  <Text style={styles.itemDescription} numberOfLines={2}>{exercise.description}</Text>
                ) : null}
                <View style={styles.itemActions}>
                  <ExerciseTutorialButton
                    exerciseName={exercise.name}
                    muscleGroup={exercise.muscle_group}
                    equipmentType={exercise.equipment_type}
                  />
                  <Text style={styles.selectHint}>Tap card to select</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  searchRow: {
    padding: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    paddingTop: 24,
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
  },
  item: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemMeta: {
    marginTop: 2,
    color: '#666',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  itemDescription: {
    marginTop: 8,
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
  },
  itemActions: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectHint: {
    flex: 1,
    color: '#8a8a8a',
    fontSize: 12,
    textAlign: 'right',
  },
});
