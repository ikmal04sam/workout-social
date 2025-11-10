import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { apiService, ExerciseDetails, ExerciseProgressPoint } from '../../services/api';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type ExerciseProgressRouteParams = {
  ExerciseProgress: {
    exerciseId: number;
    exerciseName?: string;
    muscleGroup?: string;
  };
};

const CHART_HEIGHT = 200;
const CHART_PADDING = 24;

const formatDateLabel = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export default function ExerciseProgressScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ExerciseProgressRouteParams, 'ExerciseProgress'>>();
  const { exerciseId, exerciseName, muscleGroup } = route.params;
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [exercise, setExercise] = useState<ExerciseDetails | null>(null);
  const [progress, setProgress] = useState<ExerciseProgressPoint[]>([]);

  const loadProgress = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getExerciseProgress(exerciseId);
      setExercise(response.exercise);
      setProgress(response.progress || []);
    } catch (error) {
      console.error('Error loading exercise progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, [exerciseId]);

  const chartData = useMemo(() => {
    if (!progress || progress.length === 0) return [];
    return progress.map((point) => ({
      ...point,
      label: formatDateLabel(point.date),
    }));
  }, [progress]);

  const maxWeight = useMemo(() => {
    if (!chartData.length) return 0;
    return chartData.reduce((max, point) => Math.max(max, point.max_weight || 0), 0);
  }, [chartData]);

  const averageWeight = useMemo(() => {
    if (!chartData.length) return 0;
    const total = chartData.reduce((sum, point) => sum + (point.max_weight || 0), 0);
    return total / chartData.length;
  }, [chartData]);

  const bestWeight = useMemo(() => {
    if (!chartData.length) return 0;
    return chartData.reduce((max, point) => Math.max(max, point.max_weight || 0), 0);
  }, [chartData]);

  const chartWidth = Dimensions.get('window').width - CHART_PADDING * 2;
  const points = useMemo(() => {
    if (chartData.length === 0 || maxWeight === 0) return '';
    return chartData
      .map((point, index) => {
        const x =
          chartData.length === 1
            ? chartWidth / 2
            : (index / (chartData.length - 1)) * chartWidth;
        const normalized = point.max_weight / maxWeight;
        const y = CHART_HEIGHT - normalized * (CHART_HEIGHT - 20);
        return `${x},${y}`;
      })
      .join(' ');
  }, [chartData, maxWeight, chartWidth]);

  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyChartTitle}>No workouts logged yet</Text>
          <Text style={styles.emptyChartSubtitle}>
            Track this exercise to see your progress over time.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.chartWrapper}>
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          {/* Horizontal Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <Line
              key={ratio}
              x1={0}
              y1={CHART_HEIGHT - ratio * (CHART_HEIGHT - 20)}
              x2={chartWidth}
              y2={CHART_HEIGHT - ratio * (CHART_HEIGHT - 20)}
              stroke="#eef1ff"
              strokeWidth={1}
            />
          ))}

          {/* Polyline */}
          {points.length > 0 && (
            <Polyline
              points={points}
              fill="none"
              stroke="#0A84FF"
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Points */}
          {chartData.map((point, index) => {
            const x =
              chartData.length === 1
                ? chartWidth / 2
                : (index / (chartData.length - 1)) * chartWidth;
            const normalized = maxWeight === 0 ? 0 : point.max_weight / maxWeight;
            const y = CHART_HEIGHT - normalized * (CHART_HEIGHT - 20);
            return (
              <Circle
                key={`${point.workout_id}-${index}`}
                cx={x}
                cy={y}
                r={5}
                fill="#0A84FF"
                stroke="white"
                strokeWidth={2}
              />
            );
          })}
        </Svg>

        <View style={styles.chartLabels}>
          {chartData.map((point, index) => (
            <Text key={`${point.workout_id}-${index}`} style={styles.chartLabel}>
              {index === 0 || index === chartData.length - 1 || index % 2 === 0
                ? point.label
                : ''}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 6 }]}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.headerBackText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{exercise?.name || exerciseName}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.header}>
        <Text style={styles.exerciseName}>{exercise?.name || exerciseName}</Text>
        <Text style={styles.exerciseMeta}>
          {muscleGroup || exercise?.muscle_group}
          {exercise?.equipment_type ? ` • ${exercise.equipment_type}` : ''}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0A84FF" />
          <Text style={styles.loadingText}>Loading exercise data...</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Best Weight</Text>
                <Text style={styles.summaryValue}>{bestWeight.toFixed(0)} lb</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Average</Text>
                <Text style={styles.summaryValue}>{averageWeight.toFixed(0)} lb</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Sessions</Text>
                <Text style={styles.summaryValue}>{chartData.length}</Text>
              </View>
            </View>
          </View>

          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartHeaderTitle}>Heaviest Weight</Text>
              <Text style={styles.chartHeaderRange}>Last 3 months ▾</Text>
            </View>
            {renderChart()}
            <View style={styles.chartTabs}>
              <TouchableOpacity style={[styles.chartTab, styles.chartTabActive]}>
                <Text style={[styles.chartTabText, styles.chartTabTextActive]}>Heaviest Weight</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chartTab}>
                <Text style={styles.chartTabText}>One Rep Max</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chartTab}>
                <Text style={styles.chartTabText}>Best Set</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>Tip</Text>
            <Text style={styles.notesBody}>
              Log your sets with accurate weight and reps to see more detailed progress.
            </Text>
          </View>
        </>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerBack: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  headerBackText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A84FF',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  header: {
    marginBottom: 16,
  },
  exerciseName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  exerciseMeta: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 6,
  },
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  chartHeaderRange: {
    fontSize: 14,
    color: '#0A84FF',
    fontWeight: '600',
  },
  chartWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: Dimensions.get('window').width - CHART_PADDING * 2,
    marginTop: 6,
  },
  chartLabel: {
    fontSize: 11,
    color: '#98a2b3',
  },
  emptyChart: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyChartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  emptyChartSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  chartTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  chartTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f3ff',
  },
  chartTabActive: {
    backgroundColor: '#0A84FF',
  },
  chartTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  chartTabTextActive: {
    color: 'white',
  },
  notesCard: {
    backgroundColor: '#F8FAFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E9FF',
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  notesBody: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
});

