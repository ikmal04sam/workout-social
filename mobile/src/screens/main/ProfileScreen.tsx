import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Image, Animated } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { apiService, Workout, User } from '../../services/api';
import DateDisplay from '../../components/DateDisplay';

interface ProfileStats {
  workout_count: number;
  follower_count: number;
  following_count: number;
}

type MetricType = 'duration' | 'volume';

interface WeeklyData {
  start: Date;
  end: Date;
  hours: number;
  volume: number; // total volume in lb·reps
  label: string;
  monthLabel: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday as start of week
  d.setDate(d.getDate() - diff);
  return d;
};

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

const buildWeeklyData = (workouts: WorkoutWithDetails[]): WeeklyData[] => {
  const now = new Date();
  const currentWeekStart = getWeekStart(now);
  const weeks: WeeklyData[] = [];

  for (let i = 11; i >= 0; i--) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    weeks.push({
      start,
      end,
      hours: 0,
      volume: 0,
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      monthLabel: start.toLocaleDateString('en-US', { month: 'short' }),
    });
  }

  if (!workouts) {
    return weeks;
  }

  workouts.forEach((workout) => {
    if (!workout.date) return;
    const workoutDate = new Date(workout.date);
    if (Number.isNaN(workoutDate.getTime())) return;

    // Find the week this workout belongs to
    let targetWeek: WeeklyData | null = null;
    for (const week of weeks) {
      if (workoutDate >= week.start && workoutDate < week.end) {
        targetWeek = week;
        break;
      }
    }

    if (!targetWeek) return;

    // Add duration
    if (workout.duration != null) {
      const durationMinutes = Number(workout.duration);
      if (!Number.isNaN(durationMinutes) && durationMinutes > 0) {
        targetWeek.hours += durationMinutes / 60;
      }
    }

    // Calculate volume from exercises and sets
    if (workout.exercises && Array.isArray(workout.exercises)) {
      workout.exercises.forEach((exercise) => {
        if (exercise.sets && Array.isArray(exercise.sets)) {
          exercise.sets.forEach((set) => {
            const reps = Number(set.reps) || 0;
            const weight = Number(set.weight) || 0;
            
            if (reps > 0 && weight > 0) {
              targetWeek!.volume += reps * weight;
            }
          });
        }
      });
    }
  });

  return weeks;
};

