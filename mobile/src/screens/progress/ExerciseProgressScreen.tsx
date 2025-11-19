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
import Svg, { Polyline, Circle, Line, Text as SvgText, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

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

  // Calculate trend (comparing last 3 sessions to previous 3)
  const trend = useMemo(() => {
    if (sessionData.length < 6) return null;
    const recent = sessionData.slice(-3);
    const previous = sessionData.slice(-6, -3);
    const recentAvg = recent.reduce((sum, p) => sum + getMetricValue(p), 0) / recent.length;
    const previousAvg = previous.reduce((sum, p) => sum + getMetricValue(p), 0) / previous.length;
    const change = ((recentAvg - previousAvg) / previousAvg) * 100;
    return {
      value: Math.abs(change),
      isPositive: change > 0,
      isNeutral: Math.abs(change) < 2,
    };
  }, [sessionData, activeMetric]);

  // Calculate progress percentage (current vs best)
  const progressPercentage = useMemo(() => {
    if (!bestMetric || !latestMetricValue) return 0;
    return Math.min(100, (latestMetricValue / bestMetric) * 100);
  }, [latestMetricValue, bestMetric]);

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
            ? 'Best 1RM'
            : 'Best Weight',
        value:
          activeMetric === 'bestSetVolume'
            ? formatNumber(bestMetric)
            : metricConfig[activeMetric].format(bestMetric),
        icon: 'trophy' as const,
        color: '#FF6B35',
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
        icon: 'stats-chart' as const,
        color: '#0A84FF',
      },
      {
        key: 'sessions',
        label: 'Total Sessions',
        value: totalSessions.toString(),
        unit: undefined,
        icon: 'calendar' as const,
        color: '#10B981',
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

  // Generate area path for gradient fill under the line
  const areaPath = useMemo(() => {
    if (weeklyChartData.length === 0 || !points || points.length === 0) return '';
    const pointsArray = points.split(' ').map(p => p.split(',').map(Number));
    if (pointsArray.length === 0) return '';
    const bottomY = CHART_HEIGHT - 16;
    
    let path = `M ${pointsArray[0][0]},${bottomY} `;
    pointsArray.forEach(([x, y]) => {
      path += `L ${x},${y} `;
    });
    const lastX = pointsArray[pointsArray.length - 1][0];
    path += `L ${lastX},${bottomY} Z`;
    return path;
  }, [points, weeklyChartData.length]);

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
              <React.Fragment key={`grid-${ratio}`}>
                <Line
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#f0f4ff"
                  strokeWidth={1}
                  strokeDasharray={ratio === 0.5 ? "0" : "4,4"}
                />
                {ratio === 0 || ratio === 0.5 || ratio === 1 ? (
                  <SvgText
                    x={chartWidth + 6}
                    y={y + 4}
                    fill="#98a2b3"
                    fontSize="10"
                    fontWeight="500"
                  >
                    {metricConfig[activeMetric].unitSuffix === 'lb·reps'
                      ? `${Math.max(valueLabel, 0).toFixed(0)}`
                      : `${Math.max(valueLabel, 0).toFixed(0)}`}
                  </SvgText>
                ) : null}
              </React.Fragment>
            );
          })}

          {/* Gradient definition */}
          <Defs>
            <LinearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#0A84FF" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Area fill under the line */}
          {areaPath && (
            <Path
              d={areaPath}
              fill="url(#gradient)"
              opacity={0.2}
            />
          )}

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
                r={6}
                fill="#0A84FF"
                stroke="white"
                strokeWidth={2.5}
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
          <Ionicons name="chevron-back" size={24} color="#0A84FF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {exercise?.name || exerciseName}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {muscleGroup || exercise?.muscle_group}
            {exercise?.equipment_type ? ` • ${exercise.equipment_type}` : ''}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
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
              <View style={styles.summaryHeaderLeft}>
                <Ionicons name="analytics" size={20} color="#0A84FF" />
                <Text style={styles.summaryTitle}>Overview</Text>
              </View>
              {trend && !trend.isNeutral && (
                <View style={[styles.trendBadge, trend.isPositive && styles.trendBadgePositive]}>
                  <Ionicons
                    name={trend.isPositive ? 'trending-up' : 'trending-down'}
                    size={14}
                    color={trend.isPositive ? '#10B981' : '#EF4444'}
                  />
                  <Text style={[styles.trendText, trend.isPositive && styles.trendTextPositive]}>
                    {trend.value.toFixed(1)}%
                  </Text>
                </View>
              )}
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
                  <View style={[styles.summaryIconContainer, { backgroundColor: `${stat.color}15` }]}>
                    <Ionicons name={stat.icon} size={18} color={stat.color} />
                  </View>
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
              <View>
                <Text style={styles.chartHeaderTitle}>{metricConfig[activeMetric].title}</Text>
                <Text style={styles.chartHeaderSubtitle}>Last 3 months</Text>
              </View>
              {latestMetricValue > 0 && (
                <View style={styles.progressIndicator}>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        { width: `${progressPercentage}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>{Math.round(progressPercentage)}%</Text>
                </View>
              )}
            </View>
            <View style={styles.chartSummaryContainer}>
              <View>
                <Text style={styles.chartSummaryValue}>
                  {metricConfig[activeMetric].format(latestMetricValue)}
                </Text>
                <Text style={styles.chartSummaryLabel}>
                  Last session · {lastSessionAgoText}
                </Text>
              </View>
            </View>
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
            <View style={styles.notesHeader}>
              <Ionicons name="bulb" size={20} color="#FF6B35" />
              <Text style={styles.notesTitle}>Pro Tip</Text>
            </View>
            <Text style={styles.notesBody}>
              Log your sets with accurate weight and reps to see more detailed progress over time.
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
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerBack: {
    paddingVertical: 6,
    paddingRight: 8,
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
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
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  trendBadgePositive: {
    backgroundColor: '#F0FDF4',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  trendTextPositive: {
    color: '#10B981',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FAFBFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EDFF',
    paddingVertical: 4,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 8,
    minWidth: 0,
  },
  summaryItemDivider: {
    borderRightWidth: 1,
    borderRightColor: '#E8EDFF',
  },
  summaryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 26,
  },
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  chartHeaderSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  progressIndicator: {
    alignItems: 'flex-end',
    gap: 6,
  },
  progressBarContainer: {
    width: 80,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#0A84FF',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0A84FF',
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
  chartSummaryContainer: {
    marginBottom: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  chartSummaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  chartSummaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyChart: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyChartTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyChartSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  chartTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  chartTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center', 
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chartTabActive: {
    backgroundColor: '#0A84FF',
    borderColor: '#0A84FF',
  },
  chartTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  chartTabTextActive: {
    color: 'white',
  },
  notesCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FFE4CC',
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  notesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  notesBody: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
});

