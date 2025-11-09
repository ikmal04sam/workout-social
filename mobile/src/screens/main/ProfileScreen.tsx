import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { apiService, Workout, User } from '../../services/api';

interface ProfileStats {
  workout_count: number;
  follower_count: number;
  following_count: number;
}

interface WeeklyDuration {
  start: Date;
  end: Date;
  hours: number;
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

const buildWeeklyDurationData = (workouts: Workout[]): WeeklyDuration[] => {
  const now = new Date();
  const currentWeekStart = getWeekStart(now);
  const weeks: WeeklyDuration[] = [];

  for (let i = 11; i >= 0; i--) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    weeks.push({
      start,
      end,
      hours: 0,
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      monthLabel: start.toLocaleDateString('en-US', { month: 'short' }),
    });
  }

  if (!workouts) {
    return weeks;
  }

  workouts.forEach((workout) => {
    if (!workout.date || workout.duration == null) return;
    const workoutDate = new Date(workout.date);
    if (Number.isNaN(workoutDate.getTime())) return;
    const durationMinutes = Number(workout.duration);
    if (Number.isNaN(durationMinutes) || durationMinutes <= 0) return;

    for (const week of weeks) {
      if (workoutDate >= week.start && workoutDate < week.end) {
        week.hours += durationMinutes / 60;
        break;
      }
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
  const navigation = useNavigation();
  const { user, logout, isLoading: authLoading } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileData, setProfileData] = useState<User | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    workout_count: 0,
    follower_count: 0,
    following_count: 0,
  });

  const loadWorkouts = useCallback(async () => {
    try {
      setIsLoading(true);
      const [workoutsResponse, profileResponse] = await Promise.all([
        apiService.getUserWorkouts(),
        apiService.getProfile(),
      ]);

      const fetchedWorkouts = workoutsResponse.workouts || [];
      setWorkouts(fetchedWorkouts);

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

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

  const weeklyDurationData = useMemo(() => buildWeeklyDurationData(workouts), [workouts]);
  const maxWeeklyHours = useMemo(
    () => weeklyDurationData.reduce((max, week) => Math.max(max, week.hours), 0),
    [weeklyDurationData]
  );
  const latestWeekHours =
    weeklyDurationData.length > 0 ? weeklyDurationData[weeklyDurationData.length - 1].hours : 0;

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
                  onPress={() => navigation.navigate('MyWorkoutsList' as never)}
                >
                  <Text style={styles.compactLabel}>Workouts</Text>
                  <Text style={styles.compactValue}>{stats.workouts}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.compactStatItem}
                  onPress={() => navigation.navigate('Followers' as never)}
                >
                  <Text style={styles.compactLabel}>Followers</Text>
                  <Text style={styles.compactValue}>{stats.followers}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.compactStatItem}
                  onPress={() => navigation.navigate('Following' as never)}
                >
                  <Text style={styles.compactLabel}>Following</Text>
                  <Text style={styles.compactValue}>{stats.following}</Text>
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
            <Text style={styles.chartSummary}>
              <Text style={styles.chartSummaryValue}>{latestWeekHours.toFixed(1)} hrs</Text>{' '}
              {lastWorkoutAgoText}
            </Text>
            <View style={styles.chartRange}>
              <Text style={styles.chartRangeText}>Last 3 months</Text>
              <Text style={styles.chartRangeCaret}>▾</Text>
            </View>
          </View>

          <View style={styles.chart}>
            {weeklyDurationData.map((week, index) => {
              const barHeight =
                maxWeeklyHours > 0 ? Math.max(6, (week.hours / maxWeeklyHours) * 140) : 6;
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
            <View style={[styles.chartTab, styles.chartTabActive]}>
              <Text style={[styles.chartTabText, styles.chartTabTextActive]}>Duration</Text>
            </View>
            <View style={styles.chartTab}>
              <Text style={styles.chartTabText}>Volume</Text>
            </View>
            <View style={styles.chartTab}>
              <Text style={styles.chartTabText}>Reps</Text>
            </View>
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
            workouts.map((workout) => (
              <TouchableOpacity 
                key={workout.id} 
                style={styles.workoutCard}
                onPress={() => navigation.navigate('WorkoutDetail' as never, { workoutId: workout.id } as never)}
              >
                <View style={styles.workoutHeader}>
                  <Text style={styles.workoutTitle}>{workout.title}</Text>
                  <View style={styles.workoutBadge}>
                    <Text style={styles.workoutBadgeText}>
                      {workout.is_public ? 'Public' : 'Private'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.workoutDate}>{formatDate(workout.date)}</Text>
                {workout.duration && (
                  <Text style={styles.workoutDuration}>Duration: {workout.duration} min</Text>
                )}
                {workout.notes && (
                  <Text style={styles.workoutNotes} numberOfLines={2}>
                    {workout.notes}
                  </Text>
                )}
              </TouchableOpacity>
            ))
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
    gap: 16,
  },
  compactStatItem: {
    alignItems: 'flex-start',
  },
  compactLabel: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  compactValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
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
    alignItems: 'center',
    marginBottom: 16,
  },
  chartSummary: {
    fontSize: 14,
    color: '#667085',
  },
  chartSummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  chartRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chartRangeText: {
    fontSize: 14,
    color: '#0A84FF',
    fontWeight: '600',
  },
  chartRangeCaret: {
    fontSize: 12,
    color: '#0A84FF',
    marginTop: 2,
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
    gap: 12,
  },
  chartTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 18,
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
  workoutCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  workoutBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  workoutBadgeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  workoutDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  workoutDuration: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  workoutNotes: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
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
