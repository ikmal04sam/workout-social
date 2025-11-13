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
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
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
const MS_PER_DAY = 24 * 60 * 60 * 1000;
type MetricKey = 'heaviestWeight' | 'oneRepMax' | 'bestSetVolume';

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const formatDateLabel = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const formatChartData = (progress: ExerciseProgressPoint[]) =>
  progress.map((point) => {
    const topWeight = Number(point.top_weight ?? point.max_weight ?? 0);
    const topReps = Number(point.top_reps ?? 1);
    const oneRepMax = topWeight > 0 ? topWeight * (1 + topReps / 30) : 0;
    const bestSetVolume =
      point.best_set_volume != null ? Number(point.best_set_volume) : Math.max(topWeight * topReps, 0);

    return {
      ...point,
      top_weight: topWeight,
      top_reps: topReps,
      max_weight: Number(point.max_weight ?? topWeight),
      total_reps: Number(point.total_reps ?? 0),
      total_volume: Number(point.total_volume ?? 0),
      label: formatDateLabel(point.date),
      oneRepMax,
      bestSetVolume,
    };
  });

const getWeekStart = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = (day + 6) % 7; // Monday as the start of the week
  start.setDate(start.getDate() - diff);
  return start;
};

interface WeeklyChartPoint {
  start: Date;
  label: string;
  heaviestWeight: number;
  oneRepMax: number;
  bestSetVolume: number;
  hasData: boolean;
}

const getWeeksAgoText = (date?: Date | null) => {
  if (!date) return 'No workouts yet';
  const now = new Date();
  const diffWeeks = Math.floor((now.getTime() - date.getTime()) / (7 * MS_PER_DAY));
  if (diffWeeks <= 0) return 'This week';
  if (diffWeeks === 1) return '1 week ago';
  return `${diffWeeks} weeks ago`;
};

interface MetricConfig {
  title: string;
  bestLabel: string;
  averageLabel: string;
  unitSuffix: string;
  format: (value: number) => string;
  value: (point: ReturnType<typeof formatChartData>[number]) => number;
}