const getWeeksAgoText = (date?: Date | null) => {
  if (!date) return 'No workouts yet';
  const now = new Date();
  const diffWeeks = Math.floor((now.getTime() - date.getTime()) / (7 * MS_PER_DAY));
  if (diffWeeks <= 0) return 'This week';
  if (diffWeeks === 1) return '1 week ago';
  return `${diffWeeks} weeks ago`;
};

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, logout, isLoading: authLoading } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutsWithDetails, setWorkoutsWithDetails] = useState<WorkoutWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileData, setProfileData] = useState<User | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    workout_count: 0,
    follower_count: 0,
    following_count: 0,
  });
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('duration');
  const animatedValues = useRef<Record<string, Animated.Value>>({
    workouts: new Animated.Value(1),
    followers: new Animated.Value(1),
    following: new Animated.Value(1),
  });
  const workoutAnimatedValues = useRef<Record<number, Animated.Value>>({});

  const loadWorkouts = useCallback(async () => {
    try {
      setIsLoading(true);
      const [workoutsResponse, profileResponse] = await Promise.all([
        apiService.getUserWorkouts(),
        apiService.getProfile(),
      ]);

      const fetchedWorkouts = workoutsResponse.workouts || [];
      setWorkouts(fetchedWorkouts);

      // Fetch full workout details to get exercises and sets for volume/reps calculation
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

      if (profileResponse?.user) {
        setProfileData(profileResponse.user);
        setProfileStats({
          workout_count: profileResponse.user.workout_count ?? fetchedWorkouts.length,
          follower_count: profileResponse.user.follower_count ?? 0,
          following_count: profileResponse.user.following_count ?? 0,
        });
      } else {
        setProfileStats((prev) => ({
          ...prev,
          workout_count: fetchedWorkouts.length,
        }));
      }
    } catch (error) {
      console.error('Error loading workouts:', error);
      Alert.alert('Error', 'Failed to load workouts');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load workouts when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadWorkouts();
  };

  const handleWorkoutPressIn = (workoutId: number) => {
    if (!workoutAnimatedValues.current[workoutId]) {
      workoutAnimatedValues.current[workoutId] = new Animated.Value(1);
    }
    Animated.spring(workoutAnimatedValues.current[workoutId], {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handleWorkoutPressOut = (workoutId: number) => {
    if (!workoutAnimatedValues.current[workoutId]) {
      workoutAnimatedValues.current[workoutId] = new Animated.Value(1);
    }
    Animated.spring(workoutAnimatedValues.current[workoutId], {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleStatPress = (statType: 'workouts' | 'followers' | 'following') => {
    // Add press animation
    Animated.sequence([
      Animated.spring(animatedValues.current[statType], {
        toValue: 0.95,
        useNativeDriver: true,
      }),
      Animated.spring(animatedValues.current[statType], {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate based on stat type
    if (statType === 'workouts') {
      navigation.navigate('MyWorkoutsList' as never);
    } else if (statType === 'followers') {
      navigation.navigate('Followers' as never);
    } else if (statType === 'following') {
      navigation.navigate('Following' as never);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: logout
        }
      ]
    );
  };

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


  const activeUser = profileData || user;
  const profilePicUri = activeUser?.profile_pic
    ? activeUser.profile_pic.startsWith('data:')
      ? activeUser.profile_pic
      : `data:image/jpeg;base64,${activeUser.profile_pic}`
    : null;

  const stats = {
    workouts: profileStats.workout_count ?? workouts.length,
    followers: profileStats.follower_count ?? 0,
    following: profileStats.following_count ?? 0,
  };

  const weeklyData = useMemo(() => buildWeeklyData(workoutsWithDetails), [workoutsWithDetails]);
  
  const getMetricValue = (week: WeeklyData, metric: MetricType): number => {
    switch (metric) {
      case 'duration':
        return week.hours;
      case 'volume':
        return week.volume;
      default:
        return 0;
    }
  };

  const maxMetricValue = useMemo(
    () => weeklyData.reduce((max, week) => Math.max(max, getMetricValue(week, selectedMetric)), 0),
    [weeklyData, selectedMetric]
  );

  const latestWeekValue = useMemo(
    () => weeklyData.length > 0 ? getMetricValue(weeklyData[weeklyData.length - 1], selectedMetric) : 0,
    [weeklyData, selectedMetric]
  );

  const formatMetricValue = (value: number, metric: MetricType): string => {
    switch (metric) {
      case 'duration':
        return `${value.toFixed(1)} hrs`;
      case 'volume':
        return `${Math.round(value).toLocaleString()} lb·reps`;
      default:
        return '0';
    }
  };

  const lastWorkoutDate = useMemo(() => {
    if (!workouts || workouts.length === 0) return null;
    return workouts.reduce<Date | null>((latest, workout) => {
      if (!workout.date) return latest;
      const workoutDate = new Date(workout.date);
      if (Number.isNaN(workoutDate.getTime())) return latest;
      if (!latest || workoutDate > latest) {
        return workoutDate;
      }
      return latest;
    }, null);
  }, [workouts]);

  const lastWorkoutAgoText = getWeeksAgoText(lastWorkoutDate);

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.content}>
        <View style={styles.profileHeaderRow}>
          <View style={styles.profilePicContainer}>
            {profilePicUri ? (
              <Image source={{ uri: profilePicUri }} style={styles.profilePic} />
            ) : (
              <View style={styles.profilePicPlaceholder}>
                <Text style={styles.profilePicPlaceholderText}>
                  {activeUser?.username?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.profileHeaderContent}>
            <Text style={styles.username}>{activeUser?.username || 'Loading...'}</Text>
              <View style={styles.compactStatsRow}>
                <TouchableOpacity
                  style={styles.compactStatItem}
                  activeOpacity={0.7}
                  onPress={() => handleStatPress('workouts')}
                >
                  <Animated.View
                    style={[
                      styles.compactStatContent,
                      { transform: [{ scale: animatedValues.current.workouts }] },
                    ]}
                  >
                    <Text style={styles.compactValue}>{stats.workouts}</Text>
                    <Text style={styles.compactLabel}>WORKOUTS</Text>
                  </Animated.View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.compactStatItem}
                  activeOpacity={0.7}
                  onPress={() => handleStatPress('followers')}
                >
                  <Animated.View
                    style={[
                      styles.compactStatContent,
                      { transform: [{ scale: animatedValues.current.followers }] },
                    ]}
                  >
                    <Text style={styles.compactValue}>{stats.followers}</Text>
                    <Text style={styles.compactLabel}>FOLLOWERS</Text>
                  </Animated.View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.compactStatItem}
                  activeOpacity={0.7}
                  onPress={() => handleStatPress('following')}
                >
                  <Animated.View
                    style={[
                      styles.compactStatContent,
                      { transform: [{ scale: animatedValues.current.following }] },
                    ]}
                  >
                    <Text style={styles.compactValue}>{stats.following}</Text>
                    <Text style={styles.compactLabel}>FOLLOWING</Text>
                  </Animated.View>
                </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.profileDetailsCard}>
          {activeUser?.email ? <Text style={styles.email}>{activeUser.email}</Text> : null}
          <Text style={styles.bio}>{activeUser?.bio || 'No bio yet'}</Text>
          <Text style={styles.memberSince}>
            Member since {activeUser?.created_at ? new Date(activeUser.created_at).toLocaleDateString() : ''}
          </Text>
        </View>

        {/* Edit Button */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProfile' as never)}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        {/* Weekly Activity Chart */}
        <View style={[styles.chartCard, styles.chartCardSpacing]}>
          <View style={styles.chartHeader}>
            <View style={styles.chartSummaryContainer}>
              <Text style={styles.chartSummaryValue}>{formatMetricValue(latestWeekValue, selectedMetric)}</Text>
              <Text style={styles.chartSummaryLabel}>{lastWorkoutAgoText}</Text>
            </View>
            <View style={styles.chartRange}>
              <Text style={styles.chartRangeText}>Last 3 months</Text>
              <Ionicons name="chevron-down" size={14} color="#0A84FF" />
            </View>
          </View>

          <View style={styles.chart}>
            {weeklyData.map((week, index) => {
              const metricValue = getMetricValue(week, selectedMetric);
              const barHeight =
                maxMetricValue > 0 ? Math.max(6, (metricValue / maxMetricValue) * 140) : 6;
              const showLabel = index % 3 === 0;
              return (
                <View key={`${week.start.toISOString()}-${index}`} style={styles.chartBarWrapper}>
                  <View style={styles.chartBarTrack}>
                    <View style={[styles.chartBar, { height: barHeight }]} />
                  </View>
                  <Text style={styles.chartBarLabel}>{showLabel ? week.monthLabel : ''}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.chartTabs}>
            <TouchableOpacity
              style={[styles.chartTab, selectedMetric === 'duration' && styles.chartTabActive]}
              onPress={() => setSelectedMetric('duration')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="time-outline"
                size={16}
                color={selectedMetric === 'duration' ? 'white' : '#6B7280'}
                style={styles.chartTabIcon}
              />
              <Text style={[styles.chartTabText, selectedMetric === 'duration' && styles.chartTabTextActive]}>
                Duration
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chartTab, selectedMetric === 'volume' && styles.chartTabActive]}
              onPress={() => setSelectedMetric('volume')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="stats-chart-outline"
                size={16}
                color={selectedMetric === 'volume' ? 'white' : '#6B7280'}
                style={styles.chartTabIcon}
              />
              <Text style={[styles.chartTabText, selectedMetric === 'volume' && styles.chartTabTextActive]}>
                Volume
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Workouts Section */}
        <View style={styles.workoutsSection}>
          <Text style={styles.sectionTitle}>My Workouts ({workouts.length})</Text>
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading workouts...</Text>
            </View>
          ) : workouts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No workouts yet</Text>
              <Text style={styles.emptySubtext}>Create your first workout to get started!</Text>
            </View>
          ) : (
            <View style={styles.workoutsContent}>
              {workouts.map((workout, index) => {
                const scaleAnim = workoutAnimatedValues.current[workout.id] || new Animated.Value(1);
                const workoutData = transformWorkoutForCard(workout);
                
                return (
                  <Animated.View
                    key={workout.id}
                    style={[{ transform: [{ scale: scaleAnim }] }]}
                  >
                    <TouchableOpacity 
                      style={[
                        styles.workoutCard,
                        index % 2 === 1 && styles.workoutCardAlternate,
                      ]}
                      onPress={() =>
                        navigation.navigate(
                          'WorkoutDetail' as never,
                          {
                            workoutId: workout.id,
                          } as never
                        )
                      }
                      onPressIn={() => handleWorkoutPressIn(workout.id)}
                      onPressOut={() => handleWorkoutPressOut(workout.id)}
                      activeOpacity={1}
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
                  </Animated.View>
                );
              })}
            </View>
          )}
        </View>
        
        <TouchableOpacity 
          style={[styles.button, authLoading && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={authLoading}
        >
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'stretch',
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profilePicContainer: {
    marginRight: 16,
  },
  profilePic: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e0e0e0',
  },
  profilePicPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicPlaceholderText: {
    color: 'white',
    fontSize: 30,
    fontWeight: 'bold',
  },
  profileHeaderContent: {
    flex: 1,
    alignItems: 'flex-start',
    marginRight: 12,
  },
  username: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2d2d2d',
    marginBottom: 8,
  },
  compactStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  compactStatItem: {
    alignItems: 'flex-start',
    minWidth: 70,
  },
  compactStatContent: {
    alignItems: 'flex-start',
    gap: 4,
  },
  compactValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  compactLabel: {
    fontSize: 10,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
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
  chartCardSpacing: {
    marginTop: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  chartSummaryContainer: {
    flex: 1,
    gap: 4,
  },
  chartSummaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  chartSummaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  chartRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  chartRangeText: {
    fontSize: 13,
    color: '#0A84FF',
    fontWeight: '600',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 170,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  chartBarWrapper: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  chartBarTrack: {
    width: 12,
    height: 150,
    borderRadius: 6,
    backgroundColor: '#eef1ff',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: '#0A84FF',
  },
  chartBarLabel: {
    fontSize: 10,
    color: '#98a2b3',
    marginTop: 6,
  },
  chartTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  chartTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chartTabActive: {
    backgroundColor: '#0A84FF',
    borderColor: '#0A84FF',
  },
  chartTabIcon: {
    marginRight: 0,
  },
  chartTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  chartTabTextActive: {
    color: 'white',
  },
  profileDetailsCard: {
    width: '100%',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    color: '#666',
    textAlign: 'left',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 12,
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  workoutsSection: {
    marginTop: 24,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  emptyContainer: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 8,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  workoutsContent: {
    padding: 0,
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
  button: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