export default function ExerciseProgressScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ExerciseProgressRouteParams, 'ExerciseProgress'>>();
  const { exerciseId, exerciseName, muscleGroup } = route.params;
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [exercise, setExercise] = useState<ExerciseDetails | null>(null);
  const [progress, setProgress] = useState<ExerciseProgressPoint[]>([]);
  const [activeMetric, setActiveMetric] = useState<MetricKey>('heaviestWeight');

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

  const sessionData = useMemo(() => formatChartData(progress), [progress]);

  const metricConfig: Record<MetricKey, MetricConfig> = useMemo(
    () => ({
      heaviestWeight: {
        title: 'Heaviest Weight',
        bestLabel: 'Best Weight',
        averageLabel: 'Average Weight',
        unitSuffix: 'lb',
        format: (value) => `${numberFormatter.format(Math.round(value))} lb`,
        value: (point) => point.top_weight || point.max_weight || 0,
      },
      oneRepMax: {
        title: 'Estimated 1RM (Epley)',
        bestLabel: 'Best 1RM',
        averageLabel: 'Average 1RM',
        unitSuffix: 'lb',
        format: (value) => `${numberFormatter.format(Math.round(value))} lb`,
        value: (point) => point.oneRepMax || point.top_weight || 0,
      },
      bestSetVolume: {
        title: 'Best Set Volume',
        bestLabel: 'Best Volume',
        averageLabel: 'Average Volume',
        unitSuffix: 'lb·reps',
        format: (value) => `${numberFormatter.format(Math.round(value))} lb·reps`,
        value: (point) => point.bestSetVolume || 0,
      },
    }),
    []
  );

  const getMetricValue = (point: typeof sessionData[number]) =>
    metricConfig[activeMetric].value(point);

  const averageMetric = useMemo(() => {
    if (!sessionData.length) return 0;
    const total = sessionData.reduce((sum, point) => sum + getMetricValue(point), 0);
    return total / sessionData.length;
  }, [sessionData, activeMetric]);

  const bestMetric = useMemo(() => {
    if (!sessionData.length) return 0;
    return sessionData.reduce((max, point) => Math.max(max, getMetricValue(point)), 0);
  }, [sessionData, activeMetric]);

  const latestMetricValue = sessionData.length
    ? getMetricValue(sessionData[sessionData.length - 1])
    : 0;

  const lastSessionDate = sessionData.length
    ? new Date(sessionData[sessionData.length - 1].date)
    : null;
  const lastSessionAgoText = getWeeksAgoText(lastSessionDate);

  const summaryStats = useMemo(() => {
    const totalSessions = sessionData.length;
    const formatNumber = (value: number) =>
      numberFormatter.format(Math.round(value));

    return [
      {
        key: 'best',
        label: activeMetric === 'bestSetVolume'
          ? 'Best Volume'
          : activeMetric === 'oneRepMax'
            ? 'Best\n1RM'
            : 'Best Weight',
        value:
          activeMetric === 'bestSetVolume'
            ? formatNumber(bestMetric)
            : metricConfig[activeMetric].format(bestMetric),
      },
      {
        key: 'average',
        label: activeMetric === 'bestSetVolume'
          ? 'Average Volume'
          : activeMetric === 'oneRepMax'
            ? 'Average 1RM'
            : 'Average Weight',
        value:
          activeMetric === 'bestSetVolume'
            ? formatNumber(averageMetric)
            : metricConfig[activeMetric].format(averageMetric),
      },
      {
        key: 'sessions',
        label: 'Total Sessions',
        value: totalSessions.toString(),
        unit: undefined,
      },
    ];
  }, [activeMetric, averageMetric, bestMetric, metricConfig, sessionData.length]);

  const weeklyChartData = useMemo(() => {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const weeks: WeeklyChartPoint[] = [];
    const keyToIndex = new Map<string, number>();

    for (let i = 11; i >= 0; i--) {
      const start = new Date(currentWeekStart);
      start.setDate(start.getDate() - i * 7);
      const key = start.toISOString();
      keyToIndex.set(key, weeks.length);
      weeks.push({
        start,
        label: start.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        heaviestWeight: 0,
        oneRepMax: 0,
        bestSetVolume: 0,
        hasData: false,
      });
    }

    sessionData.forEach((point) => {
      const workoutDate = new Date(point.date);
      const weekStart = getWeekStart(workoutDate);
      const key = weekStart.toISOString();
      const index = keyToIndex.get(key);
      if (index != null) {
        const week = weeks[index];
        week.heaviestWeight = Math.max(
          week.heaviestWeight,
          point.top_weight || point.max_weight || 0
        );
        week.oneRepMax = Math.max(week.oneRepMax, point.oneRepMax || 0);
        week.bestSetVolume = Math.max(week.bestSetVolume, point.bestSetVolume || 0);
        week.hasData = true;
      }
    });

    return weeks;
  }, [sessionData]);

  const weeklyMetricValue = useMemo(() => {
    return (week: WeeklyChartPoint) => {
      switch (activeMetric) {
        case 'heaviestWeight':
          return week.heaviestWeight;
        case 'oneRepMax':
          return week.oneRepMax;
        case 'bestSetVolume':
          return week.bestSetVolume;
        default:
          return 0;
      }
    };
  }, [activeMetric]);

  const chartWidth = Dimensions.get('window').width - CHART_PADDING * 2;
  const weightRange = useMemo(() => {
    if (!weeklyChartData.length) return { min: 0, max: 0 };
    const valueGetter = weeklyMetricValue;
    let min = valueGetter(weeklyChartData[0]);
    let max = valueGetter(weeklyChartData[0]);

    weeklyChartData.forEach((week) => {
      const value = valueGetter(week);
      min = Math.min(min, value);
      max = Math.max(max, value);
    });

    if (min === max) {
      if (activeMetric === 'bestSetVolume') {
        const padding = Math.max(10, min * 0.1);
        min = Math.max(0, min - padding);
        max = max + padding;
      } else {
        min = Math.max(0, min - 10);
        max = max + 10;
      }
    }
    return { min, max };
  }, [weeklyChartData, weeklyMetricValue, activeMetric]);

  const points = useMemo(() => {
    if (weeklyChartData.length === 0) return '';

    const range = weightRange.max - weightRange.min || 1;

    return weeklyChartData
      .map((point, index) => {
        const x =
          weeklyChartData.length === 1
            ? chartWidth / 2
            : (index / (weeklyChartData.length - 1)) * chartWidth;
        const normalized = (weeklyMetricValue(point) - weightRange.min) / range;
        const y = CHART_HEIGHT - 16 - normalized * (CHART_HEIGHT - 36);
        return `${x},${y}`;
      })
      .join(' ');
  }, [weeklyChartData, weeklyMetricValue, chartWidth, weightRange]);

  const renderChart = () => {
    if (weeklyChartData.every((week) => !week.hasData)) {
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
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const valueLabel = weightRange.max - (weightRange.max - weightRange.min) * ratio;
            const y = CHART_HEIGHT - 16 - ratio * (CHART_HEIGHT - 36);
            return (
              <>
                <Line
                  key={`line-${ratio}`}
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#eef1ff"
                  strokeWidth={1}
                />
                {ratio === 0 || ratio === 0.5 || ratio === 1 ? (
                  <SvgText
                    key={`label-${ratio}`}
                    x={chartWidth + 6}
                    y={y + 4}
                    fill="#98a2b3"
                    fontSize="10"
                  >
                    {metricConfig[activeMetric].unitSuffix === 'lb·reps'
                      ? `${Math.max(valueLabel, 0).toFixed(0)} ${metricConfig[activeMetric].unitSuffix}`
                      : `${Math.max(valueLabel, 0).toFixed(0)} ${metricConfig[activeMetric].unitSuffix}`}
                  </SvgText>
                ) : null}
              </>
            );
          })}

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
          {weeklyChartData.map((point, index) => {
            const x =
              weeklyChartData.length === 1
                ? chartWidth / 2
                : (index / (weeklyChartData.length - 1)) * chartWidth;
            const normalized =
              weightRange.max === weightRange.min
                ? 0
                : (weeklyMetricValue(point) - weightRange.min) /
                  (weightRange.max - weightRange.min);
            const y = CHART_HEIGHT - 16 - normalized * (CHART_HEIGHT - 36);
            const value = weeklyMetricValue(point);
            return value > 0 ? (
              <Circle
                key={`${point.start.toISOString()}-${index}`}
                cx={x}
                cy={y}
                r={5}
                fill="#0A84FF"
                stroke="white"
                strokeWidth={2}
              />
            ) : null;
          })}
        </Svg>

        <View style={styles.chartLabels}>
          {weeklyChartData.map((point, index) => (
            <Text key={point.start.toISOString()} style={styles.chartLabel}>
              {index === 0 || index === weeklyChartData.length - 1 || index % 2 === 0
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
            <View style={styles.summaryHeaderRow}>
              <Text style={styles.summaryTitle}>Overview</Text>
              <Text style={styles.summarySubtitle}>
                Tracking {metricConfig[activeMetric].title.toLowerCase()}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              {summaryStats.map((stat, index) => (
                <View
                  key={stat.key}
                  style={[
                    styles.summaryItem,
                    index < summaryStats.length - 1 && styles.summaryItemDivider,
                  ]}
                >
                  <Text style={styles.summaryLabel}>{stat.label}</Text>
                  <Text
                    style={styles.summaryValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {stat.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartHeaderTitle}>{metricConfig[activeMetric].title}</Text>
              <Text style={styles.chartHeaderRange}>Last 3 months ▾</Text>
            </View>
            <Text style={styles.chartSummary}>
              <Text style={styles.chartSummaryValue}>
                {metricConfig[activeMetric].format(latestMetricValue)}
              </Text>{' '}
              Last session · {lastSessionAgoText}
            </Text>
            {renderChart()}
            <View style={styles.chartTabs}>
              <TouchableOpacity
                style={[
                  styles.chartTab,
                  activeMetric === 'heaviestWeight' && styles.chartTabActive,
                ]}
                onPress={() => setActiveMetric('heaviestWeight')}
              >
                <Text
                  style={[
                    styles.chartTabText,
                    activeMetric === 'heaviestWeight' && styles.chartTabTextActive,
                  ]}
                >
                  Heaviest Weight
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.chartTab,
                  activeMetric === 'oneRepMax' && styles.chartTabActive,
                ]}
                onPress={() => setActiveMetric('oneRepMax')}
              >
                <Text
                  style={[
                    styles.chartTabText,
                    activeMetric === 'oneRepMax' && styles.chartTabTextActive,
                  ]}
                >
                  Est. 1RM (Epley)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.chartTab,
                  activeMetric === 'bestSetVolume' && styles.chartTabActive,
                ]}
                onPress={() => setActiveMetric('bestSetVolume')}
              >
                <Text
                  style={[
                    styles.chartTabText,
                    activeMetric === 'bestSetVolume' && styles.chartTabTextActive,
                  ]}
                >
                  Best Set Volume
                </Text>
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
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  summarySubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f7f8ff',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e4e7ff',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 6,
    minWidth: 0,
    minHeight: 98,
  },
  summaryItemDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e4e7ff',
  },
   summaryLabel: {
     fontSize: 10.5,
     color: '#7381a3',
     textTransform: 'uppercase',
     letterSpacing: 0.4,
     textAlign: 'center',
     lineHeight: 15,
   },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 30,
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
    marginBottom: 8,
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
    marginBottom: 12,
    paddingHorizontal: 8,
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
  chartSummary: {
    fontSize: 14,
    color: '#667085',
    marginBottom: 6,
  },
  chartSummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
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
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 10,
  },
  chartTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center', 
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
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

